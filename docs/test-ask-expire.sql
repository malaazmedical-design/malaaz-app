-- اختبار 7.4 (مشروع التست فقط): سؤال ما اترد عليه 48 ساعة يتحول "انتهت المهلة".
-- قبل التشغيل: اعمل سؤال جديد من التطبيق وسيبه من غير رد (ما توجّهوش لدكتور).
-- الأمر ده بيعمّق عمر آخر سؤال لسه ماحدش اتعيّن عليه لـ 49 ساعة، وبعدين بيشغّل فحص انتهاء المهلة.

with last_case as (
  select id from public.ask_doctor_cases
   where status in ('new', 'routed') and assigned_doctor_id is null
   order by created_at desc limit 1
)
update public.ask_doctor_cases c
   set created_at = now() - interval '49 hours'
  from last_case where c.id = last_case.id
returning c.case_number, c.status as status_before;

select public.ask_expire_tick() as expired_count;   -- المفروض يرجّع 1 (أو أكتر لو فيه أسئلة قديمة)

select case_number, status, created_at
  from public.ask_doctor_cases
 order by updated_at desc limit 3;                  -- السؤال المقصود المفروض يبقى status = expired
