-- Test project only. Admin panel improvements (step 6):
--  * "doctor contacted" for a late doctor (admin_doctor_contacted) — clears the red alert, pushes both sides
--  * admin_consultations() also returns admin_contacted_at
--  * governorates: only admins may write (the original policy let ANY signed-in user edit them)

alter table public.consultations add column if not exists admin_contacted_at timestamptz;

create or replace function public.admin_doctor_contacted(p_id uuid)
 returns text language plpgsql security definer set search_path to 'public'
as $$
begin
  if not public.is_admin() then return 'forbidden'; end if;
  update public.consultations set admin_contacted_at = now()
   where id = p_id and state = 'wait' and prop_status = 'ok' and admin_contacted_at is null;
  if not found then return 'locked'; end if;
  perform public.consult_push(p_id, 'd', 'تواصلت معك الإدارة', 'بخصوص موعد الاستشارة المتأخر — افتح الحجز');
  perform public.consult_push(p_id, 'c', 'تواصلنا مع الطبيب', 'نتابع موعد استشارتك مع الطبيب الآن');
  return 'ok';
end; $$;
revoke all on function public.admin_doctor_contacted(uuid) from public, anon;
grant execute on function public.admin_doctor_contacted(uuid) to authenticated;

drop function if exists public.admin_consultations();
create or replace function public.admin_consultations()
 returns table (id uuid, case_number text, client_name text, client_phone text, provider_name text, provider_specialty text,
                channel text, price numeric, duration_min int, period_date date, period text, pay_method text, pay_status text,
                cancel_reason text, pay_deadline timestamptz, paid_at timestamptz, prop_at timestamptz, prop_status text,
                appt_at timestamptz, state text, started_at timestamptz, ended_at timestamptz, no_show boolean, refunded boolean,
                rating int, rating_text text, rating_ok boolean, created_at timestamptz, alerts text[], admin_contacted_at timestamptz)
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
           case when c.state = 'wait' and c.prop_status = 'ok' and c.appt_at + interval '15 minutes' < now() and c.admin_contacted_at is null then 'doctor_late' end,
           case when c.rating is not null and not c.rating_ok then 'rating' end,
           case when c.no_show and not c.refunded then 'no_show' end
         ], null),
         c.admin_contacted_at
  from public.consultations c
  join public.clients cl on cl.id = c.client_id
  join public.providers p on p.id = c.provider_id
  where public.is_admin()
  order by c.created_at desc
  limit 300;
$$;
revoke all on function public.admin_consultations() from public, anon;
grant execute on function public.admin_consultations() to authenticated;

-- governorates: read for everyone, write for admins only
drop policy if exists "Allow auth all" on public.governorates;
drop policy if exists admin_all_governorates on public.governorates;
create policy admin_all_governorates on public.governorates as permissive for all to authenticated
  using (exists (select 1 from public.admin_users where admin_users.user_id = auth.uid()))
  with check (exists (select 1 from public.admin_users where admin_users.user_id = auth.uid()));
drop policy if exists governorates_read_auth on public.governorates;
create policy governorates_read_auth on public.governorates as permissive for select to authenticated using (true);
