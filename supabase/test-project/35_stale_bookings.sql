-- Test project: bookings that the provider accepted but never closed (not completed / cancelled).
--   * bookings.appointment_at: a real timestamp for the end of the chosen period (the app only stores free text such as
--     "الثلاثاء 14 أكتوبر ظهراً (12 - 4)"). A trigger fills it on every insert, for every app version.
--   * 3 hours after the appointment window  -> push to the provider ("هل أنهيت الزيارة؟")
--   * 24 hours after                        -> second push to the provider + an alert row for the admin
--   * nothing is closed automatically: only the provider or the admin decides (completed / cancelled)
--   Old bookings (more than 14 days past) are never pushed, so rolling this out cannot spam providers.
alter table public.bookings add column if not exists appointment_at timestamptz;
alter table public.bookings add column if not exists stale_level int not null default 0;

create or replace function public.booking_appointment_at(p_text text, p_created timestamptz)
 returns timestamptz language plpgsql stable set search_path to 'public'
as $$
declare
  t text := coalesce(p_text, '');
  c date := (p_created at time zone 'Africa/Cairo')::date;
  d date := c;
  h int;
  pre text;
  dd int;
  cand date;
begin
  if t = '' or t like '%أسرع%' then return p_created + interval '3 hours'; end if;
  h := case when t like '%صباح%' then 12 when t like '%ظهر%' then 16 when t like '%مساء%' then 21 end;
  if h is null then return p_created + interval '3 hours'; end if;
  -- the day label comes before the period word; its day-of-month may use Arabic-Indic digits
  pre := regexp_replace(translate(t, '٠١٢٣٤٥٦٧٨٩', '0123456789'), '\s*(صباح|ظهر|مساء).*$', '');
  dd := nullif(substring(pre from '(\d{1,2})'), '')::int;
  if dd is not null and dd between 1 and 31 then
    cand := (date_trunc('month', c)::date + (dd - 1));
    if cand < c then cand := (date_trunc('month', c) + interval '1 month')::date + (dd - 1); end if;
    d := cand;
  end if;
  return (d::timestamp + h * interval '1 hour') at time zone 'Africa/Cairo';
end; $$;

create or replace function public.bookings_set_appointment_at()
 returns trigger language plpgsql set search_path to 'public'
as $$
begin
  if new.appointment_at is null then
    new.appointment_at := public.booking_appointment_at(new.appointment_time, coalesce(new.created_at, now()));
  end if;
  return new;
end; $$;
drop trigger if exists trg_bookings_appointment_at on public.bookings;
create trigger trg_bookings_appointment_at before insert on public.bookings
  for each row execute function public.bookings_set_appointment_at();

create or replace function public.stale_bookings_tick()
 returns int language plpgsql security definer set search_path to 'public', 'extensions'
as $$
declare b public.bookings; n int := 0; v_svc text; v_msg text;
begin
  for b in select * from public.bookings
            where status = 'confirmed' and provider_id is not null and stale_level = 0
              and appointment_at < now() - interval '3 hours' and appointment_at >= now() - interval '24 hours' loop
    v_svc := coalesce(b.sub_option, b.service_type, '');
    perform public.send_expo_push(public.provider_push_tokens(b.provider_id),
      'هل أنهيت الزيارة؟', coalesce(b.patient_name, 'العميل') || ' · ' || v_svc || ' — حدّد: مكتمل أو ملغي',
      jsonb_build_object('kind', 'booking_stale', 'booking_id', b.id, 'direct', true));
    update public.bookings set stale_level = 1 where id = b.id;
    n := n + 1;
  end loop;

  for b in select * from public.bookings
            where status = 'confirmed' and provider_id is not null and stale_level < 2
              and appointment_at < now() - interval '24 hours' and appointment_at > now() - interval '14 days' loop
    v_svc := coalesce(b.sub_option, b.service_type, '');
    perform public.send_expo_push(public.provider_push_tokens(b.provider_id),
      'تذكير: حجز لم يُغلق', coalesce(b.patient_name, 'العميل') || ' · ' || v_svc || ' — مر أكثر من يوم على الموعد',
      jsonb_build_object('kind', 'booking_stale', 'booking_id', b.id, 'direct', true));
    v_msg := 'حجز ' || coalesce(b.patient_name, '') || ' (' || coalesce(b.area, '') || ') مؤكد ولم يُغلق بعد مرور 24 ساعة على موعده. راجع مقدم الخدمة.';
    insert into public.admin_alerts (booking_id, level, message, whatsapp_link)
    values (b.id, 3, v_msg, 'https://wa.me/?text=' || encode(convert_to(v_msg, 'UTF8'), 'escape'));
    update public.bookings set stale_level = 2 where id = b.id;
    n := n + 1;
  end loop;
  return n;
end; $$;
revoke all on function public.stale_bookings_tick() from public, anon, authenticated;

do $$ begin
  begin perform cron.unschedule('stale-bookings-tick'); exception when others then null; end;
  perform cron.schedule('stale-bookings-tick', '*/10 * * * *', 'select public.stale_bookings_tick()');
end $$;
