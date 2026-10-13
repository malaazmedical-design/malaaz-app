-- Doctor-first online consultation flow (test project, then merged into the original through build.py):
--   1. client requests  -> doctor gets a push and must accept (with a time) or decline
--   2. accepted         -> the doctor's time goes to the client, who accepts it
--   3. client accepted  -> the client pays (instapay / wallet), admin confirms the payment
--   4. paid             -> the session starts at its time (all the existing reminders / start logic)
--   declined / no reply -> client + admin are notified; the client picks another doctor or the admin assigns one
-- Rows that already exist keep working: they default to doctor_status = 'accepted'.

alter table public.consultations add column if not exists doctor_status text not null default 'accepted';
alter table public.consultations add column if not exists doctor_status_at timestamptz;
alter table public.consultations add column if not exists req_reminded_at timestamptz;
alter table public.consultations add column if not exists prev_provider_id uuid;
do $$ begin
  alter table public.consultations add constraint consultations_doctor_status_chk
    check (doctor_status in ('pending', 'accepted', 'declined', 'expired'));
exception when duplicate_object then null; end $$;

-- price + length of a channel for one doctor (null price = the doctor does not offer it)
create or replace function public.consult_offer(p_provider uuid, p_channel text)
 returns table (price numeric, duration_min int)
 language plpgsql stable security definer set search_path to 'public'
as $$
begin
  if p_channel = 'chat' then
    return query select ps.custom_price, coalesce(ps.duration_min, 15)
      from public.provider_services ps join public.sub_services s on s.id = ps.sub_service_id
     where ps.provider_id = p_provider and s.group_name = 'online' and coalesce(ps.is_active, true) limit 1;
  else
    return query select pc.price, pc.duration_min
      from public.provider_channels pc where pc.provider_id = p_provider and pc.channel = p_channel and pc.is_active;
  end if;
end; $$;
revoke all on function public.consult_offer(uuid, text) from public, anon, authenticated;

-- ───────── 1. client requests: the doctor is told at once, no payment yet ─────────
create or replace function public.book_consultation(p_provider uuid, p_channel text, p_date date, p_period text, p_pay_method text)
 returns uuid language plpgsql security definer set search_path to 'public'
as $$
declare
  v_client public.clients; v_prov public.providers; v_price numeric; v_dur int;
  v_today date := (now() at time zone 'Africa/Cairo')::date;
  v_id uuid; v_rtc record;
begin
  select * into v_client from public.clients where auth_id = auth.uid() limit 1;
  if v_client.id is null then raise exception 'سجّل دخولك أولاً'; end if;
  if p_channel not in ('chat', 'voice', 'video') then raise exception 'اختر القناة'; end if;
  if p_channel in ('voice', 'video') then
    select * into v_rtc from public.rtc_status();
    if not v_rtc.enabled then raise exception 'هذه القناة غير متاحة حاليًا'; end if;
    if not v_rtc.available then raise exception 'الصوت والفيديو متوقفان مؤقتًا، يمكنك الحجز بالشات'; end if;
  end if;
  if p_pay_method not in ('wallet', 'instapay') then raise exception 'اختر طريقة الدفع'; end if;
  if p_period not in ('morning', 'noon', 'evening', 'asap') then raise exception 'اختر الفترة'; end if;

  select * into v_prov from public.providers where id = p_provider and status = 'active';
  if v_prov.id is null then raise exception 'مقدم الخدمة غير متاح'; end if;
  if not public.provider_offers_online(p_provider) then raise exception 'الطبيب لا يقدم استشارة أونلاين حاليًا'; end if;

  select o.price, o.duration_min into v_price, v_dur from public.consult_offer(p_provider, p_channel) o;
  if v_price is null then raise exception 'الطبيب لا يقدم هذه القناة حاليًا'; end if;

  if p_period = 'asap' then
    p_date := v_today;
  else
    if p_date < v_today or p_date > v_today + 7 then raise exception 'اختر يومًا خلال الأسبوع القادم'; end if;
    if public.consult_period_end(p_date, p_period) < now() + interval '30 minutes' then raise exception 'هذه الفترة انتهت، اختر فترة أخرى'; end if;
  end if;

  -- pay_deadline stays empty until the client accepts the doctor's time
  insert into public.consultations (client_id, provider_id, client_name, channel, price, duration_min, period_date, period, pay_method,
                                    pay_deadline, doctor_status, doctor_status_at)
  values (v_client.id, p_provider, v_client.name, p_channel, v_price, v_dur, p_date, p_period, p_pay_method, null, 'pending', now())
  returning id into v_id;

  perform public.consult_push(v_id, 'd', '🩺 طلب استشارة جديد',
    concat_ws(' · ', v_client.name, case p_channel when 'voice' then 'صوت' when 'video' then 'فيديو' else 'شات' end));
  return v_id;
