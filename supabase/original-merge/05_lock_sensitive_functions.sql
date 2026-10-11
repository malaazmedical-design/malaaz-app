-- Phase 4: close the open security-definer functions found in the original (run on the ORIGINAL in the SQL Editor).
-- 1) delete_auth_user: the admin page (admin.html -> deleteClient) calls it as the signed-in admin, so keep it callable
--    but only for admins; anon can no longer call it, and an admin account cannot be deleted through it.
-- 2) escalate_pending_bookings / notify_booking_offer_change: only pg_cron / triggers need them, not API callers.
begin;

create or replace function public.delete_auth_user(user_id uuid)
 returns void
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
begin
  if auth.uid() is null or not exists (select 1 from public.admin_users au where au.user_id = auth.uid()) then
    raise exception 'forbidden';
  end if;
  if exists (select 1 from public.admin_users au where au.user_id = delete_auth_user.user_id) then
    raise exception 'cannot delete an admin account';
  end if;
  delete from auth.users where id = delete_auth_user.user_id;
end;
$function$;

revoke execute on function public.delete_auth_user(uuid) from public, anon;
grant execute on function public.delete_auth_user(uuid) to authenticated;

revoke execute on function public.escalate_pending_bookings() from public, anon, authenticated;
revoke execute on function public.notify_booking_offer_change() from public, anon, authenticated;

commit;

-- check: expect delete_auth_user anon=false authed=true; the other two false/false
select p.proname,
       has_function_privilege('anon', p.oid, 'execute') as anon_can_run,
       has_function_privilege('authenticated', p.oid, 'execute') as authed_can_run
from pg_proc p
where p.pronamespace = 'public'::regnamespace
  and p.proname in ('delete_auth_user','escalate_pending_bookings','notify_booking_offer_change')
order by p.proname;
