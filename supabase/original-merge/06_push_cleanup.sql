-- 06_push_cleanup.sql — تنضيف توكنات الإشعارات لعملاء ملهمش حساب (ضيوف) على الأصلي فقط
-- القاعدة: مفيش إشعارات من غير تسجيل دخول. بيمسح توكنات "العميل" اللي رقمها مش تابع لحساب عميل مسجّل.
-- (توكنات المقدمين والأدمن مش بتتلمس.) آمن: الجهاز بيسجّل توكنه تاني أول ما صاحبه يدخل بحسابه.

-- نسخة احتياطية صغيرة للرجوع
create table if not exists public.push_tokens_cleanup_backup as
  select * from public.push_tokens where false;
alter table public.push_tokens_cleanup_backup enable row level security;

insert into public.push_tokens_cleanup_backup
select * from public.push_tokens
 where owner_type = 'client'
   and (phone is null or phone not in (select phone from public.clients where phone is not null));

delete from public.push_tokens
 where owner_type = 'client'
   and (phone is null or phone not in (select phone from public.clients where phone is not null));

select owner_type, count(*) from public.push_tokens group by owner_type order by 1;
