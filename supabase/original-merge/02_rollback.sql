-- 02_rollback.sql — يرجّع ما غيّره 02_release_switch.sql على قاعدة الأصلي (الحالة كما كانت يوم 2026-10-15)
-- شغّله بس لو حصلت مشكلة بعد تشغيل 02. آمن ويتشغّل أكتر من مرة. مش بيمس أي بيانات للمستخدمين.
-- مش بيرجّع: التحديثات اللي اتعملت قبل كده (01 و04 و05 و06 و07).
begin;

-- 1) دوال التوزيع: ترجع للنسخة القديمة
do $$
declare v_src text;
begin
  select pg_get_functiondef('public.escalate_pending_bookings()'::regprocedure) into v_src;
  v_src := replace(v_src, 'create_booking_offers(v_booking.id, 60, 50)', 'create_booking_offers(v_booking.id, 30, 10)');
  execute v_src;
end $$;

create or replace function public.accept_booking_offer(p_offer_id uuid)
 returns jsonb
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
DECLARE
  v_provider_id uuid;
  v_offer public.booking_offers;
  v_booking public.bookings;
BEGIN
  SELECT id INTO v_provider_id FROM public.providers WHERE user_id = auth.uid();
  IF v_provider_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'reason', 'not_a_provider');
  END IF;

  SELECT * INTO v_offer FROM public.booking_offers
  WHERE id = p_offer_id AND provider_id = v_provider_id
  FOR UPDATE;

  IF v_offer IS NULL THEN
    RETURN jsonb_build_object('success', false, 'reason', 'offer_not_found');
  END IF;

  SELECT * INTO v_booking FROM public.bookings WHERE id = v_offer.booking_id FOR UPDATE;

  IF v_booking.provider_id IS NOT NULL THEN
    UPDATE public.booking_offers SET status = 'expired', responded_at = now()
    WHERE id = p_offer_id AND status = 'pending';
    RETURN jsonb_build_object('success', false, 'reason', 'already_taken');
  END IF;

  UPDATE public.booking_offers SET status = 'accepted', responded_at = now()
  WHERE id = p_offer_id AND status = 'pending';

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'reason', 'offer_already_responded');
  END IF;

  UPDATE public.bookings SET provider_id = v_provider_id, status = 'confirmed'
  WHERE id = v_offer.booking_id;

  UPDATE public.booking_offers SET status = 'expired', responded_at = now()
  WHERE booking_id = v_offer.booking_id AND id <> p_offer_id AND status = 'pending';

  RETURN jsonb_build_object('success', true, 'booking_id', v_offer.booking_id);
END;
$function$;

create or replace function public.get_offer_details(p_offer_id uuid)
 returns jsonb
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
DECLARE
  v_provider_id uuid;
  v_offer public.booking_offers;
  v_booking public.bookings;
BEGIN
  SELECT id INTO v_provider_id FROM public.providers WHERE user_id = auth.uid();
  IF v_provider_id IS NULL THEN
    RETURN NULL;
  END IF;

  SELECT * INTO v_offer FROM public.booking_offers WHERE id = p_offer_id AND provider_id = v_provider_id;
  IF v_offer IS NULL OR v_offer.status <> 'pending' THEN
    RETURN NULL;
  END IF;

  SELECT * INTO v_booking FROM public.bookings WHERE id = v_offer.booking_id;
  IF v_booking IS NULL OR v_booking.provider_id IS NOT NULL THEN
    RETURN NULL;
  END IF;

  RETURN jsonb_build_object(
    'service_type', v_booking.service_type,
    'sub_option', v_booking.sub_option,
    'area', v_booking.area,
    'appointment_time', v_booking.appointment_time,
    'distance_km', v_offer.distance_km
  );
END;
$function$;

-- create_booking_offers: النسخة الحالية قبل 02 (بدون فلتر منطقة، لكن مع حماية "مين بينادي" من 05)
create or replace function public.create_booking_offers(p_booking_id uuid, p_radius_km double precision default 999, p_max_offers integer default 100)
 returns setof booking_offers
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
DECLARE
  v_booking public.bookings;
BEGIN
  SELECT * INTO v_booking FROM public.bookings WHERE id = p_booking_id;

  IF v_booking IS NULL OR v_booking.provider_id IS NOT NULL THEN
    RETURN;
  END IF;
  -- guard:caller
  if not (coalesce(auth.role(), 'service_role') in ('service_role', 'postgres', 'supabase_admin')
          or public.is_admin()
          or exists (select 1 from public.clients c where c.auth_id = auth.uid() and c.id = v_booking.client_id)
          or (v_booking.client_id is null and v_booking.created_at > now() - interval '15 minutes')) then
    return;
  end if;

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
$function$;

-- 2) سياسات "اسأل طبيب" القديمة (02 بيحذفها): نرجّعها لو مش موجودة
do $$ begin
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='ask_doctor_cases' and policyname='doctor_see_new_cases') then
    create policy "doctor_see_new_cases" on public.ask_doctor_cases as permissive for select to public
      using (((status = 'new'::text) OR (assigned_doctor_id IN ( SELECT providers.id FROM providers WHERE (providers.user_id = auth.uid())))));
  end if;
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='ask_doctor_cases' and policyname='doctor_update_case') then
    create policy "doctor_update_case" on public.ask_doctor_cases as permissive for update to public
      using (((assigned_doctor_id IN ( SELECT providers.id FROM providers WHERE (providers.user_id = auth.uid()))) OR ((status = 'new'::text) AND (assigned_doctor_id IS NULL))));
  end if;
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='ask_doctor_cases' and policyname='patient_insert_case') then
    create policy "patient_insert_case" on public.ask_doctor_cases as permissive for insert to public with check (true);
  end if;
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='ask_doctor_cases' and policyname='patient_own_cases') then
    create policy "patient_own_cases" on public.ask_doctor_cases as permissive for all to public
      using ((client_id IN ( SELECT clients.id FROM clients WHERE (clients.auth_id = auth.uid()))));
  end if;
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='ask_doctor_attachments' and policyname='attachments_access') then
    create policy "attachments_access" on public.ask_doctor_attachments as permissive for all to public
      using ((case_id IN ( SELECT ask_doctor_cases.id FROM ask_doctor_cases
        WHERE ((ask_doctor_cases.client_id IN ( SELECT clients.id FROM clients WHERE (clients.auth_id = auth.uid())))
            OR (ask_doctor_cases.assigned_doctor_id IN ( SELECT providers.id FROM providers WHERE (providers.user_id = auth.uid())))
            OR (ask_doctor_cases.status = 'new'::text)))));
  end if;
end $$;

-- 3) مهام الجدولة اللي 02 بيضيفها: نوقفها
do $$ begin
  begin perform cron.unschedule('consultations-tick'); exception when others then null; end;
  begin perform cron.unschedule('consultations-summary-tick'); exception when others then null; end;
  begin perform cron.unschedule('ask-expire-tick'); exception when others then null; end;
  begin perform cron.unschedule('stale-bookings-tick'); exception when others then null; end;
  begin perform cron.unschedule('consultation-requests-tick'); exception when others then null; end;
end $$;

-- 4) صف "استشارة أونلاين" الجديد: نحذفه لو محدش استخدمه
delete from public.sub_services s
 where s.service_name = 'كشف منزلي' and s.group_name = 'online'
   and not exists (select 1 from public.provider_services ps where ps.sub_service_id = s.id);

commit;