end; $$;
revoke all on function public.book_consultation(uuid, text, date, text, text) from public, anon;
grant execute on function public.book_consultation(uuid, text, date, text, text) to authenticated;

-- ───────── 2. doctor proposes the time (this is also how he accepts) ─────────
create or replace function public.propose_consultation_time(p_id uuid, p_at timestamptz)
 returns text language plpgsql security definer set search_path to 'public'
as $$
declare c public.consultations;
begin
  select * into c from public.consultations where id = p_id for update;
  if c.id is null or public.consult_role(p_id) is distinct from 'd' then return 'forbidden'; end if;
  if c.doctor_status not in ('pending', 'accepted') or c.pay_status = 'cancelled' or c.state <> 'wait' then return 'locked'; end if;
  if c.prop_status = 'pending' then return 'pending'; end if;
  if p_at < now() + interval '5 minutes' then return 'past'; end if;
  if c.period = 'asap' then
    if p_at > now() + interval '12 hours' then return 'outside'; end if;
  elsif p_at < public.consult_period_start(c.period_date, c.period) or p_at >= public.consult_period_end(c.period_date, c.period) then
    return 'outside';
  end if;
  update public.consultations
     set prop_at = p_at, prop_status = 'pending', appt_at = null, flags = '{}'::jsonb,
         doctor_status = 'accepted', doctor_status_at = case when doctor_status = 'accepted' then doctor_status_at else now() end
   where id = p_id;
  if c.appt_at is not null then
    perform public.consult_push(p_id, 'c', 'تعديل الموعد', 'الطبيب عدّل موعد استشارتك');
  elsif c.doctor_status = 'pending' then
    perform public.consult_push(p_id, 'c', '✅ وافق الطبيب', 'وافق على استشارتك وحدد موعدًا');
  else
    perform public.consult_push(p_id, 'c', 'موعد جديد', 'اقترح الطبيب موعدًا');
  end if;
  return 'ok';
end; $$;
revoke all on function public.propose_consultation_time(uuid, timestamptz) from public, anon;
grant execute on function public.propose_consultation_time(uuid, timestamptz) to authenticated;

-- doctor: decline (p_accept = false) or accept with a time (same checks as propose_consultation_time)
create or replace function public.respond_consultation_request(p_id uuid, p_accept boolean, p_at timestamptz default null)
 returns text language plpgsql security definer set search_path to 'public'
as $$
declare c public.consultations; v_doc text;
begin
  select * into c from public.consultations where id = p_id for update;
  if c.id is null or public.consult_role(p_id) is distinct from 'd' then return 'forbidden'; end if;
  if c.doctor_status <> 'pending' or c.pay_status = 'cancelled' or c.state <> 'wait' then return 'locked'; end if;
  if p_accept then
    if p_at is null then return 'need_time'; end if;
    return public.propose_consultation_time(p_id, p_at);
  end if;
  update public.consultations set doctor_status = 'declined', doctor_status_at = now() where id = p_id;
  select name into v_doc from public.providers where id = c.provider_id;
  perform public.consult_push(p_id, 'c', 'الطبيب اعتذر', 'اختر طبيبًا آخر');
  perform public.notify_admin('⚠️ طبيب اعتذر عن استشارة',
    concat_ws(' · ', v_doc, c.case_number, c.client_name, 'اختر طبيبًا بديلًا'),
    jsonb_build_object('kind', 'admin_consultation', 'consultation_id', p_id));
  return 'ok';
end; $$;
revoke all on function public.respond_consultation_request(uuid, boolean, timestamptz) from public, anon;
grant execute on function public.respond_consultation_request(uuid, boolean, timestamptz) to authenticated;

-- ───────── 3. client accepts the time -> payment starts ─────────
create or replace function public.respond_consultation_time(p_id uuid, p_accept boolean)
 returns text language plpgsql security definer set search_path to 'public'
