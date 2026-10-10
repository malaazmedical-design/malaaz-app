-- Test project only. Two more reminders around the appointment (consultations_tick):
--   * 'at'  : the moment the appointment time arrives  -> "حان موعد استشارتك" (doctor + client)
--   * 'l5'  : 5 minutes after the time and the session still not started -> reminder again
-- (the existing r30, r10 and the 15-minute "late" notice stay as they are)
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
      -- the appointment time has arrived
      if not (c.flags ? 'at') and now() >= c.appt_at and now() < c.appt_at + interval '15 minutes' then
        perform public.consult_push(c.id, 'd', 'حان موعد الاستشارة', 'اضغط لبدء الجلسة الآن');
        perform public.consult_push(c.id, 'c', 'حان موعد استشارتك', 'الطبيب هيبدأ الجلسة، ابقَ جاهزًا');
        update public.consultations set flags = flags || '{"at": true}' where id = c.id;
      end if;
      -- still not started 5 minutes later
      if not (c.flags ? 'l5') and now() >= c.appt_at + interval '5 minutes' and now() < c.appt_at + interval '15 minutes' then
        perform public.consult_push(c.id, 'd', 'لم تبدأ الاستشارة بعد', 'المريض بانتظارك — ابدأ الجلسة الآن');
        perform public.consult_push(c.id, 'c', 'الاستشارة لم تبدأ بعد', 'الطبيب هيبدأ قريبًا، ابقَ جاهزًا');
        update public.consultations set flags = flags || '{"l5": true}' where id = c.id;
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
