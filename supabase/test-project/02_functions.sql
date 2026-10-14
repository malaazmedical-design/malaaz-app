-- Test project schema, part 2: functions and triggers.
--
-- IMPORTANT: in production, notify_booking_change, notify_booking_offer_change and
-- escalate_pending_bookings call production edge functions through pg_net with hard-coded
-- URLs and secrets. Those calls are intentionally REMOVED here so the test project can never
-- send real push notifications or emails. Wire them to the TEST project's own edge functions
-- (with a new secret kept in Vault) only when those functions exist.

create or replace function public.haversine_km(lat1 double precision, lng1 double precision, lat2 double precision, lng2 double precision)
 returns double precision
 language plpgsql
 immutable
as $function$
declare
  r double precision := 6371;
  dlat double precision := radians(lat2 - lat1);
  dlng double precision := radians(lng2 - lng1);
  a double precision;
begin
  a := sin(dlat/2)^2 + cos(radians(lat1)) * cos(radians(lat2)) * sin(dlng/2)^2;
  return r * 2 * atan2(sqrt(a), sqrt(1-a));
end;
$function$;

create or replace function public.create_booking_offers(p_booking_id uuid, p_radius_km double precision default 999, p_max_offers integer default 100)
 returns setof booking_offers
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare
  v_booking public.bookings;
begin
  select * into v_booking from public.bookings where id = p_booking_id;

  if v_booking is null or v_booking.provider_id is not null then
    return;
  end if;

  return query
  insert into public.booking_offers (booking_id, provider_id, distance_km)
  select
    p_booking_id,
    p.id,
    case
      when v_booking.lat is not null and v_booking.lng is not null
           and p.lat is not null and p.lng is not null
      then public.haversine_km(v_booking.lat, v_booking.lng, p.lat, p.lng)
      else null
    end
  from public.providers p
  where p.status = 'active'
    and (v_booking.service_type is null or p.service_type = v_booking.service_type)
    -- كشف منزلي → فلتر بالتخصص | أشعة منزلية → فلتر بنوع الأشعة | تمريض → بدون فلتر
    and (
      v_booking.service_type = 'تمريض منزلي'
      or v_booking.sub_option is null
      or exists (
        select 1 from public.provider_services ps
        join public.sub_services ss on ss.id = ps.sub_service_id
        where ps.provider_id = p.id
          and ps.is_active = true
          and ss.service_name = v_booking.service_type
          and ss.name = v_booking.sub_option
      )
    )
    and not exists (
      select 1 from public.booking_offers bo
      where bo.booking_id = p_booking_id and bo.provider_id = p.id
    )
  order by
    case when p.is_available then 0 else 1 end asc,
    case when p.lat is not null and p.lng is not null then 0 else 1 end asc,
    case
      when v_booking.lat is not null and v_booking.lng is not null
           and p.lat is not null and p.lng is not null
      then public.haversine_km(v_booking.lat, v_booking.lng, p.lat, p.lng)
      else 9999
    end asc
  limit p_max_offers
  returning *;
end;
$function$;

create or replace function public.auto_create_booking_offers()
 returns trigger
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
begin
  -- فقط للحجوزات العامة (provider_id = null)
  -- الحجوزات المباشرة عندها مقدم محدد مسبقاً ومش محتاجة offers
  if new.provider_id is null then
    perform public.create_booking_offers(new.id);
  end if;
  return new;
end;
$function$;

create or replace function public.accept_booking_offer(p_offer_id uuid)
 returns jsonb
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare
  v_provider_id uuid;
  v_offer public.booking_offers;
  v_booking public.bookings;
begin
  select id into v_provider_id from public.providers where user_id = auth.uid();
  if v_provider_id is null then
    return jsonb_build_object('success', false, 'reason', 'not_a_provider');
  end if;

  select * into v_offer from public.booking_offers
  where id = p_offer_id and provider_id = v_provider_id
  for update;

  if v_offer is null then
    return jsonb_build_object('success', false, 'reason', 'offer_not_found');
  end if;

  select * into v_booking from public.bookings where id = v_offer.booking_id for update;

  if v_booking.provider_id is not null then
    update public.booking_offers set status = 'expired', responded_at = now()
    where id = p_offer_id and status = 'pending';
    return jsonb_build_object('success', false, 'reason', 'already_taken');
  end if;

  update public.booking_offers set status = 'accepted', responded_at = now()
  where id = p_offer_id and status = 'pending';

  if not found then
    return jsonb_build_object('success', false, 'reason', 'offer_already_responded');
  end if;

  update public.bookings set provider_id = v_provider_id, status = 'confirmed'
  where id = v_offer.booking_id;

  update public.booking_offers set status = 'expired', responded_at = now()
  where booking_id = v_offer.booking_id and id <> p_offer_id and status = 'pending';

  return jsonb_build_object('success', true, 'booking_id', v_offer.booking_id);
