-- Push notifications to the ADMIN's phone for every new booking (home visit / nursing / x-ray / quick request),
-- every new online consultation, every new "ask a doctor" question and every admin alert (escalated or unclosed booking).
-- The admin signs in to the client app with the admin account; the app registers its push token through
-- register_admin_push_token() (admin only). Tokens live in their own table, nothing in push_tokens changes.
create table if not exists public.admin_push_tokens (
  expo_token text primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  platform text,
  updated_at timestamptz not null default now()
);
alter table public.admin_push_tokens enable row level security;   -- no policies: only the functions below touch it

create or replace function public.register_admin_push_token(p_token text, p_platform text default null)
 returns text language plpgsql security definer set search_path to 'public'
as $$
begin
  if not public.is_admin() then return 'forbidden'; end if;
  if coalesce(length(trim(p_token)), 0) < 10 then return 'invalid'; end if;
  insert into public.admin_push_tokens (expo_token, user_id, platform, updated_at)
  values (trim(p_token), auth.uid(), p_platform, now())
  on conflict (expo_token) do update set user_id = auth.uid(), platform = excluded.platform, updated_at = now();
  return 'ok';
end; $$;

create or replace function public.unregister_admin_push_token(p_token text)
 returns text language plpgsql security definer set search_path to 'public'
as $$
begin
  if auth.uid() is null then return 'forbidden'; end if;
  delete from public.admin_push_tokens where expo_token = trim(p_token) and user_id = auth.uid();
  return 'ok';
end; $$;

create or replace function public.admin_push_enabled()
 returns boolean language sql stable security definer set search_path to 'public'
as $$ select public.is_admin() and exists (select 1 from public.admin_push_tokens where user_id = auth.uid()); $$;

revoke all on function public.register_admin_push_token(text, text) from public, anon;
revoke all on function public.unregister_admin_push_token(text) from public, anon;
revoke all on function public.admin_push_enabled() from public, anon;
grant execute on function public.register_admin_push_token(text, text) to authenticated;
grant execute on function public.unregister_admin_push_token(text) to authenticated;
grant execute on function public.admin_push_enabled() to authenticated;

create or replace function public.notify_admin(p_title text, p_body text, p_data jsonb default '{}'::jsonb)
 returns void language plpgsql security definer set search_path to 'public', 'extensions'
as $$
declare v_tokens text[];
begin
  select coalesce(array_agg(expo_token), '{}') into v_tokens from public.admin_push_tokens;
  perform public.send_expo_push(v_tokens, p_title, p_body, p_data);
exception when others then null;   -- a failed admin push must never block the booking itself
end; $$;
revoke all on function public.notify_admin(text, text, jsonb) from public, anon, authenticated;

-- new booking (any service type, with or without a chosen provider)
create or replace function public.notify_admin_new_booking()
 returns trigger language plpgsql security definer set search_path to 'public', 'extensions'
as $$
begin
  perform public.notify_admin(
    case when new.provider_id is null then '📋 حجز جديد (طلب سريع)' else '🎯 حجز مباشر جديد' end,
    concat_ws(' · ', new.service_type, new.sub_option, new.patient_name, new.area, new.appointment_time),
    jsonb_build_object('kind', 'admin_booking', 'booking_id', new.id));
  return new;
end; $$;
drop trigger if exists trg_notify_admin_new_booking on public.bookings;
create trigger trg_notify_admin_new_booking after insert on public.bookings
  for each row execute function public.notify_admin_new_booking();

-- new online consultation
create or replace function public.notify_admin_new_consultation()
 returns trigger language plpgsql security definer set search_path to 'public', 'extensions'
as $$
declare v_prov text;
begin
  select name into v_prov from public.providers where id = new.provider_id;
  perform public.notify_admin('💬 استشارة أونلاين جديدة',
    concat_ws(' · ', new.case_number, new.client_name, case new.channel when 'voice' then 'صوت' when 'video' then 'فيديو' else 'شات' end,
              v_prov, new.price || ' ج.م', 'بانتظار الدفع'),
    jsonb_build_object('kind', 'admin_consultation', 'consultation_id', new.id));
  return new;
end; $$;
drop trigger if exists trg_notify_admin_new_consultation on public.consultations;
create trigger trg_notify_admin_new_consultation after insert on public.consultations
  for each row execute function public.notify_admin_new_consultation();

-- new "ask a doctor" question
create or replace function public.notify_admin_new_ask()
 returns trigger language plpgsql security definer set search_path to 'public', 'extensions'
as $$
begin
  perform public.notify_admin('❓ سؤال جديد لطبيب', concat_ws(' · ', new.case_number, left(new.message, 70)),
    jsonb_build_object('kind', 'admin_ask', 'case_id', new.id));
  return new;
end; $$;
drop trigger if exists trg_notify_admin_new_ask on public.ask_doctor_cases;
create trigger trg_notify_admin_new_ask after insert on public.ask_doctor_cases
  for each row execute function public.notify_admin_new_ask();

-- admin alerts (booking without a provider after 10/20 minutes, accepted booking never closed)
create or replace function public.notify_admin_alert()
 returns trigger language plpgsql security definer set search_path to 'public', 'extensions'
as $$
begin
  perform public.notify_admin('⚠️ تنبيه', left(new.message, 160), jsonb_build_object('kind', 'admin_alert', 'booking_id', new.booking_id));
  return new;
end; $$;
drop trigger if exists trg_notify_admin_alert on public.admin_alerts;
create trigger trg_notify_admin_alert after insert on public.admin_alerts
  for each row execute function public.notify_admin_alert();
