insert into public.providers
  (name, email, phone, service_type, specialty, grade, area, areas, bio, experience, rating, price, status, is_available, commission_rate, lat, lng)
select v.* from (values
  ('Demo Nurse Sara',    'demo1@example.invalid', '01000000001', 'تمريض منزلي', 'رعاية مسنين',          null,       'القاهرة', 'القاهرة والجيزة', 'ممرضة تجريبية — بيانات وهمية للاختبار فقط.', 5,  4.9, 450,  'active', true,  15, 30.0444, 31.2357),
  ('Demo Nurse Omar',    'demo2@example.invalid', '01000000002', 'تمريض منزلي', 'ما بعد العمليات',      null,       'الجيزة',  'الجيزة',          'ممرض تجريبي — بيانات وهمية للاختبار فقط.',  3,  4.7, 400,  'active', true,  15, 30.0131, 31.2089),
  ('Demo Nurse Hana',    'demo3@example.invalid', '01000000003', 'تمريض منزلي', 'حقن وتغيير جروح',      null,       'القاهرة', 'القاهرة',         'ممرضة تجريبية — بيانات وهمية للاختبار فقط.', 8,  5.0, 500,  'active', false, 15, 30.0626, 31.2497),
  ('Demo Doctor Karim',  'demo4@example.invalid', '01000000004', 'كشف منزلي',   'باطنة',                'استشاري',  'القاهرة', 'القاهرة والجيزة', 'طبيب تجريبي — بيانات وهمية للاختبار فقط.',  12, 4.9, 700,  'active', true,  15, 30.0561, 31.2394),
  ('Demo Doctor Mona',   'demo5@example.invalid', '01000000005', 'كشف منزلي',   'أطفال',                'أخصائي',   'الجيزة',  'الجيزة',          'طبيبة تجريبية — بيانات وهمية للاختبار فقط.', 7,  4.8, 550,  'active', true,  15, 30.0200, 31.2100),
  ('Demo Doctor Tarek',  'demo6@example.invalid', '01000000006', 'كشف منزلي',   'عظام',                 'استشاري',  'القاهرة', 'القاهرة',         'طبيب تجريبي — بيانات وهمية للاختبار فقط.',  15, 4.6, 800,  'active', false, 15, 30.0500, 31.2300),
  ('Demo Radiology Ali', 'demo7@example.invalid', '01000000007', 'أشعة منزلية', 'أشعة سينية',          null,       'القاهرة', 'القاهرة والجيزة', 'فني أشعة تجريبي — بيانات وهمية للاختبار فقط.', 6,  4.8, 450,  'active', true,  15, 30.0700, 31.2600),
  ('Demo Radiology Nour','demo8@example.invalid', '01000000008', 'أشعة منزلية', 'موجات صوتية',         null,       'الجيزة',  'الجيزة',          'فنية أشعة تجريبية — بيانات وهمية للاختبار فقط.', 4, 4.9, 600,  'active', true,  15, 30.0300, 31.2000),
  ('Demo Radiology Adel','demo9@example.invalid', '01000000009', 'أشعة منزلية', 'صدر',                 null,       'القاهرة', 'القاهرة',         'فني أشعة تجريبي — بيانات وهمية للاختبار فقط.', 9,  4.5, 520,  'active', false, 15, 30.0400, 31.2500)
) as v(name, email, phone, service_type, specialty, grade, area, areas, bio, experience, rating, price, status, is_available, commission_rate, lat, lng)
where not exists (select 1 from public.providers p where p.email = v.email);

insert into public.provider_services (provider_id, sub_service_id, custom_price, is_active)
select p.id, ss.id, coalesce(ss.price_min, p.price, 300), true
from public.providers p
join public.sub_services ss on ss.service_name = p.service_type and ss.is_active
where p.email like '%@example.invalid'
  and not exists (select 1 from public.provider_services x where x.provider_id = p.id and x.sub_service_id = ss.id);

insert into public.reviews (client_name, service_type, rating, text, is_approved, provider_id)
select r.n, p.service_type, 5, r.t, true, p.id
from public.providers p
cross join (values ('عميل تجريبي ١', 'خدمة ممتازة وسريعة'), ('عميل تجريبي ٢', 'تعامل راقي'), ('عميل تجريبي ٣', 'ممتاز جدًا')) as r(n, t)
where p.email in ('demo1@example.invalid', 'demo4@example.invalid', 'demo7@example.invalid')
  and not exists (select 1 from public.reviews x where x.provider_id = p.id and x.client_name = r.n);
