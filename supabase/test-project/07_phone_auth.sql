-- Test project: link a phone-OTP login to a `clients` row.
--
-- A user who signed in with a phone OTP has an auth.users row with a phone number but no
-- `clients` row yet. This function (called by the app right after the OTP is verified):
--   1. returns the client already linked to this login, or
--   2. claims an existing unlinked client with the same phone (e.g. created by a guest booking), or
--   3. creates a new client when a name is supplied, otherwise raises 'name_required'.
-- The phone is read from auth.users (the verified one), never from client input.

create or replace function public.claim_my_client(p_name text default null)
returns public.clients
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_phone text;
  v_local text;
  v_client public.clients;
begin
  if auth.uid() is null then
    raise exception 'not_authenticated';
  end if;

  select phone into v_phone from auth.users where id = auth.uid();
  if v_phone is null or v_phone = '' then
    raise exception 'no_phone';
  end if;

  -- auth stores E.164 without '+' (201012345678); the app stores local format (01012345678)
  v_local := case when v_phone like '20%' then '0' || substr(v_phone, 3) else v_phone end;

  select * into v_client from public.clients where auth_id = auth.uid();
  if found then
    return v_client;
  end if;

  update public.clients
     set auth_id = auth.uid(),
         name = coalesce(nullif(name, ''), nullif(trim(p_name), ''))
   where phone = v_local and auth_id is null
   returning * into v_client;
  if found then
    return v_client;
  end if;

  if p_name is null or length(trim(p_name)) = 0 then
    raise exception 'name_required';
  end if;

  insert into public.clients (phone, name, auth_id)
  values (v_local, trim(p_name), auth.uid())
  returning * into v_client;
  return v_client;
end;
$function$;

revoke all on function public.claim_my_client(text) from public, anon;
grant execute on function public.claim_my_client(text) to authenticated;
