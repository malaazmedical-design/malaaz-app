-- Test project only. Step 4:
--  * the doctor can change an already confirmed appointment (before the session starts); the client gets a clear push and must accept again
--  * nursing stay options: 12h / 24h (price ranges are editable by the admin in the panel → الأسعار)

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
  if c.appt_at is not null then
    perform public.consult_push(p_id, 'c', 'عدّل الطبيب موعد استشارتك', 'افتح الحجز للموافقة على الموعد الجديد');
  else
    perform public.consult_push(p_id, 'c', 'موعد استشارتك', 'اقترح الطبيب موعدًا — افتح الحجز للموافقة');
  end if;
  return 'ok';
end; $$;
grant execute on function public.propose_consultation_time(uuid, timestamptz) to authenticated;

insert into public.sub_services (service_name, name, group_name, duration, price_min, price_max, is_active)
select 'تمريض منزلي', 'إقامة 12 ساعة', null, '12 ساعة', 600, 900, true
where not exists (select 1 from public.sub_services where service_name = 'تمريض منزلي' and name = 'إقامة 12 ساعة');
insert into public.sub_services (service_name, name, group_name, duration, price_min, price_max, is_active)
select 'تمريض منزلي', 'إقامة 24 ساعة', null, '24 ساعة', 700, 1800, true
where not exists (select 1 from public.sub_services where service_name = 'تمريض منزلي' and name = 'إقامة 24 ساعة');
