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
