-- ⚠ بعد ما تشغّل 02_release_switch.sql لازم تعيد تشغيل الجزء 3 (أو الملف كله) — 02 بيستبدل create_booking_offers (build.py بيضيف الحماية لـ02 تلقائي).
-- 05_security_fixes.sql — تقفيل 3 دوال مفتوحة زيادة عن اللزوم (للتطبيق الأصلي فقط)
-- آمن ويتشغّل أكتر من مرة. مفيش تغيير في بيانات، دوال بس. شغّله بعد النسخة الاحتياطية.
-- الرجوع: أوامر في آخر الملف.

-- 1) get_booking_provider_location: كانت بترجّع موقع المقدم لأي حد معاه رقم الحجز (من غير تسجيل دخول).
--    دلوقتي: الأدمن، أو عميل الحجز نفسه، أو المقدم اللي على الحجز بس. (مفيش كود في التطبيق بيستخدمها.)
create or replace function public.get_booking_provider_location(p_booking_id uuid)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_booking public.bookings;
  v_provider public.providers;
  v_ok boolean;
begin
  select * into v_booking from public.bookings where id = p_booking_id;
  if v_booking is null or v_booking.provider_id is null or v_booking.status <> 'confirmed' then
    return jsonb_build_object('found', false);
  end if;

  v_ok := public.is_admin()
       or exists (select 1 from public.clients c where c.auth_id = auth.uid() and c.id = v_booking.client_id)
       or exists (select 1 from public.providers p where p.user_id = auth.uid() and p.id = v_booking.provider_id);
  if not v_ok then
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
revoke all on function public.get_booking_provider_location(uuid) from public, anon;
grant execute on function public.get_booking_provider_location(uuid) to authenticated, service_role;

-- 2) lookup_push_token_by_phone: بدون search_path ومفتوحة لـ anon. دلوقتي: search_path ثابت + للمسجّلين بس.
--    (بتُستخدم في شاشة العائلة في ReVoice، فبتفضل شغّالة للمستخدم المسجّل.)
create or replace function public.lookup_push_token_by_phone(p_phone text)
returns text
language sql
security definer
set search_path to 'public'
as $function$
  select expo_token
  from public.push_tokens
  where phone = p_phone
    and owner_type = 'client'
    and auth.uid() is not null
  order by updated_at desc
  limit 1;
$function$;
revoke all on function public.lookup_push_token_by_phone(text) from public, anon;
grant execute on function public.lookup_push_token_by_phone(text) to authenticated, service_role;

-- 3) create_booking_offers: كانت متاحة لأي حد على أي حجز عام. التطبيق والـtrigger والـcron بيناديوا عليها،
--    فبنضيف فحص "مين بينادي" جوه الدالة الحالية من غير ما نغيّر باقي منطقها.
-- حماية create_booking_offers: بتحقن فحص "مين بينادي" في أي نسخة موجودة من الدالة (idempotent).
-- بتسمح: النظام (cron/trigger/service_role)، الأدمن، صاحب الحجز، أو حجز ضيف عمره أقل من 15 دقيقة.
do $guard$
declare
  v_def text;
  v_new text;
begin
  select pg_get_functiondef(p.oid) into v_def
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'public' and p.proname = 'create_booking_offers'
   limit 1;
  if v_def is null or v_def like '%guard:caller%' then return; end if;

  v_new := regexp_replace(
    v_def,
    '(if\s+v_booking\s+is\s+null\s+or\s+v_booking\.provider_id\s+is\s+not\s+null\s+then\s+return;\s+end\s+if;)',
    E'\\1\n  -- guard:caller\n  if not (coalesce(auth.role(), ''service_role'') in (''service_role'', ''postgres'', ''supabase_admin'')\n          or public.is_admin()\n          or exists (select 1 from public.clients c where c.auth_id = auth.uid() and c.id = v_booking.client_id)\n          or (v_booking.client_id is null and v_booking.created_at > now() - interval ''15 minutes'')) then\n    return;\n  end if;',
    'i');
  if v_new not like '%guard:caller%' then
    raise exception 'create_booking_offers: مش لاقي مكان الحقن — راجع الدالة يدوي';
  end if;
  execute v_new;
end
$guard$;

-- فحص بعد التشغيل: لازم كل صف يطلع anon_can_run = false للدالتين الأولانيين
select proname,
       has_function_privilege('anon', p.oid, 'EXECUTE') as anon_can_run,
       prosecdef, proconfig
  from pg_proc p join pg_namespace n on n.oid = p.pronamespace
 where n.nspname = 'public'
   and proname in ('get_booking_provider_location', 'lookup_push_token_by_phone', 'create_booking_offers');

-- الرجوع (لو احتجت): أعد منح anon:
-- grant execute on function public.get_booking_provider_location(uuid) to anon;
-- grant execute on function public.lookup_push_token_by_phone(text) to anon;