end;
$function$;

create or replace function public.decline_booking_offer(p_offer_id uuid)
 returns jsonb
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare
  v_provider_id uuid;
begin
  select id into v_provider_id from public.providers where user_id = auth.uid();
  if v_provider_id is null then
    return jsonb_build_object('success', false, 'reason', 'not_a_provider');
  end if;

  update public.booking_offers set status = 'declined', responded_at = now()
  where id = p_offer_id and provider_id = v_provider_id and status = 'pending';

  return jsonb_build_object('success', found);
end;
$function$;

create or replace function public.cancel_booking(p_booking_id uuid)
 returns void
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare
  v_client_id uuid;
  v_booking_status text;
begin
  -- نجيب client_id للمستخدم المسجّل
  select id into v_client_id
  from clients
  where auth_id = auth.uid();

  if v_client_id is null then
    raise exception 'not_client';
  end if;

  -- نتحقق أن الحجز موجود ومملوك لهذا العميل
  select status into v_booking_status
  from bookings
  where id = p_booking_id and client_id = v_client_id;

  if not found then
    raise exception 'not_found';
  end if;

  -- فقط pending أو confirmed يمكن إلغاؤهم
  if v_booking_status not in ('pending', 'confirmed') then
    raise exception 'not_cancellable';
  end if;

  -- تنفيذ الإلغاء
  update bookings
  set status = 'cancelled'
  where id = p_booking_id and client_id = v_client_id;
end;
$function$;

create or replace function public.delete_auth_user(user_id uuid)
 returns void
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
begin
  delete from auth.users where id = user_id;
end;
$function$;

create or replace function public.get_booking_provider_location(p_booking_id uuid)
 returns jsonb
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare
  v_booking public.bookings;
  v_provider public.providers;
begin
  select * into v_booking from public.bookings where id = p_booking_id;
  if v_booking is null or v_booking.provider_id is null or v_booking.status <> 'confirmed' then
    return jsonb_build_object('found', false);
  end if;

  select * into v_provider from public.providers where id = v_booking.provider_id;
  if v_provider is null or v_provider.lat is null then
    return jsonb_build_object('found', false);
  end if;

  return jsonb_build_object(
    'found', true,
    'provider_id', v_provider.id,
    'latitude', v_provider.lat,
    'longitude', v_provider.lng,
    'provider_name', v_provider.name,
    'updated_at', v_provider.location_updated_at
  );
end;
$function$;

create or replace function public.get_booking_status(p_booking_id uuid, p_phone text)
 returns jsonb
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare
  v_booking public.bookings;
  v_provider public.providers;
  v_price numeric;
begin
  select * into v_booking from public.bookings where id = p_booking_id and phone = p_phone;
  if v_booking is null then
    return jsonb_build_object('found', false);
  end if;

  if v_booking.provider_id is null then
    return jsonb_build_object('found', true, 'status', v_booking.status, 'provider', null);
  end if;

  select * into v_provider from public.providers where id = v_booking.provider_id;

  select ps.custom_price into v_price
  from public.provider_services ps
  join public.sub_services ss on ss.id = ps.sub_service_id
  where ps.provider_id = v_booking.provider_id and ss.name = v_booking.sub_option
  limit 1;

  return jsonb_build_object(
    'found', true,
    'status', v_booking.status,
    'provider', jsonb_build_object(
      'name', v_provider.name,
      'photo_url', v_provider.photo_url,
      'rating', v_provider.rating,
      'price', coalesce(v_price, v_booking.price)
    )
  );
end;
$function$;

create or replace function public.get_offer_details(p_offer_id uuid)
 returns jsonb
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare
  v_provider_id uuid;
  v_offer public.booking_offers;
  v_booking public.bookings;
begin
  select id into v_provider_id from public.providers where user_id = auth.uid();
  if v_provider_id is null then
    return null;
  end if;

  select * into v_offer from public.booking_offers where id = p_offer_id and provider_id = v_provider_id;
  if v_offer is null or v_offer.status <> 'pending' then
    return null;
  end if;

  select * into v_booking from public.bookings where id = v_offer.booking_id;
  if v_booking is null or v_booking.provider_id is not null then
    return null;
  end if;

  return jsonb_build_object(
    'service_type', v_booking.service_type,
    'sub_option', v_booking.sub_option,
    'area', v_booking.area,
    'appointment_time', v_booking.appointment_time,
    'distance_km', v_offer.distance_km
  );
