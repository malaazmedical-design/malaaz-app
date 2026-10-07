-- Test project only: free push notifications straight from the database to Expo's push service (pg_net),
-- no Edge Function and no emails. Replaces the no-op triggers from 02_functions.sql.
--   * a new offer / direct booking  -> push to the provider
--   * booking confirmed (with provider name + price), on the way, completed, cancelled -> push to the client
-- Android push also needs an FCM V1 key uploaded in Expo for each app package (done once, outside the database).

create extension if not exists pg_net with schema extensions;

create or replace function public.send_expo_push(p_tokens text[], p_title text, p_body text, p_data jsonb)
 returns void
 language plpgsql
 security definer
 set search_path to 'public', 'extensions'
as $function$
begin
  if p_tokens is null or coalesce(array_length(p_tokens, 1), 0) = 0 then
    return;
  end if;
  perform net.http_post(
    url := 'https://exp.host/--/api/v2/push/send',
    headers := '{"Content-Type": "application/json"}'::jsonb,
    body := (
      select jsonb_agg(jsonb_build_object(
        'to', t, 'title', p_title, 'body', p_body, 'data', p_data, 'sound', 'default', 'priority', 'high'))
      from unnest(p_tokens) as t
    )
  );
exception when others then
  -- a failed push must never block the booking itself
  null;
end;
$function$;

revoke all on function public.send_expo_push(text[], text, text, jsonb) from public, anon, authenticated;

create or replace function public.provider_push_tokens(p_provider_id uuid)
 returns text[]
 language sql
 stable
 security definer
 set search_path to 'public'
as $$
  select coalesce(array_agg(expo_token), '{}') from (
    select expo_token from public.push_tokens
    where owner_type = 'provider' and provider_id = p_provider_id
    order by updated_at desc limit 2) s;
$$;

create or replace function public.client_push_tokens(p_phone text)
 returns text[]
 language sql
 stable
 security definer
 set search_path to 'public'
as $$
  select coalesce(array_agg(expo_token), '{}') from (
    select expo_token from public.push_tokens
    where owner_type = 'client' and phone = p_phone
    order by updated_at desc limit 3) s;
$$;

revoke all on function public.provider_push_tokens(uuid) from public, anon, authenticated;
revoke all on function public.client_push_tokens(text) from public, anon, authenticated;

-- new offer -> push to that provider
create or replace function public.notify_booking_offer_change()
 returns trigger
 language plpgsql
 security definer
 set search_path to 'public', 'extensions'
as $function$
declare
  v_b public.bookings;
  v_svc text;
begin
  select * into v_b from public.bookings where id = new.booking_id;
  if v_b is null then return new; end if;
  v_svc := coalesce(v_b.service_type, '') || case when v_b.sub_option is not null then ' — ' || v_b.sub_option else '' end;
  perform public.send_expo_push(
    public.provider_push_tokens(new.provider_id),
    '📋 حجز جديد وصلك!',
    concat_ws(' · ', v_svc, v_b.area, v_b.appointment_time),
    jsonb_build_object('kind', 'new_booking', 'booking_id', new.booking_id)
  );
  return new;
end;
$function$;

-- booking changes -> provider (direct booking) / client (status, on the way)
create or replace function public.notify_booking_change()
 returns trigger
 language plpgsql
 security definer
 set search_path to 'public', 'extensions'
as $function$
declare
  v_svc text;
  v_prov text;
  v_body text;
begin
  v_svc := coalesce(new.service_type, '') || case when new.sub_option is not null then ' — ' || new.sub_option else '' end;

  if tg_op = 'INSERT' then
    if new.provider_id is not null then
      perform public.send_expo_push(
        public.provider_push_tokens(new.provider_id),
        '📋 حجز جديد وصلك!',
        concat_ws(' · ', v_svc, new.area, new.appointment_time),
        jsonb_build_object('kind', 'new_booking', 'booking_id', new.id)
      );
    end if;
    return new;
  end if;

  if old.on_way_at is null and new.on_way_at is not null then
    perform public.send_expo_push(
      public.client_push_tokens(new.phone),
      '🚗 مقدم الخدمة في الطريق إليك!',
      v_svc || ' — استعد، مقدم الخدمة اتحرك ناحيتك 💙',
      jsonb_build_object('kind', 'on_way', 'booking_id', new.id)
    );
  end if;

  if old.status is distinct from new.status then
    if new.status = 'confirmed' then
      select name into v_prov from public.providers where id = new.provider_id;
      v_body := concat_ws(' · ',
        v_svc,
        case when v_prov is not null then 'مع ' || v_prov end,
        case when new.price is not null then new.price || ' ج.م' end,
        new.appointment_time);
      perform public.send_expo_push(
        public.client_push_tokens(new.phone),
        '✅ تم تأكيد حجزك!',
        v_body,
        jsonb_build_object('kind', 'booking_confirmed', 'booking_id', new.id)
      );
    elsif new.status = 'cancelled' then
      perform public.send_expo_push(
        public.client_push_tokens(new.phone),
        '⚠️ تحديث بخصوص حجزك',
        'نعتذر — تعذّر تأكيد حجز ' || v_svc || '. يمكنك اختيار مقدم آخر من التطبيق',
        jsonb_build_object('kind', 'booking_cancelled', 'booking_id', new.id)
      );
    elsif new.status = 'completed' then
      perform public.send_expo_push(
        public.client_push_tokens(new.phone),
        '🎉 اكتملت خدمتك مع ملاذ',
        'نتمنى تكون تجربتك كانت مميزة — قيّم تجربتك في دقيقة ⭐',
        jsonb_build_object('kind', 'booking_completed', 'booking_id', new.id)
      );
    end if;
  end if;
  return new;
end;
$function$;
