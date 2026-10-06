-- Test project only: quick-request routing + price.
--   1) offers go first to providers whose coverage area matches the booking area;
--      if nobody matches, or after the 10-minute escalation, to providers within 60 km of the client.
--   2) the booking price is set from the accepting provider's own price (provider_services.custom_price,
--      else the admin minimum for the provider's grade); the offer shows that price before accepting.

-- price a provider would charge for a booking's service
create or replace function public.provider_price_for(p_provider_id uuid, p_service_type text, p_sub_option text)
 returns numeric
 language sql
 stable
 security definer
 set search_path to 'public'
as $$
  with prov as (select grade from public.providers where id = p_provider_id),
  match as (
    select ss.*, ps.custom_price
    from public.sub_services ss
    left join public.provider_services ps
      on ps.sub_service_id = ss.id and ps.provider_id = p_provider_id and ps.is_active = true
    where ss.service_name = p_service_type
      and p_sub_option is not null
      -- doctor quick requests store "<grade> <specialty>" in sub_option
      and (ss.name = p_sub_option or p_sub_option like '% ' || ss.name)
    order by (ps.custom_price is not null) desc, length(ss.name) desc
    limit 1
  )
  select coalesce(
    m.custom_price,
    case when (select grade from prov) = 'استشاري'
         then coalesce(m.price_min_consultant, m.price_min)
         else coalesce(m.price_min_specialist, m.price_min) end
  )
  from match m;
$$;

create or replace function public.create_booking_offers(p_booking_id uuid, p_radius_km double precision default 999, p_max_offers integer default 100)
 returns setof booking_offers
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare
  v_booking public.bookings;
  v_area text;
  v_count integer;
begin
  select * into v_booking from public.bookings where id = p_booking_id;
  if v_booking is null or v_booking.provider_id is not null then
    return;
  end if;
  v_area := nullif(trim(coalesce(v_booking.area, '')), '');

  -- wave 1 (default call): providers whose coverage area matches the booking area
  if p_radius_km >= 999 and v_area is not null then
    return query
    insert into public.booking_offers (booking_id, provider_id, distance_km)
    select p_booking_id, p.id,
      case when v_booking.lat is not null and v_booking.lng is not null and p.lat is not null and p.lng is not null
           then public.haversine_km(v_booking.lat, v_booking.lng, p.lat, p.lng) end
    from public.providers p
    where p.status = 'active'
      and (v_booking.service_type is null or p.service_type = v_booking.service_type)
      and (
        v_booking.service_type = 'تمريض منزلي'
        or v_booking.sub_option is null
        or exists (
          select 1 from public.provider_services ps
          join public.sub_services ss on ss.id = ps.sub_service_id
          where ps.provider_id = p.id and ps.is_active = true
            and ss.service_name = v_booking.service_type
            and (ss.name = v_booking.sub_option or v_booking.sub_option like '% ' || ss.name)
        )
      )
      and exists (
        select 1
        from unnest(string_to_array(coalesce(p.areas, '') || ',' || coalesce(p.area, ''), ',')) a
        where trim(a) <> ''
          and (trim(a) = v_area or v_area like '%' || trim(a) || '%' or trim(a) like '%' || v_area || '%')
      )
      and not exists (select 1 from public.booking_offers bo where bo.booking_id = p_booking_id and bo.provider_id = p.id)
    order by case when p.is_available then 0 else 1 end asc,
      case when v_booking.lat is not null and v_booking.lng is not null and p.lat is not null and p.lng is not null
           then public.haversine_km(v_booking.lat, v_booking.lng, p.lat, p.lng) else 9999 end asc
    limit p_max_offers
    returning *;
    get diagnostics v_count = row_count;
    if v_count > 0 then return; end if;
  end if;

  -- wave 2 (escalation, or nobody matched the area): providers within the radius (60 km when escalating)
  if v_booking.lat is null or v_booking.lng is null then
    return;
  end if;
  return query
  insert into public.booking_offers (booking_id, provider_id, distance_km)
  select p_booking_id, p.id, public.haversine_km(v_booking.lat, v_booking.lng, p.lat, p.lng)
  from public.providers p
  where p.status = 'active'
    and p.lat is not null and p.lng is not null
    and (v_booking.service_type is null or p.service_type = v_booking.service_type)
    and (
      v_booking.service_type = 'تمريض منزلي'
      or v_booking.sub_option is null
      or exists (
        select 1 from public.provider_services ps
        join public.sub_services ss on ss.id = ps.sub_service_id
        where ps.provider_id = p.id and ps.is_active = true
          and ss.service_name = v_booking.service_type
          and (ss.name = v_booking.sub_option or v_booking.sub_option like '% ' || ss.name)
      )
    )
    and public.haversine_km(v_booking.lat, v_booking.lng, p.lat, p.lng) <= least(p_radius_km, 60)
    and not exists (select 1 from public.booking_offers bo where bo.booking_id = p_booking_id and bo.provider_id = p.id)
  order by case when p.is_available then 0 else 1 end asc,
    public.haversine_km(v_booking.lat, v_booking.lng, p.lat, p.lng) asc
  limit p_max_offers
  returning *;
end;
$function$;

-- escalation after 10 minutes: widen to a 60 km circle (was 30 km / 10 offers)
do $$
declare v_src text;
begin
  select pg_get_functiondef('public.escalate_pending_bookings()'::regprocedure) into v_src;
  v_src := replace(v_src, 'create_booking_offers(v_booking.id, 30, 10)', 'create_booking_offers(v_booking.id, 60, 50)');
  execute v_src;
end $$;

-- accept: also stamp the booking price from the provider's own price (only if the booking has none)
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

  update public.bookings
  set provider_id = v_provider_id,
      status = 'confirmed',
      price = coalesce(price, public.provider_price_for(v_provider_id, v_booking.service_type, v_booking.sub_option))
  where id = v_offer.booking_id;

  update public.booking_offers set status = 'expired', responded_at = now()
  where booking_id = v_offer.booking_id and id <> p_offer_id and status = 'pending';

  return jsonb_build_object('success', true, 'booking_id', v_offer.booking_id);
end;
$function$;

-- offer details: add the price this provider would get
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
    'distance_km', v_offer.distance_km,
    'price', coalesce(v_booking.price, public.provider_price_for(v_provider_id, v_booking.service_type, v_booking.sub_option)),
    'payment_method', v_booking.payment_method
  );
end;
$function$;