end;
$function$;

create or replace function public.get_provider_services_with_prices(p_provider_id uuid)
 returns table(sub_service_id uuid, service_name text, sub_name text, duration text, custom_price numeric, price_min numeric, price_max numeric)
 language sql
 security definer
 set search_path to 'public'
as $function$
  select
    ps.sub_service_id,
    ss.service_name,
    ss.name as sub_name,
    ss.duration,
    ps.custom_price,
    ss.price_min,
    ss.price_max
  from provider_services ps
  join sub_services ss on ss.id = ps.sub_service_id
  where ps.provider_id = p_provider_id
  and ps.is_active = true;
$function$;

create or replace function public.has_push_token(p_phone text)
 returns boolean
 language sql
 security definer
as $function$
  select exists (
    select 1 from push_tokens
    where owner_type = 'client'
      and phone = p_phone
      and auth.uid() is not null
  );
$function$;

create or replace function public.link_my_bookings()
 returns integer
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare
  my_client clients%rowtype;
  linked integer;
begin
  select * into my_client from clients where auth_id = auth.uid() limit 1;
  if my_client.id is null then return 0; end if;

  update bookings
     set client_id = my_client.id
   where client_id is null
     and phone = my_client.phone;
  get diagnostics linked = row_count;
  return linked;
end;
$function$;

create or replace function public.lookup_push_token_by_phone(p_phone text)
 returns text
 language sql
 security definer
as $function$
  select expo_token
  from push_tokens
  where phone = p_phone
    and owner_type = 'client'
    and auth.uid() is not null
  order by updated_at desc
  limit 1;
$function$;

-- Escalation: same bookkeeping as production (levels + admin_alerts rows) but WITHOUT the
-- outbound email call. Not scheduled in the test project (no pg_cron job).
create or replace function public.escalate_pending_bookings()
 returns void
 language plpgsql
 security definer
 set search_path to 'public', 'extensions'
as $function$
declare
  v_booking record;
  v_msg text;
  v_wa text;
begin
  for v_booking in
    select * from public.bookings
    where status = 'pending'
      and provider_id is null
      and lat is not null and lng is not null
      and escalation_level = 0
      and created_at <= now() - interval '10 minutes'
  loop
    perform public.create_booking_offers(v_booking.id, 30, 10);

    update public.bookings set escalation_level = 1, escalated_at = now() where id = v_booking.id;

    v_msg := 'تنبيه: لم يوافق أي مقدم خدمة على حجز ' || coalesce(v_booking.patient_name,'') ||
             ' (' || coalesce(v_booking.area,'') || ') منذ 10 دقايق. تم توسيع نطاق البحث.';
    v_wa := 'https://wa.me/?text=' || encode(convert_to(v_msg, 'UTF8'), 'escape');

    insert into public.admin_alerts (booking_id, level, message, whatsapp_link)
    values (v_booking.id, 1, v_msg, v_wa);
  end loop;

  for v_booking in
    select * from public.bookings
    where status = 'pending'
      and provider_id is null
      and lat is not null and lng is not null
      and escalation_level = 1
      and escalated_at <= now() - interval '10 minutes'
  loop
    update public.bookings set escalation_level = 2, escalated_at = now() where id = v_booking.id;

    v_msg := 'تنبيه عاجل: حجز ' || coalesce(v_booking.patient_name,'') ||
             ' (' || coalesce(v_booking.area,'') || ') لسه من غير مقدم خدمة بعد 20 دقيقة. يحتاج تدخل فوري.';
    v_wa := 'https://wa.me/?text=' || encode(convert_to(v_msg, 'UTF8'), 'escape');

    insert into public.admin_alerts (booking_id, level, message, whatsapp_link)
    values (v_booking.id, 2, v_msg, v_wa);
  end loop;
end;
$function$;

-- Notification triggers: no-ops in the test project (see header).
create or replace function public.notify_booking_change()
 returns trigger
 language plpgsql
 security definer
 set search_path to 'public', 'extensions'
as $function$
begin
  return new;
end;
$function$;

create or replace function public.notify_booking_offer_change()
 returns trigger
 language plpgsql
 security definer
as $function$
begin
  return new;
end;
$function$;

create trigger trg_auto_booking_offers after insert on public.bookings
  for each row execute function public.auto_create_booking_offers();
create trigger trg_notify_booking after insert or update of status, on_way_at on public.bookings
  for each row execute function public.notify_booking_change();
create trigger trg_notify_booking_offer after insert on public.booking_offers
  for each row execute function public.notify_booking_offer_change();
