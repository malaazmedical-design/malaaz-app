-- Test project only. Phase 4: voice & video consultation channels.
--  * provider_channels: each doctor turns voice / video on or off with its own price and length (chat stays in provider_services)
--  * book_consultation: accepts 'voice' / 'video' (needs rtc_enabled + monthly credit left, see 16_rtc_guard.sql)
-- Calls themselves run on LiveKit; the app gets a short-lived room token from the Edge Function `livekit-token`.

create table if not exists public.provider_channels (
  provider_id uuid not null references public.providers(id) on delete cascade,
  channel text not null check (channel in ('voice', 'video')),
  price numeric not null check (price > 0),
  duration_min int not null default 15 check (duration_min between 5 and 60),
  is_active boolean not null default true,
  updated_at timestamptz not null default now(),
  primary key (provider_id, channel)
);
alter table public.provider_channels enable row level security;

drop policy if exists provider_channels_read on public.provider_channels;
drop policy if exists provider_channels_own on public.provider_channels;
drop policy if exists provider_channels_admin on public.provider_channels;
create policy provider_channels_read on public.provider_channels for select to anon, authenticated using (true);
create policy provider_channels_own on public.provider_channels for all to authenticated
  using (provider_id in (select id from public.providers where user_id = auth.uid()))
  with check (provider_id in (select id from public.providers where user_id = auth.uid()));
create policy provider_channels_admin on public.provider_channels for all to authenticated
  using (public.is_admin()) with check (public.is_admin());
grant select on public.provider_channels to anon, authenticated;
grant insert, update, delete on public.provider_channels to authenticated;

do $$ begin alter publication supabase_realtime add table public.provider_channels;
exception when duplicate_object then null; end $$;

-- booking: chat uses provider_services (as before), voice/video use provider_channels
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

  if p_channel = 'chat' then
    select ps.custom_price, coalesce(ps.duration_min, 15) into v_price, v_dur
      from public.provider_services ps join public.sub_services s on s.id = ps.sub_service_id
     where ps.provider_id = p_provider and s.group_name = 'online' and coalesce(ps.is_active, true) limit 1;
  else
    select pc.price, pc.duration_min into v_price, v_dur
      from public.provider_channels pc where pc.provider_id = p_provider and pc.channel = p_channel and pc.is_active;
  end if;
  if v_price is null then raise exception 'الطبيب لا يقدم هذه القناة حاليًا'; end if;

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

-- what the Edge Function needs to know before it issues a call token (runs as the caller, so RLS/roles apply)
create or replace function public.consult_call_access(p_id uuid)
 returns table (role text, channel text, state text, ends_at timestamptz, display_name text, rtc_ok boolean)
 language sql stable security definer set search_path to 'public'
as $$
  select public.consult_role(c.id), c.channel, c.state,
         case when c.started_at is null then null else public.consult_end_at(c) end,
         case when public.consult_role(c.id) = 'd' then 'الطبيب' else coalesce(c.client_name, 'المريض') end,
         (select available from public.rtc_status())
  from public.consultations c
  where c.id = p_id and public.consult_role(c.id) in ('c', 'd');
$$;
grant execute on function public.consult_call_access(uuid) to authenticated;
