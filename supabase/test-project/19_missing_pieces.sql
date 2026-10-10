-- Test project only.
-- 1) "ask a doctor": unanswered questions expire after 48h (client is told, doctors stop seeing them)
-- 2) nursing / x-ray priced services (admin range) so the provider's "My services & prices" cards have data

create or replace function public.ask_expire_tick()
 returns int language plpgsql security definer set search_path to 'public', 'extensions'
as $$
declare r record; n int := 0; v_phone text;
begin
  for r in
    update public.ask_doctor_cases c set status = 'expired'
     where c.status in ('new', 'routed') and c.assigned_doctor_id is null and c.created_at < now() - interval '48 hours'
    returning c.id, c.client_id, c.patient_phone
  loop
    n := n + 1;
    select phone into v_phone from public.clients where id = r.client_id;
    perform public.send_expo_push(public.client_push_tokens(coalesce(v_phone, r.patient_phone)),
      'انتهت مهلة سؤالك', 'لم يرد طبيب على سؤالك — تقدر تسأل من جديد أو تحجز استشارة',
      jsonb_build_object('kind', 'ask_answer', 'case_id', r.id));
  end loop;
  return n;
end; $$;
revoke all on function public.ask_expire_tick() from public, anon, authenticated;

do $$ begin
  begin perform cron.unschedule('ask-expire-tick'); exception when others then null; end;
  perform cron.schedule('ask-expire-tick', '*/15 * * * *', 'select public.ask_expire_tick()');
end $$;

-- nursing: quick service
insert into public.sub_services (service_name, name, group_name, duration, price_min, price_max, is_active)
select 'تمريض منزلي', 'خدمة سريعة', null, '30 دقيقة', 200, 700, true
where not exists (select 1 from public.sub_services where service_name = 'تمريض منزلي' and name = 'خدمة سريعة');

-- x-ray
insert into public.sub_services (service_name, name, group_name, duration, price_min, price_max, is_active)
select 'أشعة منزلية', v.n, null, null, v.mn, v.mx, true
from (values ('أشعة سينية', 200, 350), ('موجات صوتية', 350, 600), ('تخطيط قلب', 150, 300)) as v(n, mn, mx)
where not exists (select 1 from public.sub_services s where s.service_name = 'أشعة منزلية' and s.name = v.n);
