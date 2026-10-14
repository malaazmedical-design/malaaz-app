-- Test project only. "اسأل طبيب" v2 (free quick question):
--   client sends a question  -> status 'new'  (client sees "تم الإرسال")
--   admin routes it to a SPECIALTY -> status 'routed' (doctors of that specialty who offer online consultation are pushed)
--   first doctor to "accept & answer" wins -> status 'answered' (others no longer see it; client sees "تم الرد")
-- Doctors never read the table directly (no patient phone leaks): they use the RPCs below.

-- ───────── helpers ─────────
create or replace function public.is_admin()
 returns boolean language sql stable security definer set search_path to 'public'
as $$ select exists (select 1 from public.admin_users where user_id = auth.uid()); $$;

-- ───────── columns ─────────
alter table public.ask_doctor_cases
  add column if not exists routed_specialty text,
  add column if not exists routed_at timestamptz,
  add column if not exists answer text,
  add column if not exists answered_at timestamptz,
  add column if not exists edited_at timestamptz;

-- readable case number (Q-1001, Q-1002 ...)
create sequence if not exists public.ask_case_seq start 1001;
create or replace function public.ask_case_defaults()
 returns trigger language plpgsql as $$
begin
  if new.case_number is null then new.case_number := 'Q-' || nextval('public.ask_case_seq'); end if;
  new.updated_at := now();
  return new;
end; $$;
drop trigger if exists ask_case_defaults on public.ask_doctor_cases;
create trigger ask_case_defaults before insert or update on public.ask_doctor_cases
  for each row execute function public.ask_case_defaults();

-- ───────── can this doctor see/answer this case? ─────────
create or replace function public.provider_offers_online(p_provider uuid)
 returns boolean language sql stable security definer set search_path to 'public'
as $$
  select exists (
    select 1 from public.provider_services ps
    join public.sub_services s on s.id = ps.sub_service_id
    where ps.provider_id = p_provider and s.group_name = 'online' and coalesce(ps.is_active, true)
  );
$$;

create or replace function public.can_view_ask_case(p_case uuid)
 returns boolean language sql stable security definer set search_path to 'public'
as $$
  select exists (
    select 1 from public.ask_doctor_cases c
    where c.id = p_case and (
      public.is_admin()
      or c.client_id in (select id from public.clients where auth_id = auth.uid())
      or c.assigned_doctor_id in (select id from public.providers where user_id = auth.uid())
      or (c.status = 'routed' and c.assigned_doctor_id is null and exists (
            select 1 from public.providers p
            where p.user_id = auth.uid() and p.status = 'active'
              and p.specialty = c.routed_specialty
              and public.provider_offers_online(p.id)))
    )
  );
$$;

-- ───────── RLS ─────────
drop policy if exists doctor_see_new_cases on public.ask_doctor_cases;
drop policy if exists doctor_update_case on public.ask_doctor_cases;
drop policy if exists patient_insert_case on public.ask_doctor_cases;
drop policy if exists patient_own_cases on public.ask_doctor_cases;
drop policy if exists ask_admin_all on public.ask_doctor_cases;
drop policy if exists ask_client_select on public.ask_doctor_cases;
drop policy if exists ask_client_insert on public.ask_doctor_cases;

create policy ask_admin_all on public.ask_doctor_cases for all to authenticated
  using (public.is_admin()) with check (public.is_admin());
create policy ask_client_select on public.ask_doctor_cases for select to authenticated
  using (client_id in (select id from public.clients where auth_id = auth.uid()));
create policy ask_client_insert on public.ask_doctor_cases for insert to authenticated
  with check (status = 'new' and client_id in (select id from public.clients where auth_id = auth.uid()));

drop policy if exists attachments_access on public.ask_doctor_attachments;
create policy attachments_access on public.ask_doctor_attachments for all to authenticated
  using (public.can_view_ask_case(case_id)) with check (public.can_view_ask_case(case_id));

-- private bucket for question attachments (path = <case id>/<n>.<ext>)
insert into storage.buckets (id, name, public) values ('ask-doctor-attachments', 'ask-doctor-attachments', false)
on conflict (id) do nothing;
drop policy if exists ask_att_read on storage.objects;
drop policy if exists ask_att_insert on storage.objects;
create policy ask_att_read on storage.objects for select to authenticated
  using (bucket_id = 'ask-doctor-attachments' and public.can_view_ask_case(((storage.foldername(name))[1])::uuid));
create policy ask_att_insert on storage.objects for insert to authenticated
  with check (bucket_id = 'ask-doctor-attachments' and public.can_view_ask_case(((storage.foldername(name))[1])::uuid));

-- ───────── client: edit a question that was not answered yet ─────────
create or replace function public.edit_ask_case(p_case uuid, p_message text)
 returns text language plpgsql security definer set search_path to 'public'
as $$
begin
  if coalesce(length(trim(p_message)), 0) < 3 then return 'invalid'; end if;
  update public.ask_doctor_cases set message = trim(p_message), edited_at = now()
   where id = p_case and status in ('new', 'routed')
     and client_id in (select id from public.clients where auth_id = auth.uid());
  if not found then return 'locked'; end if;
  return 'ok';
end; $$;
grant execute on function public.edit_ask_case(uuid, text) to authenticated;

-- ───────── client: who answered + booking offer prices ─────────
create or replace function public.ask_case_doctor(p_case uuid)
 returns table (provider_id uuid, name text, specialty text, grade text, photo_url text,
                online_price numeric, visit_price numeric)
 language sql stable security definer set search_path to 'public'
