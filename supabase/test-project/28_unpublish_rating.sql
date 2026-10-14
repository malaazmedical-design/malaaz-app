-- Test project only. Admin can take an approved rating off the doctor's page ("إلغاء النشر").
-- The rating stays in the consultation (hidden) and can be approved again later.
alter table public.consultations add column if not exists rating_hidden boolean not null default false;

create or replace function public.admin_unpublish_rating(p_id uuid)
 returns text language plpgsql security definer set search_path to 'public'
as $$
begin
  if not public.is_admin() then return 'forbidden'; end if;
  update public.consultations set rating_ok = false, rating_hidden = true where id = p_id and rating is not null and rating_ok;
  if not found then return 'locked'; end if;
  delete from public.reviews where consultation_id = p_id;
  return 'ok';
end; $$;
revoke all on function public.admin_unpublish_rating(uuid) from public, anon;
grant execute on function public.admin_unpublish_rating(uuid) to authenticated;

-- approving again clears the "hidden" mark
create or replace function public.admin_approve_rating(p_id uuid)
 returns text language plpgsql security definer set search_path to 'public'
as $$
declare c public.consultations;
begin
  if not public.is_admin() then return 'forbidden'; end if;
  update public.consultations set rating_ok = true, rating_hidden = false where id = p_id and rating is not null returning * into c;
  if c.id is null then return 'locked'; end if;
  insert into public.reviews (client_name, service_type, rating, text, is_approved, provider_id, consultation_id)
  values (coalesce(nullif(trim(c.client_name), ''), 'عميل'), 'استشارة أونلاين', c.rating, c.rating_text, true, c.provider_id, c.id)
  on conflict (consultation_id) where consultation_id is not null do nothing;
  return 'ok';
end; $$;
revoke all on function public.admin_approve_rating(uuid) from public, anon;
grant execute on function public.admin_approve_rating(uuid) to authenticated;

drop function if exists public.admin_consultations();
create or replace function public.admin_consultations()
 returns table (id uuid, case_number text, client_name text, client_phone text, provider_name text, provider_specialty text,
                channel text, price numeric, duration_min int, period_date date, period text, pay_method text, pay_status text,
                cancel_reason text, pay_deadline timestamptz, paid_at timestamptz, prop_at timestamptz, prop_status text,
                appt_at timestamptz, state text, started_at timestamptz, ended_at timestamptz, no_show boolean, refunded boolean,
                rating int, rating_text text, rating_ok boolean, created_at timestamptz, alerts text[], admin_contacted_at timestamptz,
                sum_note text, sum_recs text, sum_follow text, sum_at timestamptz, rating_hidden boolean)
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
           case when c.rating is not null and not c.rating_ok and not c.rating_hidden then 'rating' end,
           case when c.no_show and not c.refunded then 'no_show' end
         ], null),
         c.admin_contacted_at, c.sum_note, c.sum_recs, c.sum_follow, c.sum_at, c.rating_hidden
  from public.consultations c
  join public.clients cl on cl.id = c.client_id
  join public.providers p on p.id = c.provider_id
  where public.is_admin()
  order by c.created_at desc
  limit 300;
$$;
revoke all on function public.admin_consultations() from public, anon;
grant execute on function public.admin_consultations() to authenticated;
