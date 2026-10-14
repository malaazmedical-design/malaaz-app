-- Test project only. Phase 3: online consultation (chat channel) — the full journey:
--   book (pay pending) -> admin confirms payment -> doctor proposes a time inside the client's period
--   -> client accepts -> reminders (30/10 min) -> doctor starts (<=10 min before) -> chat with countdown
--   -> auto end -> doctor summary -> client rating (admin approves).
-- Everything is written through security-definer RPCs; tables are read-only for participants.
-- Voice/video reuse the same table (channel column) in a later phase.

-- ───────── per-doctor consultation length ─────────
alter table public.provider_services add column if not exists duration_min int default 15;

-- ───────── tables ─────────
create sequence if not exists public.consult_seq start 1001;

create table if not exists public.consultations (
  id uuid primary key default gen_random_uuid(),
  case_number text unique,
  client_id uuid not null references public.clients(id),
  provider_id uuid not null references public.providers(id),
  client_name text,
  channel text not null default 'chat' check (channel in ('chat', 'voice', 'video')),
  price numeric not null,
  duration_min int not null default 15,
  period_date date not null,
  period text not null check (period in ('morning', 'noon', 'evening', 'asap')),
  pay_method text check (pay_method in ('wallet', 'instapay')),
  pay_status text not null default 'pending' check (pay_status in ('pending', 'paid', 'cancelled')),
  cancel_reason text,
  pay_deadline timestamptz,
  paid_at timestamptz,
  prop_at timestamptz,
  prop_status text not null default 'none' check (prop_status in ('none', 'pending', 'ok', 'no', 'handled')),
  appt_at timestamptz,
  state text not null default 'wait' check (state in ('wait', 'live', 'ended')),
  started_at timestamptz,
  ended_at timestamptz,
  extra_min int not null default 0,
  client_in_at timestamptz,
  no_show boolean not null default false,
  refunded boolean not null default false,
  sum_note text,
  sum_recs text,
  sum_follow text not null default 'none' check (sum_follow in ('none', 'week', 'two', 'month')),
  sum_at timestamptz,
  rating int check (rating between 1 and 5),
  rating_text text,
  rating_ok boolean not null default false,
  flags jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists consultations_client_idx on public.consultations (client_id, created_at desc);
create index if not exists consultations_provider_idx on public.consultations (provider_id, created_at desc);

create table if not exists public.consultation_messages (
  id uuid primary key default gen_random_uuid(),
  consultation_id uuid not null references public.consultations(id) on delete cascade,
  sender text not null check (sender in ('c', 'd')),
  body text,
  file_path text,
  file_name text,
  created_at timestamptz not null default now()
);
create index if not exists consultation_messages_idx on public.consultation_messages (consultation_id, created_at);

create or replace function public.consult_defaults()
 returns trigger language plpgsql as $$
begin
  if tg_op = 'INSERT' and new.case_number is null then new.case_number := 'C-' || nextval('public.consult_seq'); end if;
  new.updated_at := now();
  return new;
end; $$;
drop trigger if exists consult_defaults on public.consultations;
create trigger consult_defaults before insert or update on public.consultations
  for each row execute function public.consult_defaults();

-- ───────── helpers ─────────
-- 'c' client · 'd' doctor · 'a' admin · null stranger
create or replace function public.consult_role(p_id uuid)
 returns text language sql stable security definer set search_path to 'public'
as $$
  select case
    when public.is_admin() then 'a'
    when c.client_id in (select id from public.clients where auth_id = auth.uid()) then 'c'
    when c.provider_id in (select id from public.providers where user_id = auth.uid()) then 'd'
  end
  from public.consultations c where c.id = p_id;
$$;

create or replace function public.consult_period_start(p_date date, p_period text)
 returns timestamptz language sql immutable as $$
  select ((p_date + case p_period when 'morning' then time '08:00' when 'noon' then time '12:00' else time '16:00' end)
          at time zone 'Africa/Cairo');
$$;
create or replace function public.consult_period_end(p_date date, p_period text)
 returns timestamptz language sql immutable as $$
  select ((p_date + case p_period when 'morning' then time '12:00' when 'noon' then time '16:00' else time '21:00' end)
          at time zone 'Africa/Cairo');
$$;

create or replace function public.consult_end_at(c public.consultations)
 returns timestamptz language sql immutable as $$
  select c.started_at + make_interval(mins => c.duration_min + c.extra_min);
$$;

-- push to one side of a consultation
create or replace function public.consult_push(p_id uuid, p_to text, p_title text, p_body text)
 returns void language plpgsql security definer set search_path to 'public', 'extensions'
as $$
declare c public.consultations; v_phone text;
begin
  select * into c from public.consultations where id = p_id;
  if c.id is null then return; end if;
  if p_to = 'd' then
    perform public.send_expo_push(public.provider_push_tokens(c.provider_id), p_title, p_body,
      jsonb_build_object('kind', 'consult', 'role', 'provider', 'consultation_id', p_id));
  else
    select phone into v_phone from public.clients where id = c.client_id;
    perform public.send_expo_push(public.client_push_tokens(v_phone), p_title, p_body,
      jsonb_build_object('kind', 'consult', 'role', 'client', 'consultation_id', p_id));
  end if;
end; $$;
revoke all on function public.consult_push(uuid, text, text, text) from public, anon, authenticated;

-- ───────── RLS: participants read, nobody writes directly ─────────
alter table public.consultations enable row level security;
alter table public.consultation_messages enable row level security;

drop policy if exists consult_read on public.consultations;
create policy consult_read on public.consultations for select to authenticated
  using (public.consult_role(id) is not null);
drop policy if exists consult_msg_read on public.consultation_messages;
create policy consult_msg_read on public.consultation_messages for select to authenticated
  using (public.consult_role(consultation_id) is not null);

grant select on public.consultations, public.consultation_messages to authenticated;

do $$ begin alter publication supabase_realtime add table public.consultations;
exception when duplicate_object then null; end $$;
do $$ begin alter publication supabase_realtime add table public.consultation_messages;
exception when duplicate_object then null; end $$;

-- private bucket for chat attachments (path = <consultation id>/<file>)
insert into storage.buckets (id, name, public) values ('consultation-files', 'consultation-files', false) on conflict (id) do nothing;
drop policy if exists consult_files_read on storage.objects;
drop policy if exists consult_files_insert on storage.objects;
create policy consult_files_read on storage.objects for select to authenticated
  using (bucket_id = 'consultation-files' and public.consult_role(((storage.foldername(name))[1])::uuid) is not null);
create policy consult_files_insert on storage.objects for insert to authenticated
  with check (bucket_id = 'consultation-files' and public.consult_role(((storage.foldername(name))[1])::uuid) in ('c', 'd'));

-- ───────── 1. client books ─────────
create or replace function public.book_consultation(p_provider uuid, p_channel text, p_date date, p_period text, p_pay_method text)
 returns uuid language plpgsql security definer set search_path to 'public'
as $$
declare
  v_client public.clients; v_prov public.providers; v_price numeric; v_dur int;
  v_today date := (now() at time zone 'Africa/Cairo')::date;
  v_deadline timestamptz; v_id uuid;
begin
  select * into v_client from public.clients where auth_id = auth.uid() limit 1;
  if v_client.id is null then raise exception 'سجّل دخولك أولاً'; end if;
  if p_channel <> 'chat' then raise exception 'هذه القناة غير متاحة حاليًا'; end if;
  if p_pay_method not in ('wallet', 'instapay') then raise exception 'اختر طريقة الدفع'; end if;
  if p_period not in ('morning', 'noon', 'evening', 'asap') then raise exception 'اختر الفترة'; end if;

  select * into v_prov from public.providers where id = p_provider and status = 'active';
  if v_prov.id is null then raise exception 'مقدم الخدمة غير متاح'; end if;
  select ps.custom_price, coalesce(ps.duration_min, 15) into v_price, v_dur
    from public.provider_services ps join public.sub_services s on s.id = ps.sub_service_id
   where ps.provider_id = p_provider and s.group_name = 'online' and coalesce(ps.is_active, true) limit 1;
  if v_price is null then raise exception 'الطبيب لا يقدم استشارة أونلاين حاليًا'; end if;

  if p_period = 'asap' then
    p_date := v_today;
    v_deadline := now() + interval '2 hours';
  else
    if p_date < v_today or p_date > v_today + 7 then raise exception 'اختر يومًا خلال الأسبوع القادم'; end if;
    if public.consult_period_end(p_date, p_period) < now() + interval '30 minutes' then raise exception 'هذه الفترة انتهت، اختر فترة أخرى'; end if;
    -- payment must arrive an hour before the period starts (but never less than 30 minutes from booking)
    v_deadline := greatest(public.consult_period_start(p_date, p_period) - interval '1 hour', now() + interval '30 minutes');
  end if;

  insert into public.consultations (client_id, provider_id, client_name, channel, price, duration_min, period_date, period, pay_method, pay_deadline)
  values (v_client.id, p_provider, v_client.name, p_channel, v_price, v_dur, p_date, p_period, p_pay_method, v_deadline)
  returning id into v_id;
  return v_id;
end; $$;

-- ───────── 2. admin: payment status ─────────
create or replace function public.admin_set_payment(p_id uuid, p_status text, p_reason text default null)
 returns text language plpgsql security definer set search_path to 'public'
as $$
declare c public.consultations;
begin
  if not public.is_admin() then return 'forbidden'; end if;
  select * into c from public.consultations where id = p_id for update;
  if c.id is null then return 'missing'; end if;
  if c.state <> 'wait' then return 'locked'; end if;
  if p_status = 'paid' then
    if c.pay_status = 'paid' then return 'ok'; end if;
    update public.consultations set pay_status = 'paid', paid_at = now(), cancel_reason = null where id = p_id;
    perform public.consult_push(p_id, 'd', 'تم دفع استشارة جديدة', 'حدد موعد الاستشارة داخل فترة المريض');
    perform public.consult_push(p_id, 'c', 'تم تأكيد الدفع', 'هيحدد الطبيب موعد الاستشارة وهيوصلك إشعار');
  elsif p_status = 'pending' then
    if c.prop_status <> 'none' then return 'locked'; end if;
    update public.consultations set pay_status = 'pending', paid_at = null where id = p_id;
  elsif p_status = 'cancelled' then
    update public.consultations set pay_status = 'cancelled', cancel_reason = coalesce(nullif(trim(p_reason), ''), 'سبب آخر') where id = p_id;
    perform public.consult_push(p_id, 'c', 'تم إلغاء الاستشارة', coalesce(nullif(trim(p_reason), ''), 'سبب آخر'));
    perform public.consult_push(p_id, 'd', 'تم إلغاء استشارة', coalesce(nullif(trim(p_reason), ''), 'سبب آخر'));
  else
    return 'invalid';
  end if;
  return 'ok';
end; $$;

-- ───────── 3. doctor proposes a time inside the client's period ─────────
create or replace function public.propose_consultation_time(p_id uuid, p_at timestamptz)
 returns text language plpgsql security definer set search_path to 'public'
as $$
declare c public.consultations;
begin
  select * into c from public.consultations where id = p_id for update;
  if c.id is null or public.consult_role(p_id) is distinct from 'd' then return 'forbidden'; end if;
  if c.pay_status <> 'paid' or c.state <> 'wait' then return 'locked'; end if;
  if c.prop_status = 'pending' then return 'pending'; end if;
  if p_at < now() + interval '5 minutes' then return 'past'; end if;
  if c.period = 'asap' then
    if p_at > now() + interval '12 hours' then return 'outside'; end if;
  elsif p_at < public.consult_period_start(c.period_date, c.period) or p_at >= public.consult_period_end(c.period_date, c.period) then
    return 'outside';
  end if;
  update public.consultations set prop_at = p_at, prop_status = 'pending', appt_at = null, flags = '{}'::jsonb where id = p_id;
  perform public.consult_push(p_id, 'c', 'موعد استشارتك', 'اقترح الطبيب موعدًا — افتح الحجز للموافقة');
  return 'ok';
end; $$;

-- ───────── 4. client answers the proposal ─────────
create or replace function public.respond_consultation_time(p_id uuid, p_accept boolean)
 returns text language plpgsql security definer set search_path to 'public'
as $$
declare c public.consultations;
begin
  select * into c from public.consultations where id = p_id for update;
  if c.id is null or public.consult_role(p_id) is distinct from 'c' then return 'forbidden'; end if;
  if c.prop_status <> 'pending' or c.state <> 'wait' then return 'locked'; end if;
  if p_accept then
    update public.consultations set prop_status = 'ok', appt_at = prop_at where id = p_id;
    perform public.consult_push(p_id, 'd', 'وافق المريض على الموعد', 'تم اعتماد موعد الاستشارة');
  else
    update public.consultations set prop_status = 'no' where id = p_id;
    perform public.consult_push(p_id, 'd', 'المريض لا يناسبه الموعد', 'الإدارة هتتواصل معه لتحديد موعد جديد');
  end if;
  return 'ok';
end; $$;

-- admin: mark a rejected / unanswered proposal as handled so the doctor can propose again
create or replace function public.admin_consultation_handled(p_id uuid)
 returns text language plpgsql security definer set search_path to 'public'
as $$
begin
  if not public.is_admin() then return 'forbidden'; end if;
  update public.consultations set prop_status = 'handled' where id = p_id and prop_status in ('no', 'pending');
  if found then perform public.consult_push(p_id, 'd', 'حدد موعدًا جديدًا', 'تواصلت الإدارة مع المريض — اقترح موعدًا آخر'); end if;
  return 'ok';
end; $$;

-- ───────── 5. session ─────────
create or replace function public.start_consultation(p_id uuid)
 returns text language plpgsql security definer set search_path to 'public'
as $$
declare c public.consultations;
begin
  select * into c from public.consultations where id = p_id for update;
  if c.id is null or public.consult_role(p_id) is distinct from 'd' then return 'forbidden'; end if;
  if c.pay_status <> 'paid' or c.prop_status <> 'ok' or c.state <> 'wait' then return 'locked'; end if;
  if now() < c.appt_at - interval '10 minutes' then return 'early'; end if;
  update public.consultations set state = 'live', started_at = now(), flags = '{}'::jsonb where id = p_id;
  perform public.consult_push(p_id, 'c', 'بدأت استشارتك', 'بدأ الطبيب الاستشارة — اضغط للدخول');
  return 'ok';
end; $$;

create or replace function public.enter_consultation(p_id uuid)
 returns void language plpgsql security definer set search_path to 'public'
as $$
begin
  if public.consult_role(p_id) is distinct from 'c' then return; end if;
  update public.consultations set client_in_at = now() where id = p_id and state = 'live' and client_in_at is null;
end; $$;

create or replace function public.extend_consultation(p_id uuid, p_min int)
 returns text language plpgsql security definer set search_path to 'public'
as $$
begin
  if public.consult_role(p_id) is distinct from 'd' then return 'forbidden'; end if;
  if p_min not in (5, 10) then return 'invalid'; end if;
  update public.consultations set extra_min = extra_min + p_min,
         flags = flags - 'e5'
   where id = p_id and state = 'live' and now() < public.consult_end_at(consultations);
  if not found then return 'locked'; end if;
  return 'ok';
end; $$;

-- ends the session once its time is over (either side can call it when the timer hits zero)
create or replace function public.consultation_touch(p_id uuid)
 returns text language plpgsql security definer set search_path to 'public'
as $$
declare c public.consultations;
begin
  if public.consult_role(p_id) is null then return null; end if;
  select * into c from public.consultations where id = p_id for update;
  if c.state = 'live' and now() >= public.consult_end_at(c) then
    update public.consultations set state = 'ended', ended_at = public.consult_end_at(c) where id = p_id;
    perform public.consult_push(p_id, 'd', 'انتهت الاستشارة', 'اكتب ملخص الاستشارة');
    perform public.consult_push(p_id, 'c', 'انتهت الاستشارة', 'بانتظار ملخص الطبيب');
    return 'ended';
  end if;
  return c.state;
end; $$;

create or replace function public.end_consultation(p_id uuid, p_no_show boolean default false)
 returns text language plpgsql security definer set search_path to 'public'
as $$
declare c public.consultations;
begin
  select * into c from public.consultations where id = p_id for update;
  if c.id is null or public.consult_role(p_id) is distinct from 'd' then return 'forbidden'; end if;
  if c.state <> 'live' then return 'locked'; end if;
  if p_no_show then
    if c.client_in_at is not null or now() < c.started_at + interval '10 minutes' then return 'too_early'; end if;
    update public.consultations set state = 'ended', ended_at = now(), no_show = true where id = p_id;
    perform public.consult_push(p_id, 'c', 'لم تحضر الجلسة', 'يمكنك حجز موعد جديد');
  else
    update public.consultations set state = 'ended', ended_at = now() where id = p_id;
    perform public.consult_push(p_id, 'c', 'انتهت الاستشارة', 'بانتظار ملخص الطبيب');
  end if;
  return 'ok';
end; $$;

create or replace function public.send_consultation_message(p_id uuid, p_body text, p_file_path text default null, p_file_name text default null)
 returns text language plpgsql security definer set search_path to 'public'
as $$
declare c public.consultations; v_role text;
begin
  v_role := public.consult_role(p_id);
  if coalesce(v_role, '') not in ('c', 'd') then return 'forbidden'; end if;
  select * into c from public.consultations where id = p_id;
  if c.state <> 'live' then return 'closed'; end if;
  if now() >= public.consult_end_at(c) then perform public.consultation_touch(p_id); return 'closed'; end if;
  if coalesce(length(trim(p_body)), 0) = 0 and p_file_path is null then return 'empty'; end if;
  insert into public.consultation_messages (consultation_id, sender, body, file_path, file_name)
  values (p_id, v_role, nullif(trim(coalesce(p_body, '')), ''), p_file_path, p_file_name);
  if v_role = 'c' then update public.consultations set client_in_at = coalesce(client_in_at, now()) where id = p_id; end if;
  perform public.consult_push(p_id, case when v_role = 'c' then 'd' else 'c' end,
    case when v_role = 'c' then 'رسالة من المريض' else 'رسالة من الطبيب' end,
    coalesce(left(trim(p_body), 80), '📎 مرفق'));
  return 'ok';
end; $$;

-- ───────── 6. after the session ─────────
create or replace function public.submit_consultation_summary(p_id uuid, p_note text, p_recs text, p_follow text)
 returns text language plpgsql security definer set search_path to 'public'
as $$
begin
  if public.consult_role(p_id) is distinct from 'd' then return 'forbidden'; end if;
  if coalesce(length(trim(p_note)), 0) < 3 then return 'invalid'; end if;
  if p_follow not in ('none', 'week', 'two', 'month') then return 'invalid'; end if;
  update public.consultations set sum_note = trim(p_note), sum_recs = nullif(trim(coalesce(p_recs, '')), ''), sum_follow = p_follow, sum_at = now()
   where id = p_id and state = 'ended' and not no_show and sum_at is null;
  if not found then return 'locked'; end if;
  perform public.consult_push(p_id, 'c', 'ملخص استشارتك جاهز', 'افتح الملخص وقيّم الاستشارة');
  return 'ok';
end; $$;

create or replace function public.rate_consultation(p_id uuid, p_stars int, p_text text default null)
 returns text language plpgsql security definer set search_path to 'public'
as $$
begin
  if public.consult_role(p_id) is distinct from 'c' then return 'forbidden'; end if;
  if p_stars not between 1 and 5 then return 'invalid'; end if;
  update public.consultations set rating = p_stars, rating_text = nullif(trim(coalesce(p_text, '')), '')
   where id = p_id and state = 'ended' and not no_show and sum_at is not null and rating is null;
  if not found then return 'locked'; end if;
  return 'ok';
end; $$;

create or replace function public.admin_approve_rating(p_id uuid)
 returns text language plpgsql security definer set search_path to 'public'
as $$
begin
  if not public.is_admin() then return 'forbidden'; end if;
  update public.consultations set rating_ok = true where id = p_id and rating is not null;
  return 'ok';
end; $$;

-- exceptional refund flag (e.g. client no-show handled as an exception, or doctor never showed up)
create or replace function public.admin_refund_consultation(p_id uuid, p_cancel boolean default false, p_reason text default null)
 returns text language plpgsql security definer set search_path to 'public'
as $$
begin
  if not public.is_admin() then return 'forbidden'; end if;
  update public.consultations
     set refunded = true,
         pay_status = case when p_cancel then 'cancelled' else pay_status end,
         cancel_reason = case when p_cancel then coalesce(nullif(trim(p_reason), ''), 'الطبيب لم يحضر') else cancel_reason end
   where id = p_id and pay_status = 'paid' and state in ('wait', 'ended');
  if not found then return 'locked'; end if;
  if p_cancel then
    perform public.consult_push(p_id, 'c', 'تم إلغاء الاستشارة', coalesce(nullif(trim(p_reason), ''), 'الطبيب لم يحضر') || ' · سيتم رد المبلغ');
  end if;
  return 'ok';
end; $$;

-- admin list with the alert reasons computed on the server
create or replace function public.admin_consultations()
 returns table (id uuid, case_number text, client_name text, client_phone text, provider_name text, provider_specialty text,
                channel text, price numeric, duration_min int, period_date date, period text, pay_method text, pay_status text,
                cancel_reason text, pay_deadline timestamptz, paid_at timestamptz, prop_at timestamptz, prop_status text,
                appt_at timestamptz, state text, started_at timestamptz, ended_at timestamptz, no_show boolean, refunded boolean,
                rating int, rating_text text, rating_ok boolean, created_at timestamptz, alerts text[])
 language sql stable security definer set search_path to 'public'
as $$
  select c.id, c.case_number, c.client_name, cl.phone, p.name, p.specialty,
         c.channel, c.price, c.duration_min, c.period_date, c.period, c.pay_method, c.pay_status,
         c.cancel_reason, c.pay_deadline, c.paid_at, c.prop_at, c.prop_status,
         c.appt_at, c.state, c.started_at, c.ended_at, c.no_show, c.refunded,
         c.rating, c.rating_text, c.rating_ok, c.created_at,
         array_remove(array[
           case when c.pay_status = 'pending' and c.pay_deadline < now() then 'deadline' end,
           case when c.pay_status = 'paid' and c.prop_status = 'none' and c.paid_at < now() - interval '30 minutes' then 'no_proposal' end,
           case when c.prop_status = 'pending' and c.updated_at < now() - interval '30 minutes' then 'client_silent' end,
           case when c.prop_status = 'no' then 'client_rejected' end,
           case when c.state = 'wait' and c.prop_status = 'ok' and c.appt_at + interval '15 minutes' < now() then 'doctor_late' end,
           case when c.rating is not null and not c.rating_ok then 'rating' end,
           case when c.no_show and not c.refunded then 'no_show' end
         ], null)
  from public.consultations c
  join public.clients cl on cl.id = c.client_id
  join public.providers p on p.id = c.provider_id
  where public.is_admin()
  order by c.created_at desc
  limit 300;
$$;

-- ───────── reminders & auto-end (runs every minute via pg_cron) ─────────
create or replace function public.consultations_tick()
 returns void language plpgsql security definer set search_path to 'public', 'extensions'
as $$
declare c public.consultations; v_end timestamptz;
begin
  for c in select * from public.consultations where pay_status = 'paid' and state in ('wait', 'live') loop
    if c.state = 'wait' and c.prop_status = 'ok' then
      if not (c.flags ? 'r30') and now() >= c.appt_at - interval '30 minutes' and now() < c.appt_at then
        perform public.consult_push(c.id, 'd', 'استشارة بعد 30 دقيقة', 'استعد لموعد الاستشارة');
        perform public.consult_push(c.id, 'c', 'استشارتك بعد 30 دقيقة', 'استعد لموعد الاستشارة');
        update public.consultations set flags = flags || '{"r30": true}' where id = c.id;
      end if;
      if not (c.flags ? 'r10') and now() >= c.appt_at - interval '10 minutes' and now() < c.appt_at + interval '15 minutes' then
        perform public.consult_push(c.id, 'd', 'استشارة بعد 10 دقائق', 'تقدر تبدأ الجلسة الآن');
        perform public.consult_push(c.id, 'c', 'استشارتك بعد 10 دقائق', 'استعد، الطبيب هيبدأ قريبًا');
        update public.consultations set flags = flags || '{"r10": true}' where id = c.id;
      end if;
      if not (c.flags ? 'ltd') and now() >= c.appt_at + interval '15 minutes' then
        perform public.consult_push(c.id, 'd', 'تأخرت عن موعد الاستشارة', 'ابدأها الآن');
        perform public.consult_push(c.id, 'c', 'تأخر الطبيب قليلًا', 'الإدارة تتابع');
        update public.consultations set flags = flags || '{"ltd": true}' where id = c.id;
      end if;
    elsif c.state = 'live' then
      v_end := public.consult_end_at(c);
      if now() >= v_end then
        update public.consultations set state = 'ended', ended_at = v_end where id = c.id;
        perform public.consult_push(c.id, 'd', 'انتهت الاستشارة', 'اكتب ملخص الاستشارة');
        perform public.consult_push(c.id, 'c', 'انتهت الاستشارة', 'بانتظار ملخص الطبيب');
      else
        if c.client_in_at is null and not (c.flags ? 'nudge') and now() >= c.started_at + interval '5 minutes' then
          perform public.consult_push(c.id, 'c', 'الطبيب بانتظارك', 'بدأت استشارتك — اضغط للدخول');
          update public.consultations set flags = flags || '{"nudge": true}' where id = c.id;
        end if;
        if not (c.flags ? 'e5') and v_end - now() <= interval '5 minutes' and c.duration_min + c.extra_min > 5 then
          perform public.consult_push(c.id, 'd', 'متبقي 5 دقائق', 'على انتهاء الاستشارة');
          perform public.consult_push(c.id, 'c', 'متبقي 5 دقائق', 'على انتهاء الاستشارة');
          update public.consultations set flags = flags || '{"e5": true}' where id = c.id;
        end if;
      end if;
    end if;
  end loop;
end; $$;
revoke all on function public.consultations_tick() from public, anon, authenticated;

-- schedule it (pg_cron is free on Supabase; enable it under Database → Extensions if this block prints a notice)
do $$ begin
  create extension if not exists pg_cron;
  perform cron.unschedule('consultations-tick') where exists (select 1 from cron.job where jobname = 'consultations-tick');
  perform cron.schedule('consultations-tick', '* * * * *', 'select public.consultations_tick()');
exception when others then
  raise notice 'pg_cron not enabled: enable it in Dashboard → Database → Extensions, then re-run this block. (%)', sqlerrm;
end $$;

-- ───────── grants ─────────
do $$ declare f text; begin
  foreach f in array array[
    'book_consultation(uuid,text,date,text,text)', 'admin_set_payment(uuid,text,text)',
    'propose_consultation_time(uuid,timestamptz)', 'respond_consultation_time(uuid,boolean)',
    'admin_consultation_handled(uuid)', 'start_consultation(uuid)', 'enter_consultation(uuid)',
    'extend_consultation(uuid,int)', 'consultation_touch(uuid)', 'end_consultation(uuid,boolean)',
    'send_consultation_message(uuid,text,text,text)', 'submit_consultation_summary(uuid,text,text,text)',
    'rate_consultation(uuid,int,text)', 'admin_approve_rating(uuid)',
    'admin_refund_consultation(uuid,boolean,text)', 'admin_consultations()', 'consult_role(uuid)'
  ] loop
    execute format('revoke all on function public.%s from public, anon', f);
    execute format('grant execute on function public.%s to authenticated', f);
  end loop;
end $$;
