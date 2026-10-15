-- 08_unify_nurse_titles.sql — توحيد المسمى الوظيفي للتمريض على القايمة الرسمية (أخصائي تمريض / فني تمريض)
-- للتطبيق الأصلي فقط. شغّله بعد النسخة الاحتياطية. آمن ويتشغّل أكتر من مرة؛ بيحفظ القيم القديمة للرجوع.
--  * أي مسمى "أخصائي" بأي صيغة ← أخصائي تمريض
--  * اللي مسماه فاضي ومكتوب في تخصصه "أخصائي/اخصائى/اخصائيه…" ← أخصائي تمريض، و"فني…" ← فني تمريض
--  * باقي الفاضيين بيفضلوا فاضيين (التطبيق بيطلب منهم يحدّدوه بنفسهم)
--  * خانة التخصص بتتفضّى للتمريض (مفيش اختيار تخصص للتمريض، وكانت نص حر بيكرّر المسمى في الاسم)

create table if not exists public.nurse_titles_backup (
  provider_id uuid primary key,
  old_grade text,
  old_specialty text,
  changed_at timestamptz not null default now()
);
alter table public.nurse_titles_backup enable row level security;

insert into public.nurse_titles_backup (provider_id, old_grade, old_specialty)
select id, grade, specialty from public.providers where service_type = 'تمريض منزلي'
on conflict (provider_id) do nothing;

update public.providers p
   set grade = case
         when p.grade ~ '^\s*[أاإ]خصائ' then 'أخصائي تمريض'
         when p.grade ~ 'فني'            then 'فني تمريض'
         when coalesce(btrim(p.grade), '') = '' and p.specialty ~ '[أاإ]خصائ' then 'أخصائي تمريض'
         when coalesce(btrim(p.grade), '') = '' and p.specialty ~ 'فني'       then 'فني تمريض'
         else p.grade
       end,
       specialty = null
 where p.service_type = 'تمريض منزلي';

-- فحص: القيم النهائية للتمريض
select coalesce(grade, '<فاضي>') as grade, count(*) from public.providers
 where service_type = 'تمريض منزلي' group by 1 order by 2 desc;

-- للرجوع:
-- update public.providers p set grade = b.old_grade, specialty = b.old_specialty
--   from public.nurse_titles_backup b where b.provider_id = p.id;
