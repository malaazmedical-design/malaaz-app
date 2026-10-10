-- Test project only. English names for admin-managed lists (specialties, governorates, cities, services).
-- The app shows name_en when the language is English; Arabic stays the source of truth.
alter table public.sub_services add column if not exists name_en text;
alter table public.coverage_areas add column if not exists name_en text;
alter table public.governorates add column if not exists name_en text;

update public.sub_services s set name_en = v.en
from (values
  ('باطنة','Internal Medicine'),('أطفال','Pediatrics'),('قلب','Cardiology'),('قلب وأوعية دموية','Cardiology'),('صدر','Chest'),
  ('عظام','Orthopedics'),('جلدية','Dermatology'),('نساء وتوليد','Obstetrics & Gynecology'),('أنف وأذن','Ear & Nose'),
  ('أنف وأذن وحنجرة','ENT (Ear, Nose & Throat)'),('مخ وأعصاب','Neurology'),('سكر وغدد','Diabetes & Endocrinology'),
  ('أخصائي نفسي وإرشاد','Psychologist & Counseling'),('الاورام','Oncology'),('أورام','Oncology'),('اسنان','Dentistry'),('أسنان','Dentistry'),
  ('الصدر والجهاز تنفسي','Chest & Respiratory'),('جراحة عامة','General Surgery'),('جراحة أوعية دموية','Vascular Surgery'),
  ('رمد','Ophthalmology'),('عيون','Ophthalmology'),('علاج طبيعي','Physical Therapy'),('كلي','Nephrology'),('مسالك بولية','Urology'),
  ('نفسية','Psychiatry'),('استشارة أونلاين','Online consultation'),
  ('إقامة 12 ساعة','12-hour stay'),('إقامة 24 ساعة','24-hour stay'),('خدمة سريعة','Quick service'),
  ('أشعة سينية','X-ray'),('موجات صوتية','Ultrasound'),('تخطيط قلب','ECG')
) as v(ar, en)
where s.name = v.ar and s.name_en is null;

update public.governorates g set name_en = v.en
from (values
  ('القاهرة','Cairo'),('الجيزة','Giza'),('الإسكندرية','Alexandria'),('القليوبية','Qalyubia'),('الشرقية','Sharqia'),('الدقهلية','Dakahlia'),
  ('الغربية','Gharbia'),('المنوفية','Monufia'),('البحيرة','Beheira'),('كفر الشيخ','Kafr El Sheikh'),('دمياط','Damietta'),('بورسعيد','Port Said'),
  ('الإسماعيلية','Ismailia'),('السويس','Suez'),('شمال سيناء','North Sinai'),('جنوب سيناء','South Sinai'),('الفيوم','Fayoum'),('بني سويف','Beni Suef'),
  ('المنيا','Minya'),('أسيوط','Assiut'),('سوهاج','Sohag'),('قنا','Qena'),('الأقصر','Luxor'),('أسوان','Aswan'),('البحر الأحمر','Red Sea'),
  ('الوادي الجديد','New Valley'),('مطروح','Matrouh')
) as v(ar, en)
where g.name = v.ar and g.name_en is null;

-- cities: same name as its governorate gets the same English name; the rest are filled from the admin panel
update public.coverage_areas a set name_en = g.name_en
from public.governorates g where a.name = g.name and a.name_en is null and g.name_en is not null;
