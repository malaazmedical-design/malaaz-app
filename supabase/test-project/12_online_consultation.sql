-- Test project only: "online consultation" as a priced service for doctors.
-- It is a sub_service of "كشف منزلي" with group_name = 'online' (NOT a bookable home visit: the client app ignores it
-- for booking and for the provider's "from X EGP" price). Admin ranges are editable later.
insert into public.sub_services
  (service_name, name, group_name, duration, price_min, price_max,
   price_min_specialist, price_max_specialist, price_min_consultant, price_max_consultant, is_active)
select 'كشف منزلي', 'استشارة أونلاين', 'online', '15 دقيقة', 100, 500, 100, 300, 200, 500, true
where not exists (
  select 1 from public.sub_services where service_name = 'كشف منزلي' and group_name = 'online'
);