as $$
declare c public.consultations; v_deadline timestamptz;
begin
  select * into c from public.consultations where id = p_id for update;
  if c.id is null or public.consult_role(p_id) is distinct from 'c' then return 'forbidden'; end if;
  if c.prop_status <> 'pending' or c.state <> 'wait' then return 'locked'; end if;
  if p_accept then
    -- payment window: until 30 minutes before the session, at least 20 minutes and at most 2 hours from now
    v_deadline := greatest(least(c.prop_at - interval '30 minutes', now() + interval '2 hours'), now() + interval '20 minutes');
    update public.consultations
       set prop_status = 'ok', appt_at = prop_at,
           pay_deadline = case when pay_status = 'pending' then v_deadline else pay_deadline end
     where id = p_id;
    if c.pay_status = 'pending' then
      perform public.consult_push(p_id, 'c', 'في انتظار الدفع', 'تم اعتماد الموعد');
      perform public.consult_push(p_id, 'd', 'وافق المريض على الموعد', 'في انتظار الدفع');
    else
      perform public.consult_push(p_id, 'd', 'وافق المريض على الموعد', 'تم اعتماد الموعد');
    end if;
  else
    update public.consultations set prop_status = 'no' where id = p_id;
    perform public.consult_push(p_id, 'd', 'المريض لا يناسبه الموعد', 'الإدارة هتتواصل معه');
  end if;
  return 'ok';
end; $$;
revoke all on function public.respond_consultation_time(uuid, boolean) from public, anon;
grant execute on function public.respond_consultation_time(uuid, boolean) to authenticated;

-- ───────── 4. admin confirms the payment (only once the time is agreed) ─────────
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
    if c.pay_status = 'cancelled' then return 'locked'; end if;
    if c.doctor_status <> 'accepted' or c.prop_status <> 'ok' then return 'not_ready'; end if;
    update public.consultations set pay_status = 'paid', paid_at = now(), cancel_reason = null where id = p_id;
    perform public.consult_push(p_id, 'd', 'تم تأكيد الدفع', 'الاستشارة مؤكدة');
    perform public.consult_push(p_id, 'c', 'تم تأكيد الدفع', 'استشارتك مؤكدة');
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
revoke all on function public.admin_set_payment(uuid, text, text) from public, anon;
grant execute on function public.admin_set_payment(uuid, text, text) to authenticated;

-- admin sets / changes the appointment directly (the doctor must have accepted; payment may still be pending)
create or replace function public.admin_set_appointment(p_id uuid, p_at timestamptz)
 returns text language plpgsql security definer set search_path to 'public'
as $$
declare c public.consultations;
begin
  if not public.is_admin() then return 'forbidden'; end if;
  select * into c from public.consultations where id = p_id for update;
  if c.id is null then return 'forbidden'; end if;
  if c.pay_status = 'cancelled' or c.doctor_status <> 'accepted' or c.state <> 'wait' then return 'locked'; end if;
  if p_at < now() - interval '1 minute' then return 'past'; end if;
  update public.consultations
     set appt_at = p_at, prop_at = p_at, prop_status = 'ok', flags = '{}'::jsonb, admin_contacted_at = null,
         pay_deadline = case when pay_status = 'pending'
                             then greatest(least(p_at - interval '30 minutes', now() + interval '2 hours'), now() + interval '20 minutes')
                             else pay_deadline end
   where id = p_id;
  perform public.consult_push(p_id, 'c', 'تم تحديد الموعد',
    case when c.pay_status = 'pending' then 'في انتظار الدفع' else 'تم تعديل الموعد' end);
  perform public.consult_push(p_id, 'd', 'تم تحديد الموعد', 'حددت الإدارة موعد استشارة');
  return 'ok';
end; $$;
revoke all on function public.admin_set_appointment(uuid, timestamptz) from public, anon;
grant execute on function public.admin_set_appointment(uuid, timestamptz) to authenticated;

-- ───────── 5. declined / expired: another doctor (the client chooses, or the admin) ─────────
create or replace function public.consult_hand_over(p_id uuid, p_provider uuid)
 returns text language plpgsql security definer set search_path to 'public'