as $$
  select p.id, p.name, p.specialty, p.grade, p.photo_url,
         (select ps.custom_price from public.provider_services ps
            join public.sub_services s on s.id = ps.sub_service_id
           where ps.provider_id = p.id and s.group_name = 'online' and coalesce(ps.is_active, true) limit 1),
         nullif(p.price::text, '')::numeric
  from public.ask_doctor_cases c
  join public.providers p on p.id = c.assigned_doctor_id
  where c.id = p_case and c.status = 'answered'
    and c.client_id in (select id from public.clients where auth_id = auth.uid());
$$;
grant execute on function public.ask_case_doctor(uuid) to authenticated;

-- ───────── doctor: inbox + accept & answer ─────────
create or replace function public.ask_doctor_inbox()
 returns table (id uuid, case_number text, message text, routed_specialty text, urgency_flag boolean,
                status text, created_at timestamptz, answer text, answered_at timestamptz,
                mine boolean, attachments int)
 language sql stable security definer set search_path to 'public'
as $$
  select c.id, c.case_number, c.message, c.routed_specialty, c.urgency_flag, c.status, c.created_at,
         case when c.assigned_doctor_id = me.id then c.answer end, c.answered_at,
         (c.assigned_doctor_id = me.id),
         (select count(*)::int from public.ask_doctor_attachments a where a.case_id = c.id)
  from public.providers me
  join public.ask_doctor_cases c on
       c.assigned_doctor_id = me.id
    or (c.status = 'routed' and c.assigned_doctor_id is null and c.routed_specialty = me.specialty)
  where me.user_id = auth.uid() and me.status = 'active' and public.provider_offers_online(me.id)
  order by c.created_at desc;
$$;
grant execute on function public.ask_doctor_inbox() to authenticated;

create or replace function public.answer_ask_case(p_case uuid, p_answer text)
 returns text language plpgsql security definer set search_path to 'public'
as $$
declare v_me public.providers;
begin
  select * into v_me from public.providers where user_id = auth.uid() and status = 'active' limit 1;
  if v_me.id is null or not public.provider_offers_online(v_me.id) then return 'forbidden'; end if;
  if coalesce(length(trim(p_answer)), 0) < 6 then return 'invalid'; end if;
  -- single atomic UPDATE: the first doctor wins, everyone else gets 'taken'
  update public.ask_doctor_cases
     set assigned_doctor_id = v_me.id, answer = trim(p_answer), answered_at = now(), status = 'answered'
   where id = p_case and status = 'routed' and assigned_doctor_id is null and routed_specialty = v_me.specialty;
  if not found then return 'taken'; end if;
  return 'ok';
end; $$;
grant execute on function public.answer_ask_case(uuid, text) to authenticated;

-- ───────── admin: route to a specialty ─────────
create or replace function public.route_ask_case(p_case uuid, p_specialty text)
 returns text language plpgsql security definer set search_path to 'public'
as $$
begin
  if not public.is_admin() then return 'forbidden'; end if;
  update public.ask_doctor_cases
     set routed_specialty = p_specialty, routed_at = now(), status = 'routed'
   where id = p_case and status in ('new', 'routed') and assigned_doctor_id is null;
  if not found then return 'locked'; end if;
  return 'ok';
end; $$;
grant execute on function public.route_ask_case(uuid, text) to authenticated;

-- specialties that can receive questions right now (active + offers online consultation), with doctor counts
create or replace function public.ask_specialty_counts()
 returns table (specialty text, doctors int, available int)
 language sql stable security definer set search_path to 'public'
as $$
  select p.specialty, count(*)::int, count(*) filter (where coalesce(p.is_available, true))::int
  from public.providers p
  where public.is_admin() and p.status = 'active' and p.specialty is not null
    and public.provider_offers_online(p.id)
  group by p.specialty order by 2 desc;
$$;
grant execute on function public.ask_specialty_counts() to authenticated;

-- ───────── push notifications ─────────
create or replace function public.notify_ask_case_change()
 returns trigger language plpgsql security definer set search_path to 'public', 'extensions'
as $$
declare v_tokens text[]; v_phone text;
begin
  if new.status = 'routed' and (tg_op = 'INSERT' or old.status is distinct from 'routed' or old.routed_specialty is distinct from new.routed_specialty) then
    select coalesce(array_agg(t), '{}') into v_tokens from (
      select unnest(public.provider_push_tokens(p.id)) t
      from public.providers p
      where p.status = 'active' and p.specialty = new.routed_specialty and coalesce(p.is_available, true)
        and public.provider_offers_online(p.id)) s;
    perform public.send_expo_push(v_tokens, 'سؤال جديد في تخصصك',
      left(new.message, 80), jsonb_build_object('kind', 'ask_new', 'case_id', new.id));
  elsif new.status = 'answered' and old.status is distinct from 'answered' then
    select phone into v_phone from public.clients where id = new.client_id;
    perform public.send_expo_push(public.client_push_tokens(coalesce(v_phone, new.patient_phone)),
      'جاءك رد على سؤالك', 'ردّ عليك طبيب — افتح الرد الآن',
      jsonb_build_object('kind', 'ask_answer', 'case_id', new.id));
  end if;
  return new;
end; $$;
drop trigger if exists notify_ask_case_change on public.ask_doctor_cases;
create trigger notify_ask_case_change after insert or update on public.ask_doctor_cases
  for each row execute function public.notify_ask_case_change();

-- ───────── admin: approve / suspend providers from the panel (replaces manual SQL) ─────────
-- providers already has the admin_all_providers policy, nothing else needed.

-- realtime for the client's question list (rows are still filtered by RLS)
do $$ begin
  alter publication supabase_realtime add table public.ask_doctor_cases;
exception when duplicate_object then null; end $$;
