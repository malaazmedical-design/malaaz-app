-- Admin "العملاء" page: every client in the database with his activity, and the details of one client.
-- The clients table is protected by RLS (a client reads only his own row, and there is no admin policy),
-- so the old page showed the admin only his own row. These two functions are admin-only and read everything.
-- Deleted accounts (kept only as anonymous anchors for old bookings) are hidden.

create or replace function public.admin_clients()
 returns table (id uuid, name text, email text, phone text, auth_id uuid, created_at timestamptz,
                bookings_count bigint, consults_count bigint, asks_count bigint, last_activity timestamptz)
 language sql stable security definer set search_path to 'public'
as $$
  select c.id, c.name, c.email, c.phone, c.auth_id, c.created_at,
         (select count(*) from public.bookings b where b.client_id = c.id or (b.client_id is null and b.phone = c.phone)),
         (select count(*) from public.consultations k where k.client_id = c.id),
         (select count(*) from public.ask_doctor_cases a where a.client_id = c.id),
         greatest(c.created_at,
                  (select max(b.created_at) from public.bookings b where b.client_id = c.id or (b.client_id is null and b.phone = c.phone)),
                  (select max(k.created_at) from public.consultations k where k.client_id = c.id),
                  (select max(a.created_at) from public.ask_doctor_cases a where a.client_id = c.id))
    from public.clients c
   where public.is_admin() and c.phone not like 'deleted-%'
   order by 10 desc nulls last
   limit 5000;
$$;
revoke all on function public.admin_clients() from public, anon;
grant execute on function public.admin_clients() to authenticated;

create or replace function public.admin_client_detail(p_id uuid)
 returns jsonb language plpgsql stable security definer set search_path to 'public'
as $$
declare c public.clients; v jsonb;
begin
  if not public.is_admin() then return null; end if;
  select * into c from public.clients where id = p_id;
  if c.id is null then return null; end if;
  select jsonb_build_object(
    'bookings', coalesce((select jsonb_agg(x order by x.created_at desc) from (
        select b.id, b.created_at, b.service_type, b.sub_option, b.status, b.price, b.payment_status, b.payment_method,
               b.appointment_time, b.appointment_at, b.area, p.name as provider_name
          from public.bookings b left join public.providers p on p.id = b.provider_id
         where b.client_id = c.id or (b.client_id is null and b.phone = c.phone)) x), '[]'::jsonb),
    'consultations', coalesce((select jsonb_agg(x order by x.created_at desc) from (
        select k.id, k.created_at, k.case_number, k.channel, k.price, k.pay_status, k.doctor_status, k.prop_status, k.state,
               k.appt_at, k.no_show, p.name as provider_name
          from public.consultations k left join public.providers p on p.id = k.provider_id
         where k.client_id = c.id) x), '[]'::jsonb),
    'asks', coalesce((select jsonb_agg(x order by x.created_at desc) from (
        select a.id, a.created_at, a.case_number, a.status, left(a.message, 120) as message
          from public.ask_doctor_cases a where a.client_id = c.id) x), '[]'::jsonb)
  ) into v;
  return v;
end; $$;
revoke all on function public.admin_client_detail(uuid) from public, anon;
grant execute on function public.admin_client_detail(uuid) to authenticated;
