-- Test project only. The session clock starts only when someone really ENTERS:
--   * the doctor taps "start"  -> the session is OPENED (state live, opened_at) but the clock does not run;
--   * the first side that enters (chat room open, joined the call, or sent a message) starts the clock (started_at);
--   * nobody enters within 30 minutes of opening -> the session closes (no-show), both sides are told.
alter table public.consultations add column if not exists opened_at timestamptz;
alter table public.consultations add column if not exists doctor_in_at timestamptz;
update public.consultations set opened_at = started_at where opened_at is null and started_at is not null;

create or replace function public.start_consultation(p_id uuid)
 returns text language plpgsql security definer set search_path to 'public'
as $$
declare c public.consultations;
begin
  select * into c from public.consultations where id = p_id for update;
  if c.id is null or public.consult_role(p_id) is distinct from 'd' then return 'forbidden'; end if;
  if c.pay_status <> 'paid' or c.prop_status <> 'ok' or c.state <> 'wait' then return 'locked'; end if;
  if now() < c.appt_at - interval '10 minutes' then return 'early'; end if;
  update public.consultations set state = 'live', opened_at = now(), started_at = null, flags = '{}'::jsonb where id = p_id;
  perform public.consult_push(p_id, 'c', 'بدأت استشارتك', 'بدأ الطبيب الاستشارة — اضغط للدخول');
  return 'ok';
end; $$;

-- either side entering starts the clock (first one wins)
create or replace function public.enter_consultation(p_id uuid)
 returns void language plpgsql security definer set search_path to 'public'
as $$
declare v_role text;
begin
  v_role := public.consult_role(p_id);
  if coalesce(v_role, '') not in ('c', 'd') then return; end if;
  if v_role = 'c' then
    update public.consultations set client_in_at = coalesce(client_in_at, now()) where id = p_id and state = 'live';
  else
    update public.consultations set doctor_in_at = coalesce(doctor_in_at, now()) where id = p_id and state = 'live';
  end if;
  update public.consultations set started_at = now() where id = p_id and state = 'live' and started_at is null;
end; $$;
grant execute on function public.enter_consultation(uuid) to authenticated;

create or replace function public.end_consultation(p_id uuid, p_no_show boolean default false)
 returns text language plpgsql security definer set search_path to 'public'
as $$
declare c public.consultations;
begin
  select * into c from public.consultations where id = p_id for update;
  if c.id is null or public.consult_role(p_id) is distinct from 'd' then return 'forbidden'; end if;
  if c.state <> 'live' then return 'locked'; end if;
  if p_no_show then
    if c.client_in_at is not null or now() < coalesce(c.opened_at, c.started_at, now()) + interval '10 minutes' then return 'too_early'; end if;
    update public.consultations set state = 'ended', ended_at = now(), no_show = true where id = p_id;
    perform public.consult_push(p_id, 'c', 'لم تحضر الجلسة', 'يمكنك حجز موعد جديد');
  else
    update public.consultations set state = 'ended', ended_at = now() where id = p_id;
    perform public.consult_push(p_id, 'c', 'انتهت الاستشارة', 'بانتظار ملخص الطبيب');
  end if;
  return 'ok';
end; $$;

-- sending a message also counts as entering
create or replace function public.send_consultation_message(p_id uuid, p_body text, p_file_path text default null, p_file_name text default null)
 returns text language plpgsql security definer set search_path to 'public'
as $$
declare c public.consultations; v_role text;
begin
  v_role := public.consult_role(p_id);
  if coalesce(v_role, '') not in ('c', 'd') then return 'forbidden'; end if;
  select * into c from public.consultations where id = p_id;
  if c.state <> 'live' then return 'closed'; end if;
  if c.started_at is not null and now() >= public.consult_end_at(c) then perform public.consultation_touch(p_id); return 'closed'; end if;
  if coalesce(length(trim(p_body)), 0) = 0 and p_file_path is null then return 'empty'; end if;
  insert into public.consultation_messages (consultation_id, sender, body, file_path, file_name)
  values (p_id, v_role, nullif(trim(coalesce(p_body, '')), ''), p_file_path, p_file_name);
  perform public.enter_consultation(p_id);
  perform public.consult_push(p_id, case when v_role = 'c' then 'd' else 'c' end,
    case when v_role = 'c' then 'رسالة من المريض' else 'رسالة من الطبيب' end,
    coalesce(left(trim(p_body), 80), '📎 مرفق'));
  return 'ok';
end; $$;

-- a call token can be issued before the clock starts (valid for the whole session length)
create or replace function public.consult_call_access(p_id uuid)
 returns table (role text, channel text, state text, ends_at timestamptz, display_name text, rtc_ok boolean)
 language sql stable security definer set search_path to 'public'
as $$
  select public.consult_role(c.id), c.channel, c.state,
         coalesce(public.consult_end_at(c), now() + make_interval(mins => c.duration_min + c.extra_min)),
         case when public.consult_role(c.id) = 'd' then 'الطبيب' else coalesce(c.client_name, 'المريض') end,
         (select available from public.rtc_status())
  from public.consultations c
  where c.id = p_id and public.consult_role(c.id) in ('c', 'd');
$$;
grant execute on function public.consult_call_access(uuid) to authenticated;

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
      if v_end is null then
        -- opened by the doctor but nobody has entered yet: the clock has not started
        if c.client_in_at is null and not (c.flags ? 'nudge') and now() >= coalesce(c.opened_at, now()) + interval '5 minutes' then
          perform public.consult_push(c.id, 'c', 'الطبيب بانتظارك', 'بدأت استشارتك — اضغط للدخول');
          update public.consultations set flags = flags || '{"nudge": true}' where id = c.id;
        end if;
        if now() >= coalesce(c.opened_at, now()) + interval '30 minutes' then
          update public.consultations set state = 'ended', ended_at = now(), no_show = true where id = c.id;
          perform public.consult_push(c.id, 'd', 'انتهت الجلسة', 'لم يدخل أحد الجلسة خلال 30 دقيقة');
          perform public.consult_push(c.id, 'c', 'انتهت الجلسة', 'لم يدخل أحد الجلسة خلال 30 دقيقة');
        end if;
      elsif now() >= v_end then
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
