-- 11_booking_numbers.sql — رقم تسلسلي لكل حجز: B-1001 ثم B-1002 ...
-- آمن ويتشغّل أكتر من مرة. بيضيف عمود + عدّاد + Trigger، وبيرقّم الحجوزات القديمة بترتيب تاريخ الحجز. مفيش حذف ولا تعديل لأي بيانات تانية.
-- الرجوع: drop trigger booking_number_default on public.bookings; alter table public.bookings drop column booking_number; drop sequence public.booking_seq;

alter table public.bookings add column if not exists booking_number text;
create sequence if not exists public.booking_seq start 1001;

-- 1) ترقيم الحجوزات القديمة (اللي لسه من غير رقم) بترتيب تاريخ الإنشاء، بأمر واحد (مفيش إشعارات بتتبعت: الـTrigger بتاع الإشعارات بيتفعّل على status/on_way_at بس)
with base as (select coalesce(max(substring(booking_number from 3)::int), 1000) as n from public.bookings where booking_number ~ '^B-[0-9]+$'),
ordered as (select id, row_number() over (order by created_at, id) as rn from public.bookings where booking_number is null)
update public.bookings b set booking_number = 'B-' || (base.n + o.rn)
  from ordered o, base where b.id = o.id;
select setval('public.booking_seq', greatest((select coalesce(max(substring(booking_number from 3)::int), 1000) from public.bookings where booking_number ~ '^B-[0-9]+$'), (select last_value from public.booking_seq)), true);

-- 2) أي حجز جديد ياخد رقمه أوتوماتيك (nextval آمن حتى لو اتنين حجزوا في نفس اللحظة)
create or replace function public.booking_number_default()
returns trigger language plpgsql as $$
begin
  if new.booking_number is null then
    new.booking_number := 'B-' || nextval('public.booking_seq');
  end if;
  return new;
end $$;
drop trigger if exists booking_number_default on public.bookings;
create trigger booking_number_default before insert on public.bookings
  for each row execute function public.booking_number_default();

-- 3) الرقم لا يتكرر ولا يتغيّر بعد كده
create unique index if not exists bookings_booking_number_key on public.bookings (booking_number);
create or replace function public.booking_number_lock()
returns trigger language plpgsql as $$
begin
  if old.booking_number is not null and new.booking_number is distinct from old.booking_number then
    new.booking_number := old.booking_number;
  end if;
  return new;
end $$;
drop trigger if exists booking_number_lock on public.bookings;
create trigger booking_number_lock before update on public.bookings
  for each row execute function public.booking_number_lock();