as $$
declare c public.consultations; v_price numeric; v_dur int; v_name text;
begin
  select * into c from public.consultations where id = p_id for update;
  if c.id is null then return 'missing'; end if;
  if c.doctor_status not in ('declined', 'expired') or c.pay_status = 'cancelled' or c.state <> 'wait' then return 'locked'; end if;
  if p_provider = c.provider_id then return 'same'; end if;
  if not exists (select 1 from public.providers where id = p_provider and status = 'active') then return 'unavailable'; end if;
  if not public.provider_offers_online(p_provider) then return 'unavailable'; end if;
  select o.price, o.duration_min into v_price, v_dur from public.consult_offer(p_provider, c.channel) o;
  if v_price is null then return 'unavailable'; end if;
  -- a period that has already passed cannot be kept
  if c.period <> 'asap' and public.consult_period_end(c.period_date, c.period) < now() + interval '30 minutes' then return 'period_over'; end if;
  update public.consultations
     set prev_provider_id = provider_id, provider_id = p_provider, price = v_price, duration_min = v_dur,
         doctor_status = 'pending', doctor_status_at = now(), req_reminded_at = null,
         prop_at = null, prop_status = 'none', appt_at = null, pay_deadline = null, flags = '{}'::jsonb
   where id = p_id;
  select name into v_name from public.providers where id = p_provider;
  perform public.consult_push(p_id, 'd', '🩺 طلب استشارة جديد',
    concat_ws(' · ', c.client_name, case c.channel when 'voice' then 'صوت' when 'video' then 'فيديو' else 'شات' end));
  perform public.consult_push(p_id, 'c', 'تم تحويل طلبك لطبيب آخر', concat('بانتظار رد ', v_name));
  return 'ok';
end; $$;
revoke all on function public.consult_hand_over(uuid, uuid) from public, anon, authenticated;

create or replace function public.client_change_doctor(p_id uuid, p_provider uuid)
 returns text language plpgsql security definer set search_path to 'public'
as $$
begin
  if public.consult_role(p_id) is distinct from 'c' then return 'forbidden'; end if;
  return public.consult_hand_over(p_id, p_provider);
end; $$;
revoke all on function public.client_change_doctor(uuid, uuid) from public, anon;
grant execute on function public.client_change_doctor(uuid, uuid) to authenticated;

create or replace function public.admin_reassign_consultation(p_id uuid, p_provider uuid)
 returns text language plpgsql security definer set search_path to 'public'
as $$
begin
  if not public.is_admin() then return 'forbidden'; end if;
  return public.consult_hand_over(p_id, p_provider);
end; $$;
revoke all on function public.admin_reassign_consultation(uuid, uuid) from public, anon;
grant execute on function public.admin_reassign_consultation(uuid, uuid) to authenticated;

-- doctors who offer the channel of this consultation (admin picker); the client picks from the normal doctors list
create or replace function public.admin_reassign_candidates(p_id uuid)
 returns table (id uuid, name text, specialty text, price numeric)
 language sql stable security definer set search_path to 'public'
as $$
  select p.id, p.name, p.specialty, o.price
    from public.consultations c
    join public.providers p on p.status = 'active' and p.id <> c.provider_id
    cross join lateral public.consult_offer(p.id, c.channel) o
   where public.is_admin() and c.id = p_id and o.price is not null and public.provider_offers_online(p.id)
   order by p.name;
$$;
revoke all on function public.admin_reassign_candidates(uuid) from public, anon;
grant execute on function public.admin_reassign_candidates(uuid) to authenticated;

-- ───────── 6. no reply: reminder after 30 minutes, expiry after 2 hours ─────────
create or replace function public.consultation_requests_tick()
 returns void language plpgsql security definer set search_path to 'public', 'extensions'
as $$
declare c public.consultations; v_doc text;
begin
  for c in select * from public.consultations
            where doctor_status = 'pending' and pay_status = 'pending' and state = 'wait' loop
    if now() >= coalesce(c.doctor_status_at, c.created_at) + interval '2 hours' then
      update public.consultations set doctor_status = 'expired', doctor_status_at = now() where id = c.id;
      select name into v_doc from public.providers where id = c.provider_id;
      perform public.consult_push(c.id, 'c', 'الطبيب لم يرد', 'اختر طبيبًا آخر');
      perform public.consult_push(c.id, 'd', 'انتهت مهلة الطلب', 'لم يتم الرد خلال ساعتين');
      perform public.notify_admin('⚠️ طبيب لم يرد على استشارة',
        concat_ws(' · ', v_doc, c.case_number, c.client_name, 'اختر طبيبًا بديلًا'),
        jsonb_build_object('kind', 'admin_consultation', 'consultation_id', c.id));
    elsif c.req_reminded_at is null and now() >= coalesce(c.doctor_status_at, c.created_at) + interval '30 minutes' then
      update public.consultations set req_reminded_at = now() where id = c.id;
      perform public.consult_push(c.id, 'd', '⏰ طلب بانتظار ردك', 'المريض ينتظر ردك');
    end if;
  end loop;
