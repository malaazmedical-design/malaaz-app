-- Test project only. After a consultation ends, remind the doctor to write the summary if it is still missing:
--   10 minutes after the end and again after 1 hour (one push each). Runs every minute with pg_cron.
create or replace function public.consultations_summary_tick()
 returns void language plpgsql security definer set search_path to 'public', 'extensions'
as $$
declare c public.consultations;
begin
  for c in select * from public.consultations
            where state = 'ended' and not no_show and sum_at is null and pay_status = 'paid'
              and ended_at > now() - interval '3 days' loop
    if not (c.flags ? 'sm10') and now() >= c.ended_at + interval '10 minutes' then
      perform public.consult_push(c.id, 'd', 'ملخص الاستشارة مطلوب', 'اكتب ملخص الاستشارة ليصل للمريض');
      update public.consultations set flags = flags || '{"sm10": true}' where id = c.id;
    elsif c.flags ? 'sm10' and not (c.flags ? 'sm60') and now() >= c.ended_at + interval '1 hour' then
      perform public.consult_push(c.id, 'd', 'تذكير: ملخص الاستشارة', 'المريض بانتظار ملخص استشارتك');
      update public.consultations set flags = flags || '{"sm60": true}' where id = c.id;
    end if;
  end loop;
end; $$;
revoke all on function public.consultations_summary_tick() from public, anon, authenticated;

do $$ begin
  begin perform cron.unschedule('consultations-summary-tick'); exception when others then null; end;
  perform cron.schedule('consultations-summary-tick', '* * * * *', 'select public.consultations_summary_tick()');
end $$;
