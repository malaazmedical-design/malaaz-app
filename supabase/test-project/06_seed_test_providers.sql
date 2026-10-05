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
  ('Demo Radiology Adel','demo9@example.invalid', '01000000009', 'أشعة منزلية', 'صدر',                 null,       'القاهرة', 'القاهرة',         'فني أشعة تجريبي — بيانات وهمية للاختبار فقط.', 9,  4.5, 520,  'active', false, 15, 30.0400, 31.2500),
  ('Demo Nurse Yara',    'demo10@example.invalid','01000000010', 'تمريض منزلي', 'رعاية أطفال',         null,       'الإسكندرية','الإسكندرية',    'ممرضة تجريبية — بيانات وهمية للاختبار فقط.', 6,  4.8, 480,  'active', true,  15, 31.2001, 29.9187),
  ('Demo Nurse Hossam',  'demo11@example.invalid','01000000011', 'تمريض منزلي', 'ما بعد العمليات',     null,       'القاهرة', 'القاهرة والجيزة', 'ممرض تجريبي — بيانات وهمية للاختبار فقط.',  10, 4.9, 520,  'active', true,  15, 30.0500, 31.3000),
  ('Demo Nurse Dina',    'demo12@example.invalid','01000000012', 'تمريض منزلي', 'رعاية مسنين',         null,       'الجيزة',  'الجيزة',          'ممرضة تجريبية — بيانات وهمية للاختبار فقط.', 2,  4.4, 380,  'active', false, 15, 29.9870, 31.2118),
  ('Demo Nurse Fady',    'demo13@example.invalid','01000000013', 'تمريض منزلي', 'حقن وتغيير جروح',      null,       'القاهرة', 'القاهرة',         'ممرض تجريبي — بيانات وهمية للاختبار فقط.',  4,  4.7, 420,  'active', true,  15, 30.0800, 31.3300),
  ('Demo Doctor Layla',  'demo14@example.invalid','01000000014', 'كشف منزلي',   'قلب',                  'استشاري',  'القاهرة', 'القاهرة',         'طبيبة تجريبية — بيانات وهمية للاختبار فقط.', 14, 4.9, 850,  'active', true,  15, 30.0600, 31.2200),
  ('Demo Doctor Samir',  'demo15@example.invalid','01000000015', 'كشف منزلي',   'نساء وتوليد',          'أخصائي',   'الجيزة',  'الجيزة',          'طبيب تجريبي — بيانات وهمية للاختبار فقط.',  9,  4.6, 650,  'active', true,  15, 30.0100, 31.2000),
  ('Demo Doctor Hala',   'demo16@example.invalid','01000000016', 'كشف منزلي',   'باطنة',                'أخصائي',   'الإسكندرية','الإسكندرية',    'طبيبة تجريبية — بيانات وهمية للاختبار فقط.', 8,  4.8, 600,  'active', false, 15, 31.2100, 29.9300),
  ('Demo Doctor Wael',   'demo17@example.invalid','01000000017', 'كشف منزلي',   'أطفال',                'استشاري',  'القاهرة', 'القاهرة والجيزة', 'طبيب تجريبي — بيانات وهمية للاختبار فقط.',  18, 4.9, 900,  'active', true,  15, 30.0450, 31.2650),
  ('Demo Radiology Mai', 'demo18@example.invalid','01000000018', 'أشعة منزلية', 'أشعة سينية',          null,       'الجيزة',  'الجيزة',          'فنية أشعة تجريبية — بيانات وهمية للاختبار فقط.', 5, 4.7, 480, 'active', true,  15, 30.0050, 31.2150),
  ('Demo Radiology Osama','demo19@example.invalid','01000000019','أشعة منزلية', 'موجات صوتية',         null,       'القاهرة', 'القاهرة',         'فني أشعة تجريبي — بيانات وهمية للاختبار فقط.', 7,  4.8, 620,  'active', true,  15, 30.0650, 31.2450),
  ('Demo Radiology Rana','demo20@example.invalid','01000000020', 'أشعة منزلية', 'عظام',                null,       'الإسكندرية','الإسكندرية',    'فنية أشعة تجريبية — بيانات وهمية للاختبار فقط.', 3, 4.5, 550, 'active', false, 15, 31.2050, 29.9250)
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
where p.email in ('demo1@example.invalid', 'demo2@example.invalid', 'demo4@example.invalid', 'demo5@example.invalid', 'demo7@example.invalid', 'demo8@example.invalid', 'demo14@example.invalid', 'demo17@example.invalid')
  and not exists (select 1 from public.reviews x where x.provider_id = p.id and x.client_name = r.n);
