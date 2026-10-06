-- Test project only: smarter area matching for quick-request routing (run AFTER 09_quick_request_routing.sql).
-- Arabic names are normalized before comparing (hamza/alef forms, ى/ي, ة/ه, tashkeel, the "ال" prefix, punctuation),
-- and a provider who lists a whole governorate (e.g. "الجيزة") matches every area inside it.

create or replace function public.norm_ar(p text)
 returns text
 language sql
 immutable
as $$
  select trim(regexp_replace(
    regexp_replace(
      regexp_replace(
        regexp_replace(
        translate(lower(coalesce(p, '')), 'أإآٱىةؤئ', 'اااايهوي'),
        '[\u064B-\u0652\u0640]', '', 'g'),                 -- tashkeel + tatweel
      '[^a-z0-9\u0621-\u064A ]', ' ', 'g'),                 -- punctuation -> space
    '(^| )ال', '\1', 'g')                                    -- leading "ال" of every word
  , '\s+', ' ', 'g'))
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
  v_gov text;
  v_count integer;
begin
  select * into v_booking from public.bookings where id = p_booking_id;
  if v_booking is null or v_booking.provider_id is not null then
    return;
  end if;
  v_area := nullif(public.norm_ar(v_booking.area), '');
  -- the governorate of the booking area (from coverage_areas), so a provider covering the whole governorate matches too
  if v_area is not null then
    select public.norm_ar(ca.city) into v_gov
    from public.coverage_areas ca
    where public.norm_ar(ca.name) = v_area
       or (length(public.norm_ar(ca.name)) >= 3 and v_area like '%' || public.norm_ar(ca.name) || '%')
    order by (public.norm_ar(ca.name) = v_area) desc
    limit 1;
  end if;

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
        cross join lateral (select public.norm_ar(a) as n) x
        where x.n <> ''
          and (x.n = v_area
               or (length(x.n) >= 3 and v_area like '%' || x.n || '%')
               or (length(v_area) >= 3 and x.n like '%' || v_area || '%')
               or (v_gov is not null and x.n = v_gov))
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