end; $$;
revoke all on function public.consultation_requests_tick() from public, anon, authenticated;

-- ───────── 7. admin list: doctor status + new alerts ─────────
drop function if exists public.admin_consultations();
create or replace function public.admin_consultations()
 returns table (id uuid, case_number text, client_name text, client_phone text, provider_name text, provider_specialty text,
                channel text, price numeric, duration_min int, period_date date, period text, pay_method text, pay_status text,
                cancel_reason text, pay_deadline timestamptz, paid_at timestamptz, prop_at timestamptz, prop_status text,
                appt_at timestamptz, state text, started_at timestamptz, ended_at timestamptz, no_show boolean, refunded boolean,
                rating int, rating_text text, rating_ok boolean, created_at timestamptz, alerts text[], admin_contacted_at timestamptz,
                sum_note text, sum_recs text, sum_follow text, sum_at timestamptz, rating_hidden boolean,
                doctor_status text, prev_provider_name text)
 language sql stable security definer set search_path to 'public'
as $$
  select c.id, c.case_number, c.client_name, cl.phone, p.name, p.specialty,
         c.channel, c.price, c.duration_min, c.period_date, c.period, c.pay_method, c.pay_status,
         c.cancel_reason, c.pay_deadline, c.paid_at, c.prop_at, c.prop_status,
         c.appt_at, c.state, c.started_at, c.ended_at, c.no_show, c.refunded,
         c.rating, c.rating_text, c.rating_ok, c.created_at,
         array_remove(array[
           case when c.pay_status = 'pending' and c.doctor_status in ('declined', 'expired') then 'doctor_' || c.doctor_status end,
           case when c.pay_status = 'pending' and c.doctor_status = 'pending' and coalesce(c.doctor_status_at, c.created_at) < now() - interval '30 minutes' then 'doctor_silent' end,
           case when c.pay_status = 'pending' and c.prop_status = 'ok' and c.pay_deadline < now() then 'deadline' end,
           case when c.pay_status = 'pending' and c.doctor_status = 'accepted' and c.prop_status = 'none' and coalesce(c.doctor_status_at, c.created_at) < now() - interval '30 minutes' then 'no_proposal' end,
           case when c.prop_status = 'pending' and c.updated_at < now() - interval '30 minutes' then 'client_silent' end,
           case when c.prop_status = 'no' then 'client_rejected' end,
           case when c.state = 'wait' and c.prop_status = 'ok' and c.pay_status = 'paid' and c.appt_at + interval '15 minutes' < now() and c.admin_contacted_at is null then 'doctor_late' end,
           case when c.rating is not null and not c.rating_ok and not c.rating_hidden then 'rating' end,
           case when c.no_show and not c.refunded then 'no_show' end
         ], null),
         c.admin_contacted_at, c.sum_note, c.sum_recs, c.sum_follow, c.sum_at, c.rating_hidden,
         c.doctor_status, (select pp.name from public.providers pp where pp.id = c.prev_provider_id)
  from public.consultations c
  join public.clients cl on cl.id = c.client_id
  join public.providers p on p.id = c.provider_id
  where public.is_admin()
  order by c.created_at desc
  limit 300;
$$;
revoke all on function public.admin_consultations() from public, anon;
grant execute on function public.admin_consultations() to authenticated;

-- admin push for a new request now says who has to answer first
create or replace function public.notify_admin_new_consultation()
 returns trigger language plpgsql security definer set search_path to 'public', 'extensions'
as $$
declare v_prov text;
begin
  select name into v_prov from public.providers where id = new.provider_id;
  perform public.notify_admin('💬 استشارة أونلاين جديدة',
    concat_ws(' · ', new.case_number, new.client_name, case new.channel when 'voice' then 'صوت' when 'video' then 'فيديو' else 'شات' end,
              v_prov, new.price || ' ج.م', 'بانتظار رد الدكتور'),
    jsonb_build_object('kind', 'admin_consultation', 'consultation_id', new.id));
  return new;
end; $$;

do $$ begin
  begin perform cron.unschedule('consultation-requests-tick'); exception when others then null; end;
  perform cron.schedule('consultation-requests-tick', '* * * * *', 'select public.consultation_requests_tick()');
end $$;
