-- Test project only. 5 demo doctors for EVERY doctor specialty (from sub_services, plus the standard list),
-- each with a home-visit price, an online consultation (chat) and, for some, voice / video channels,
-- so the online-consultation list, ask-a-doctor routing and booking can all be tried.
-- Fake data only (emails end with @example.invalid). Safe to re-run (skips existing, rebuilds their services).
-- If you re-run 06_seed_test_providers.sql afterwards, run this file again (06 resets demo providers' services).

with specs as (
  select name, row_number() over (order by name) as i from (
    select name from public.sub_services where service_name = 'كشف منزلي' and group_name = 'specialty' and is_active
    union
    select unnest(array['باطنة','أطفال','قلب','صدر','عظام','جلدية','نساء وتوليد','أنف وأذن','مخ وأعصاب','سكر وغدد'])
  ) s
),
names as (
  select * from unnest(array[
    'أحمد سمير','محمود عادل','كريم حسن','يوسف مجدي','طارق فؤاد','عمر خالد','هشام رضا','وائل صلاح','مصطفى نبيل','إسلام ماهر',
    'منى إبراهيم','سارة عماد','هالة مصطفى','نهى عبد الله','دينا شريف','رنا وجدي','ليلى حسام','مي أشرف','هبة سعيد','نادية فاروق',
    'باسم عوض','شادي لطفي','ياسر منصور','أمير زكي','تامر عزت','سلمى عادل','داليا فتحي','ريم صبري','آية محسن','نورهان طه',
    'خالد جمال','عماد رشدي','حازم سامي','رامي كمال','أيمن شوقي','إيمان رأفت','غادة نصر','شيماء حلمي','مروة يحيى','سمر هلال',
    'فادي سعد','بسام وحيد','ماجد عصام','عصام توفيق','محسن رفعت','ولاء ناجي','أسماء بدر','رحاب مراد','جيهان فهمي','سحر عباس'
  ]) with ordinality as t(nm, ord)
),
loc as (
  select * from (values
    (0, 'القاهرة', 'القاهرة والجيزة', 30.0561, 31.2394),
    (1, 'الجيزة', 'الجيزة', 30.0131, 31.2089),
    (2, 'الإسكندرية', 'الإسكندرية', 31.2001, 29.9187),
    (3, 'القاهرة', 'القاهرة', 30.0626, 31.2497),
    (4, 'الجيزة', 'القاهرة والجيزة', 30.0200, 31.2100)
  ) as l(k, area, areas, lat, lng)
),
rows as (
  select s.name as specialty, s.i, g.n,
         n.nm,
         case when g.n % 2 = 1 then 'استشاري' else 'أخصائي' end as grade,
         'demo_doc_' || s.i || '_' || g.n || '@example.invalid' as email,
         '0102' || lpad((s.i * 10 + g.n)::text, 7, '0') as phone,
         l.area, l.areas, l.lat, l.lng,
         (4.3 + ((s.i * 7 + g.n * 3) % 8) / 10.0)::numeric(2,1) as rating,
         3 + ((s.i * 5 + g.n * 4) % 16) as exp,
         (g.n <> 5) as avail
  from specs s
  cross join generate_series(1, 5) as g(n)
  join names n on n.ord = ((s.i - 1) * 5 + g.n - 1) % 50 + 1
  join loc l on l.k = g.n - 1
)
insert into public.providers
  (name, email, phone, service_type, specialty, grade, area, areas, bio, experience, rating, price, status, is_available, commission_rate, lat, lng)
select r.nm, r.email, r.phone, 'كشف منزلي', r.specialty, r.grade, r.area, r.areas,
       'طبيب تجريبي ' || r.specialty || ' — بيانات وهمية للاختبار فقط.', r.exp, r.rating,
       case when r.grade = 'استشاري' then 600 + r.n * 20 else 350 + r.n * 20 end,
       'active', r.avail, 15, r.lat, r.lng
from rows r
where not exists (select 1 from public.providers p where p.email = r.email);

-- rebuild services for these demo doctors
delete from public.provider_services
where provider_id in (select id from public.providers where email like 'demo_doc\_%@example.invalid');
delete from public.provider_channels
where provider_id in (select id from public.providers where email like 'demo_doc\_%@example.invalid');

-- home visit (their specialty row, price inside the admin range for their grade)
insert into public.provider_services (provider_id, sub_service_id, custom_price, is_active)
select p.id, s.id,
       least(greatest(p.price,
         coalesce(case when p.grade = 'استشاري' then s.price_min_consultant else s.price_min_specialist end, s.price_min, 200)),
         coalesce(case when p.grade = 'استشاري' then s.price_max_consultant else s.price_max_specialist end, s.price_max, 1000)),
       true
from public.providers p
join public.sub_services s on s.service_name = 'كشف منزلي' and s.group_name = 'specialty' and s.name = p.specialty and s.is_active
where p.email like 'demo_doc\_%@example.invalid';

-- online consultation (chat), duration 15 min, price inside the admin range
insert into public.provider_services (provider_id, sub_service_id, custom_price, is_active, duration_min)
select p.id, s.id,
       least(greatest(150 + (length(p.name) % 5) * 20,
         coalesce(case when p.grade = 'استشاري' then s.price_min_consultant else s.price_min_specialist end, s.price_min, 100)),
         coalesce(case when p.grade = 'استشاري' then s.price_max_consultant else s.price_max_specialist end, s.price_max, 500)),
       true, 15
from public.providers p
join lateral (select * from public.sub_services x where x.service_name = 'كشف منزلي' and x.group_name = 'online' and x.is_active order by x.created_at, x.id limit 1) s on true
where p.email like 'demo_doc\_%@example.invalid';

-- voice for doctors 1-3 of each specialty, video for doctors 1-2
insert into public.provider_channels (provider_id, channel, price, duration_min, is_active)
select distinct on (p.id, c.ch) p.id, c.ch, ps.custom_price + c.plus, 15, true
from public.providers p
join public.sub_services s on s.service_name = 'كشف منزلي' and s.group_name = 'online'
join public.provider_services ps on ps.provider_id = p.id and ps.sub_service_id = s.id
cross join (values ('voice', 30, 3), ('video', 60, 2)) as c(ch, plus, upto)
where p.email like 'demo_doc\_%@example.invalid'
  and right(split_part(p.email, '@', 1), 1)::int <= c.upto;

select p.specialty, count(*) as doctors,
       count(*) filter (where p.is_available) as available
from public.providers p where p.email like 'demo_doc\_%@example.invalid'
group by p.specialty order by p.specialty;
