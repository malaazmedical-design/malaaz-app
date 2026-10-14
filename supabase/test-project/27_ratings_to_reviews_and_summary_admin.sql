-- Test project only.
--  1) Approving a consultation rating publishes it as a review (doctor page + average rating). No duplicates.
--  2) The admin list also returns the doctor's summary.

alter table public.reviews add column if not exists consultation_id uuid;
create unique index if not exists reviews_consultation_uniq on public.reviews (consultation_id) where consultation_id is not null;

create or replace function public.admin_approve_rating(p_id uuid)
 returns text language plpgsql security definer set search_path to 'public'
as $$
declare c public.consultations;
begin
  if not public.is_admin() then return 'forbidden'; end if;
  update public.consultations set rating_ok = true where id = p_id and rating is not null returning * into c;
  if c.id is null then return 'locked'; end if;
  insert into public.reviews (client_name, service_type, rating, text, is_approved, provider_id, consultation_id)
  values (coalesce(nullif(trim(c.client_name), ''), 'عميل'), 'استشارة أونلاين', c.rating, c.rating_text, true, c.provider_id, c.id)
  on conflict (consultation_id) where consultation_id is not null do nothing;
  return 'ok';
end; $$;
revoke all on function public.admin_approve_rating(uuid) from public, anon;
grant execute on function public.admin_approve_rating(uuid) to authenticated;

-- ratings approved before this file existed
insert into public.reviews (client_name, service_type, rating, text, is_approved, provider_id, consultation_id)
select coalesce(nullif(trim(c.client_name), ''), 'عميل'), 'استشارة أونلاين', c.rating, c.rating_text, true, c.provider_id, c.id
from public.consultations c where c.rating_ok and c.rating is not null
on conflict (consultation_id) where consultation_id is not null do nothing;

drop function if exists public.admin_consultations();
create or replace function public.admin_consultations()
 returns table (id uuid, case_number text, client_name text, client_phone text, provider_name text, provider_specialty text,
                channel text, price numeric, duration_min int, period_date date, period text, pay_method text, pay_status text,
                cancel_reason text, pay_deadline timestamptz, paid_at timestamptz, prop_at timestamptz, prop_status text,
                appt_at timestamptz, state text, started_at timestamptz, ended_at timestamptz, no_show boolean, refunded boolean,
                rating int, rating_text text, rating_ok boolean, created_at timestamptz, alerts text[], admin_contacted_at timestamptz,
                sum_note text, sum_recs text, sum_follow text, sum_at timestamptz)
 language sql stable security definer set search_path to 'public'
as $$
  select c.id, c.case_number, c.client_name, cl.phone, p.name, p.specialty,
         c.channel, c.price, c.duration_min, c.period_date, c.period, c.pay_method, c.pay_status,
         c.cancel_reason, c.pay_deadline, c.paid_at, c.prop_at, c.prop_status,
         c.appt_at, c.state, c.started_at, c.ended_at, c.no_show, c.refunded,
         c.rating, c.rating_text, c.rating_ok, c.created_at,
         array_remove(array[
           case when c.pay_status = 'pending' and c.pay_deadline < now() then 'deadline' end,
           case when c.pay_status = 'paid' and c.prop_status = 'none' and c.paid_at < now() - interval '30 minutes' then 'no_proposal' end,
           case when c.prop_status = 'pending' and c.updated_at < now() - interval '30 minutes' then 'client_silent' end,
           case when c.prop_status = 'no' then 'client_rejected' end,
           case when c.state = 'wait' and c.prop_status = 'ok' and c.appt_at + interval '15 minutes' < now() and c.admin_contacted_at is null then 'doctor_late' end,
           case when c.rating is not null and not c.rating_ok then 'rating' end,
           case when c.no_show and not c.refunded then 'no_show' end
         ], null),
         c.admin_contacted_at, c.sum_note, c.sum_recs, c.sum_follow, c.sum_at
  from public.consultations c
  join public.clients cl on cl.id = c.client_id
  join public.providers p on p.id = c.provider_id
  where public.is_admin()
  order by c.created_at desc
  limit 300;
$$;
revoke all on function public.admin_consultations() from public, anon;
grant execute on function public.admin_consultations() to authenticated;
