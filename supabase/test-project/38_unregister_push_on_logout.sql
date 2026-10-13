-- Sign-out must stop notifications: the app calls this right BEFORE signing out so this phone's push token
-- is removed from the signed-in account (client, provider or admin). The next sign-in registers it again.
create or replace function public.unregister_push_token(p_token text)
 returns text language plpgsql security definer set search_path to 'public'
as $$
declare v_phone text;
begin
  if auth.uid() is null or coalesce(length(trim(p_token)), 0) < 10 then return 'forbidden'; end if;
  select phone into v_phone from public.clients where auth_id = auth.uid() limit 1;
  delete from public.push_tokens
   where expo_token = trim(p_token)
     and ((owner_type = 'client' and phone = v_phone)
       or (owner_type = 'provider' and provider_id in (select id from public.providers where user_id = auth.uid())));
  delete from public.admin_push_tokens where expo_token = trim(p_token) and user_id = auth.uid();
  return 'ok';
end; $$;
revoke all on function public.unregister_push_token(text) from public, anon;
grant execute on function public.unregister_push_token(text) to authenticated;
