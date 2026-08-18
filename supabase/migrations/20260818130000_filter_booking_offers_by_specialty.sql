-- تحديث create_booking_offers: إضافة فلتر التخصص والنوع
-- كشف منزلي → يروح لمقدمي التخصص المطلوب فقط (من provider_services)
-- أشعة منزلية → يروح لمقدمي نوع الأشعة المطلوب فقط (من provider_services)
-- تمريض منزلي → يروح للكل (بدون فلتر إضافي)
CREATE OR REPLACE FUNCTION public.create_booking_offers(
  p_booking_id uuid,
  p_radius_km double precision DEFAULT 999,
  p_max_offers integer DEFAULT 100
)
RETURNS SETOF booking_offers
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_booking public.bookings;
BEGIN
  SELECT * INTO v_booking FROM public.bookings WHERE id = p_booking_id;

  IF v_booking IS NULL OR v_booking.provider_id IS NOT NULL THEN
    RETURN;
  END IF;

  RETURN QUERY
  INSERT INTO public.booking_offers (booking_id, provider_id, distance_km)
  SELECT
    p_booking_id,
    p.id,
    CASE
      WHEN v_booking.lat IS NOT NULL AND v_booking.lng IS NOT NULL
           AND p.lat IS NOT NULL AND p.lng IS NOT NULL
      THEN public.haversine_km(v_booking.lat, v_booking.lng, p.lat, p.lng)
      ELSE NULL
    END
  FROM public.providers p
  WHERE p.status = 'active'
    AND (v_booking.service_type IS NULL OR p.service_type = v_booking.service_type)
    -- كشف منزلي → فلتر بالتخصص | أشعة منزلية → فلتر بنوع الأشعة | تمريض → بدون فلتر
    AND (
      v_booking.service_type = 'تمريض منزلي'
      OR v_booking.sub_option IS NULL
      OR EXISTS (
        SELECT 1 FROM public.provider_services ps
        JOIN public.sub_services ss ON ss.id = ps.sub_service_id
        WHERE ps.provider_id = p.id
          AND ps.is_active = true
          AND ss.service_name = v_booking.service_type
          AND ss.name = v_booking.sub_option
      )
    )
    AND NOT EXISTS (
      SELECT 1 FROM public.booking_offers bo
      WHERE bo.booking_id = p_booking_id AND bo.provider_id = p.id
    )
  ORDER BY
    CASE WHEN p.is_available THEN 0 ELSE 1 END ASC,
    CASE WHEN p.lat IS NOT NULL AND p.lng IS NOT NULL THEN 0 ELSE 1 END ASC,
    CASE
      WHEN v_booking.lat IS NOT NULL AND v_booking.lng IS NOT NULL
           AND p.lat IS NOT NULL AND p.lng IS NOT NULL
      THEN public.haversine_km(v_booking.lat, v_booking.lng, p.lat, p.lng)
      ELSE 9999
    END ASC
  LIMIT p_max_offers
  RETURNING *;
END;
$$;
