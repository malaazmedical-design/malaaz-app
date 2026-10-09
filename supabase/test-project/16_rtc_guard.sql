-- Test project only. Voice/video usage guard (prepares phase 4):
--  * app_settings: rtc_enabled (turned on when voice/video ship), rtc_monthly_limit_min (free plan = 5000 participant-minutes),
--    rtc_alert_pct (admin warning level), rtc_stop_pct (hide voice/video before the hard cap is hit)
--  * rtc_usage(): participant-minutes used this month (2 people per call) from the consultations table
--  * rtc_status(): what the apps read -> voice/video are hidden automatically when the credit is nearly gone; chat is never affected
--  * book_consultation refuses voice/video when the guard says so (server-side, not just UI)

create table if not exists public.app_settings (
  key text primary key,
  value text not null,
  updated_at timestamptz not null default now()
);
alter table public.app_settings enable row level security;
drop policy if exists app_settings_admin on public.app_settings;
create policy app_settings_admin on public.app_settings for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

insert into public.app_settings (key, value) values
  ('rtc_enabled', 'false'),
  ('rtc_monthly_limit_min', '5000'),
  ('rtc_alert_pct', '80'),
  ('rtc_stop_pct', '95')
on conflict (key) do nothing;

create or replace function public.setting_num(p_key text, p_default numeric)
 returns numeric language sql stable security definer set search_path to 'public'
as $$ select coalesce((select nullif(value, '')::numeric from public.app_settings where key = p_key), p_default); $$;

-- participant-minutes this calendar month (Cairo time): every voice/video session counts both people
create or replace function public.rtc_used_minutes()
 returns numeric language sql stable security definer set search_path to 'public'
as $$
  select coalesce(sum(2 * ceil(extract(epoch from (coalesce(c.ended_at, now()) - c.started_at)) / 60.0)), 0)
  from public.consultations c
  where c.channel in ('voice', 'video') and c.started_at is not null
    and date_trunc('month', c.started_at at time zone 'Africa/Cairo') = date_trunc('month', now() at time zone 'Africa/Cairo');
$$;

-- what the apps read (no numbers leak to clients)
create or replace function public.rtc_status()
 returns table (enabled boolean, available boolean)
 language sql stable security definer set search_path to 'public'
as $$
  select e.on, e.on and (public.rtc_used_minutes() < public.setting_num('rtc_monthly_limit_min', 5000) * public.setting_num('rtc_stop_pct', 95) / 100.0)
  from (select coalesce((select value = 'true' from public.app_settings where key = 'rtc_enabled'), false) as on) e;
$$;
grant execute on function public.rtc_status() to anon, authenticated;

-- admin gauge
create or replace function public.admin_rtc_usage()
 returns table (used numeric, monthly_limit numeric, pct numeric, alert_pct numeric, stop_pct numeric, enabled boolean)
 language sql stable security definer set search_path to 'public'
as $$
  select public.rtc_used_minutes(), public.setting_num('rtc_monthly_limit_min', 5000),
         round(100 * public.rtc_used_minutes() / nullif(public.setting_num('rtc_monthly_limit_min', 5000), 0), 1),
         public.setting_num('rtc_alert_pct', 80), public.setting_num('rtc_stop_pct', 95),
         coalesce((select value = 'true' from public.app_settings where key = 'rtc_enabled'), false)
  where public.is_admin();
$$;
grant execute on function public.admin_rtc_usage() to authenticated;

create or replace function public.admin_set_setting(p_key text, p_value text)
 returns text language plpgsql security definer set search_path to 'public'
as $$
begin
  if not public.is_admin() then return 'forbidden'; end if;
  if p_key not in ('rtc_enabled', 'rtc_monthly_limit_min', 'rtc_alert_pct', 'rtc_stop_pct') then return 'invalid'; end if;
  insert into public.app_settings (key, value) values (p_key, p_value)
  on conflict (key) do update set value = excluded.value, updated_at = now();
  return 'ok';
end; $$;
grant execute on function public.admin_set_setting(text, text) to authenticated;

-- server-side guard in booking: voice/video only when enabled and the monthly credit is not nearly used up
create or replace function public.book_consultation(p_provider uuid, p_channel text, p_date date, p_period text, p_pay_method text)
 returns uuid language plpgsql security definer set search_path to 'public'
as $$
declare
  v_client public.clients; v_prov public.providers; v_price numeric; v_dur int;
  v_today date := (now() at time zone 'Africa/Cairo')::date;
  v_deadline timestamptz; v_id uuid; v_rtc record;
begin
  select * into v_client from public.clients where auth_id = auth.uid() limit 1;
  if v_client.id is null then raise exception 'سجّل دخولك أولاً'; end if;
  if p_channel in ('voice', 'video') then
    select * into v_rtc from public.rtc_status();
    if not v_rtc.enabled then raise exception 'هذه القناة غير متاحة حاليًا'; end if;
    if not v_rtc.available then raise exception 'الصوت والفيديو متوقفان مؤقتًا، يمكنك الحجز بالشات'; end if;
  end if;
  if p_channel <> 'chat' then raise exception 'هذه القناة غير متاحة حاليًا'; end if; -- voice/video booking arrives with phase 4
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
    v_deadline := greatest(public.consult_period_start(p_date, p_period) - interval '1 hour', now() + interval '30 minutes');
  end if;

  insert into public.consultations (client_id, provider_id, client_name, channel, price, duration_min, period_date, period, pay_method, pay_deadline)
  values (v_client.id, p_provider, v_client.name, p_channel, v_price, v_dur, p_date, p_period, p_pay_method, v_deadline)
  returning id into v_id;
  return v_id;
end; $$;
revoke all on function public.book_consultation(uuid, text, date, text, text) from public, anon;
grant execute on function public.book_consultation(uuid, text, date, text, text) to authenticated;
