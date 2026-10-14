-- 04_unify_specialties.sql — توحيد تخصصات الأطباء القدام على القايمة الرسمية (sub_services)
-- للتطبيق الأصلي فقط (omsictbrqlsohrmxeuym). شغّله بعد النسخة الاحتياطية وبعد مراجعة الأسماء.
-- آمن: بيحفظ القيم القديمة في جدول specialty_unify_backup (للرجوع)، وبيعدّل بالـ id مش بالاسم.
-- الجزء (أ) واضح ومتنفّذ. الجزء (ب) محتاج قرارك — متعلّق (commented) لحد ما تختار.

create table if not exists public.specialty_unify_backup (
  provider_id uuid primary key,
  old_specialty text,
  old_grade text,
  changed_at timestamptz not null default now()
);
alter table public.specialty_unify_backup enable row level security;  -- من غير policies = للأدمن/السيرفر فقط

-- (أ) تحويلات واضحة: id → (تخصص رسمي، درجة لو كانت مكتوبة داخل النص)
drop table if exists _map;
create temp table _map(id uuid, new_specialty text, new_grade text);
insert into _map values
  ('585f7da8-c1cd-4dee-be14-ccb56240f6f8', 'باطنة',               null),        -- أمراض باطنية و صدرية
  ('e3e495bd-1d60-4282-9b17-e9654d37ac7f', 'مخ وأعصاب',           'استشاري'),   -- استشاري أمراض مخ وأعصاب
  ('cee59609-e288-4947-9464-35c75c6aadad', 'علاج طبيعي',          'استشاري'),   -- استشاري علاج طبيعي
  ('d94b0f66-96a3-439d-a846-fe0f35946f31', 'باطنة',               null),        -- الباطنية العامة
  ('1b9ae930-7bc6-410e-b277-cc5408689ef8', 'أنف وأذن وحنجرة',     null),        -- انف واذن وحنجرة
  ('eb23efd2-a4de-45a3-9372-1b111af2441b', 'باطنة',               null),        -- باطنه عامه و سكر و ضغط و كبد و جهاز هضمي
  ('b775606b-698b-4316-96c5-76dc0b9fcbd3', 'باطنة',               null),        -- باطنيه
  ('02dc9cd0-a39b-4162-902e-0d6704dfc449', 'جراحة عامة',          null),        -- جراحة عامة - جراحة اورام - قولون…
  ('df99ace8-d5ab-4986-93ca-a868dfd699ee', 'جراحة عامة',          null),        -- جراحة عامة,طب عام
  ('0f26aaf2-9996-4fb8-b23d-f96258f01408', 'جلدية',               null),        -- جلدية وتناسلية
  ('234232ab-9286-4527-8cae-b69ba9b16b7a', 'أخصائي نفسي وإرشاد',  null),        -- جلسات نفسيه
  ('18aea9d7-1f37-451f-80d0-8d9d6a3b0dc3', 'أخصائي نفسي وإرشاد',  null),        -- علاج نفسي
  ('f9774f75-df49-4869-af0d-8072cec6d554', 'أخصائي نفسي وإرشاد',  null),        -- معالج نفسي
  ('ab3fe473-2c24-462b-ab07-baf9355fcb24', 'أطفال',               null),        -- حميات. أطفال وحديثى الولاده
  ('dacf5de1-5cbe-40ad-b64f-85f39bf4860b', 'قلب',                 null);        -- كشف قلب و ايكو

-- (ب) محتاجة قرارك — شيل -- واختار التخصص اللي يناسب:
-- ('cdb8ecc7-fd44-402e-9c0e-6952d851d91b', 'قلب'  أو 'باطنة', null),  -- باطنه قلب و اوعيه دمويه
-- ('1940c20a-965a-4d52-8c10-bff47aedb038', 'كلي'  أو 'باطنة', null),  -- باطنه وكلى وسكر
-- ('9b50f120-feb3-4c6a-9a52-f728e50b50ec', 'قلب'  أو 'باطنة', null),  -- قلب وباطنه
-- ('68e94c5b-e3ed-401b-bb33-cd538bc7c189', 'مخ وأعصاب',        null),  -- جراحه مخ واعصاب وعمود فقري
-- ('752de425-1097-49bd-ae9b-35d5da5bf016', ?, null),                   -- Abdelrahman Elbanna (بدون تخصص)
-- ('a407f6e5-0e14-41c9-9dcb-eceed4eca169', ?, null),                   -- مني محمد رجب (بدون تخصص)

-- حماية: ما نحوّلش لاسم مش موجود في القايمة الرسمية
do $$
begin
  if exists (
    select 1 from _map m
    where not exists (select 1 from public.sub_services s
                      where s.service_name = 'كشف منزلي' and s.group_name = 'specialty' and s.name = m.new_specialty)
  ) then
    raise exception 'تخصص في الجدول مش موجود في sub_services — راجع الأسماء';
  end if;
end $$;

-- نسخة احتياطية من القيم القديمة (مرة واحدة لكل مقدم)
insert into public.specialty_unify_backup(provider_id, old_specialty, old_grade)
select p.id, p.specialty, p.grade from public.providers p join _map m on m.id = p.id
on conflict (provider_id) do nothing;

-- التنفيذ (الدرجة بتتملي بس لو كانت فاضية)
update public.providers p
   set specialty = m.new_specialty,
       grade     = coalesce(p.grade, m.new_grade)
  from _map m
 where p.id = m.id;

-- فحص: لازم يرجّع صفر (إلا الحالات المتعلّقة في الجزء ب)
select p.name, p.specialty
  from public.providers p
 where p.service_type = 'كشف منزلي'
   and (p.specialty is null or p.specialty not in
        (select name from public.sub_services where service_name = 'كشف منزلي' and group_name = 'specialty'));

drop table if exists _map;

-- للرجوع لو احتجت:
-- update public.providers p set specialty=b.old_specialty, grade=b.old_grade
--   from public.specialty_unify_backup b where b.provider_id=p.id;
