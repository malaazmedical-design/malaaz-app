-- 10_public_snapshot.sql — لقطة (Snapshot) للبيانات العامة تتخدم من CDN بدل ما كل مستخدم يضرب قاعدة البيانات
-- الفكرة: ملف JSON واحد (providers.json) في bucket عام، بيتجدد أوتوماتيك كل دقيقتين، والتطبيق بيقراه من الـCDN
-- وبيرجع للقاعدة مباشرة لو الملف مش موجود أو قديم. بيانات عامة بس، وبأعمدة محددة (من غير إيميل/موبايل/موقع المقدم).
-- آمن ويتشغّل أكتر من مرة. مفيش تغيير في أي جدول موجود.
-- قبل التشغيل: لازم الـ Edge Function اسمها public-snapshot تكون متنشرة (بتتعمل من supabase/functions/public-snapshot).
-- الرجوع: select cron.unschedule('public-snapshot-refresh'); (التطبيق يرجع للقاعدة أوتوماتيك بعد ساعة من آخر تحديث)

-- 1) bucket عام للقطة (القراءة من الـURL العام؛ الكتابة بمفتاح الخدمة بس)
insert into storage.buckets (id, name, public)
values ('public-snapshots', 'public-snapshots', true)
on conflict (id) do nothing;

-- 2) الدالة اللي بتبني اللقطة (للـEdge Function بمفتاح الخدمة بس)
create or replace function public.build_public_snapshot()
returns jsonb
language plpgsql
security definer
set search_path to 'public'
stable
as $function$
declare
  v_pins jsonb := '[]'::jsonb;
begin
  -- جدول المثبّتين ممكن مايكونش موجود في مشروع تاني: غيابه معناه "مفيش مثبّتين"
  if to_regclass('public.featured_providers') is not null then
    execute 'select coalesce(jsonb_agg(to_jsonb(f)), ''[]''::jsonb) from (select area, provider_id, position from public.featured_providers) f'
      into v_pins;
  end if;

  return jsonb_build_object(
    'generated_at', now(),
    'providers', coalesce((
      select jsonb_agg(to_jsonb(x) order by x.created_at desc)
        from (select id, name, name_en, service_type, specialty, grade, area, areas, bio, experience,
                     price, rating, status, is_available, photo_url, created_at
                from public.providers where status = 'active') x), '[]'::jsonb),
    'reviews', coalesce((
      select jsonb_agg(to_jsonb(r) order by r.created_at desc)
        from (select provider_id, client_name, rating, text, created_at
                from public.reviews where is_approved) r), '[]'::jsonb),
    'subs', coalesce((
      select jsonb_agg(to_jsonb(s) order by s.name) from public.sub_services s where s.is_active), '[]'::jsonb),
    'areas', coalesce((
      select jsonb_agg(to_jsonb(a) order by a.name) from public.coverage_areas a where a.is_active), '[]'::jsonb),
    'providerServices', coalesce((
      select jsonb_agg(to_jsonb(ps)) from public.provider_services ps where ps.is_active), '[]'::jsonb),
    'pins', v_pins
  );
end;
$function$;
revoke all on function public.build_public_snapshot() from public, anon, authenticated;
grant execute on function public.build_public_snapshot() to service_role;

-- 3) تجديد اللقطة كل دقيقتين (بيستدعي الـEdge Function)
select cron.unschedule('public-snapshot-refresh') where exists (select 1 from cron.job where jobname = 'public-snapshot-refresh');
select cron.schedule(
  'public-snapshot-refresh',
  '*/2 * * * *',
  $cron$
  select net.http_post(
    url := 'https://omsictbrqlsohrmxeuym.supabase.co/functions/v1/public-snapshot',
    headers := jsonb_build_object('Content-Type', 'application/json'),
    body := '{}'::jsonb,
    timeout_milliseconds := 20000
  );
  $cron$
);
