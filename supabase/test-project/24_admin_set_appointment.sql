-- Test project only. Admin can set / change a consultation's appointment to ANY time (no period limit).
-- The new time is confirmed directly (both sides are notified); the doctor/patient proposal flow keeps its own rules.
create or replace function public.admin_set_appointment(p_id uuid, p_at timestamptz)
 returns text language plpgsql security definer set search_path to 'public'
as $$
declare c public.consultations;
begin
  if not public.is_admin() then return 'forbidden'; end if;
  select * into c from public.consultations where id = p_id for update;
  if c.id is null then return 'forbidden'; end if;
  if c.pay_status <> 'paid' or c.state <> 'wait' then return 'locked'; end if;
  if p_at < now() - interval '1 minute' then return 'past'; end if;
  update public.consultations
     set appt_at = p_at, prop_at = p_at, prop_status = 'ok', flags = '{}'::jsonb, admin_contacted_at = null
   where id = p_id;
  perform public.consult_push(p_id, 'c', 'تم تحديد موعد استشارتك', 'حددت الإدارة موعدًا جديدًا — افتح الحجز');
  perform public.consult_push(p_id, 'd', 'موعد استشارة جديد', 'حددت الإدارة موعدًا لاستشارة — افتح الحجز');
  return 'ok';
end; $$;
revoke all on function public.admin_set_appointment(uuid, timestamptz) from public, anon;
grant execute on function public.admin_set_appointment(uuid, timestamptz) to authenticated;
