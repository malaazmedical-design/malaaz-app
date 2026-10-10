-- Test project only. Demo nurses (5 per nursing service) and demo X-ray centers (5 per X-ray service),
-- each priced inside the admin range. Fake data only (emails end with @example.invalid).
-- Needs 19_missing_pieces.sql first (it creates the quick-nursing and X-ray services). Safe to re-run.

-- ───────── nurses ─────────
with svc as (
  select s.id, s.name, row_number() over (order by s.name) as i
  from public.sub_services s
  where s.service_name = 'تمريض منزلي' and s.is_active and coalesce(s.group_name, '') <> 'grade'
),
names as (
  select * from unnest(array[
    'سارة محمود','هدى عبد الرحمن','أميرة سالم','نجلاء فهيم','إيمان زكريا','رشا عطية','منال بدوي','سماح حجازي','هناء مرسي','عبير سليم',
    'محمد عوض','حسام الدين فتحي','علاء الشافعي','ربيع جاد','عادل قنديل','ياسمين فوزي','دعاء إسماعيل','ميادة ثابت','لمياء عرفة','شيرين مهران'
  ]) with ordinality as t(nm, ord)
),
loc as (
  select * from (values
    (0, 'القاهرة', 'القاهرة والجيزة', 30.0444, 31.2357), (1, 'الجيزة', 'الجيزة', 30.0131, 31.2089),
    (2, 'الإسكندرية', 'الإسكندرية', 31.2001, 29.9187), (3, 'القاهرة', 'القاهرة', 30.0626, 31.2497),
    (4, 'الجيزة', 'القاهرة والجيزة', 30.0200, 31.2100)
  ) as l(k, area, areas, lat, lng)
),
rows as (
  select s.i, g.n, n.nm,
         case when g.n % 2 = 1 then 'أخصائي تمريض' else 'فني تمريض' end as grade,
         (array['رعاية مسنين','ما بعد العمليات','حقن وتغيير جروح','رعاية أطفال','رعاية منزلية'])[g.n] as specialty,
         'demo_nur_' || s.i || '_' || g.n || '@example.invalid' as email,
         '0103' || lpad((s.i * 10 + g.n)::text, 7, '0') as phone,
         l.area, l.areas, l.lat, l.lng,
         (4.3 + ((s.i * 7 + g.n * 3) % 8) / 10.0)::numeric(2,1) as rating,
         2 + ((s.i * 5 + g.n * 4) % 12) as exp, (g.n <> 5) as avail
  from svc s cross join generate_series(1, 5) as g(n)
  join names n on n.ord = ((s.i - 1) * 5 + g.n - 1) % 20 + 1
  join loc l on l.k = g.n - 1
)
insert into public.providers
  (name, email, phone, service_type, specialty, grade, area, areas, bio, experience, rating, price, status, is_available, commission_rate, lat, lng)
select r.nm, r.email, r.phone, 'تمريض منزلي', r.specialty, r.grade, r.area, r.areas,
       'تمريض تجريبي — بيانات وهمية للاختبار فقط.', r.exp, r.rating, 400 + r.n * 30, 'active', r.avail, 15, r.lat, r.lng
from rows r
where not exists (select 1 from public.providers p where p.email = r.email);

-- ───────── X-ray centers ─────────
with svc as (
  select s.id, s.name, row_number() over (order by s.name) as i
  from public.sub_services s
  where s.service_name = 'أشعة منزلية' and s.is_active and coalesce(s.group_name, '') <> 'grade'
),
names as (
  select * from unnest(array[
    'مركز النور للأشعة','مركز الشفاء','مركز الأمل التشخيصي','مركز المدينة','مركز الحياة للأشعة',
    'مركز الصفوة','مركز دلتا للأشعة','مركز الرحمة','مركز النيل التشخيصي','مركز الأهرام للأشعة',
    'مركز السلام','مركز الفجر للأشعة','مركز المستقبل','مركز البرج التشخيصي','مركز الواحة'
  ]) with ordinality as t(nm, ord)
),
loc as (
  select * from (values
    (0, 'القاهرة', 'القاهرة والجيزة', 30.0700, 31.2600), (1, 'الجيزة', 'الجيزة', 30.0300, 31.2000),
    (2, 'الإسكندرية', 'الإسكندرية', 31.2050, 29.9250), (3, 'القاهرة', 'القاهرة', 30.0400, 31.2500),
    (4, 'الجيزة', 'القاهرة والجيزة', 30.0050, 31.2150)
  ) as l(k, area, areas, lat, lng)
),
rows as (
  select s.i, s.name as specialty, g.n, n.nm,
         'demo_xr_' || s.i || '_' || g.n || '@example.invalid' as email,
         '0104' || lpad((s.i * 10 + g.n)::text, 7, '0') as phone,
         l.area, l.areas, l.lat, l.lng,
         (4.3 + ((s.i * 7 + g.n * 3) % 8) / 10.0)::numeric(2,1) as rating,
         3 + ((s.i * 5 + g.n * 4) % 12) as exp, (g.n <> 5) as avail
  from svc s cross join generate_series(1, 5) as g(n)
  join names n on n.ord = ((s.i - 1) * 5 + g.n - 1) % 15 + 1
  join loc l on l.k = g.n - 1
)
insert into public.providers
  (name, email, phone, service_type, specialty, grade, area, areas, bio, experience, rating, price, status, is_available, commission_rate, lat, lng)
select r.nm, r.email, r.phone, 'أشعة منزلية', r.specialty, 'مركز أشعة', r.area, r.areas,
       'مركز أشعة تجريبي — بيانات وهمية للاختبار فقط.', r.exp, r.rating, 300 + r.n * 25, 'active', r.avail, 15, r.lat, r.lng
from rows r
where not exists (select 1 from public.providers p where p.email = r.email);

-- ───────── services & prices (inside the admin range) ─────────
delete from public.provider_services
where provider_id in (select id from public.providers where email like 'demo\_nur\_%@example.invalid' or email like 'demo\_xr\_%@example.invalid');

-- X-ray: each center offers its own service
insert into public.provider_services (provider_id, sub_service_id, custom_price, is_active)
select p.id, s.id,
       least(greatest(p.price, coalesce(s.price_min, 100)), coalesce(s.price_max, 1000)), true
from public.providers p
join public.sub_services s on s.service_name = 'أشعة منزلية' and s.name = p.specialty and s.is_active
where p.email like 'demo\_xr\_%@example.invalid';

-- Nursing: every nurse offers the service of her group; the first two of each group offer all nursing services
insert into public.provider_services (provider_id, sub_service_id, custom_price, is_active)
select p.id, s.id,
       least(greatest(p.price, coalesce(s.price_min, 100)), coalesce(s.price_max, 2000)), true
from public.providers p
join public.sub_services s on s.service_name = 'تمريض منزلي' and s.is_active and coalesce(s.group_name, '') <> 'grade'
where p.email like 'demo\_nur\_%@example.invalid'
  and (right(split_part(p.email, '@', 1), 1)::int <= 2
       or s.name = (select x.name from (select name, row_number() over (order by name) as i from public.sub_services
                                         where service_name = 'تمريض منزلي' and is_active and coalesce(group_name, '') <> 'grade') x
                    where x.i = split_part(split_part(p.email, '@', 1), '_', 3)::int));

select p.service_type, p.specialty, count(*) as providers, count(*) filter (where p.is_available) as available
from public.providers p
where p.email like 'demo\_nur\_%@example.invalid' or p.email like 'demo\_xr\_%@example.invalid'
group by 1, 2 order by 1, 2;
