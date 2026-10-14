-- Test project: create / link the `clients` row for any login method (email, Google, ...).
--
-- Social and email logins do not carry a phone number, but the app needs one (booking contact,
-- unique per client). After signing in, the app asks for the number and calls this function:
--   * the login already has a client            -> returns it (updates the phone if it changed and is free)
--   * the phone belongs to an unlinked client   -> links it to this login (old guest history is kept)
--   * the phone belongs to ANOTHER login        -> raises 'phone_taken:<masked email>' (no second account)
--   * otherwise                                  -> creates the client
-- Phone numbers are not verified by SMS (free plan decision), so a row owned by another login is
-- never taken over by typing its number.

create or replace function public.register_my_client(p_phone text, p_name text default null)
returns public.clients
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_uid uuid := auth.uid();
  v_phone text := regexp_replace(translate(coalesce(p_phone, ''), '٠١٢٣٤٥٦٧٨٩۰۱۲۳۴۵۶۷۸۹', '01234567890123456789'), '[^0-9]', '', 'g');
  v_email text;
  v_name text;
  v_mine public.clients;
  v_other public.clients;
  v_owner_email text;
begin
  if v_uid is null then
    raise exception 'not_authenticated';
  end if;

  -- accept 01012345678, 1012345678 and 201012345678
  if v_phone like '20%' and length(v_phone) = 12 then v_phone := '0' || substr(v_phone, 3); end if;
  if length(v_phone) = 10 and v_phone like '1%' then v_phone := '0' || v_phone; end if;
  if v_phone !~ '^01[0125][0-9]{8}$' then
    raise exception 'invalid_phone';
  end if;

  select email into v_email from auth.users where id = v_uid;
  v_name := coalesce(nullif(trim(p_name), ''), split_part(coalesce(v_email, ''), '@', 1));

  select * into v_mine from public.clients where auth_id = v_uid;

  select * into v_other from public.clients where phone = v_phone and (v_mine.id is null or id <> v_mine.id);
  if found and v_other.auth_id is not null and v_other.auth_id <> v_uid then
    select email into v_owner_email from auth.users where id = v_other.auth_id;
    raise exception 'phone_taken:%', coalesce(regexp_replace(v_owner_email, '^(.).*(@.*)$', '\1***\2'), '');
  end if;

  if v_mine.id is not null then
    -- same login: just keep the phone current
    if v_mine.phone is distinct from v_phone and not found then
      update public.clients set phone = v_phone where id = v_mine.id returning * into v_mine;
    end if;
    return v_mine;
  end if;

  if found then
    -- unlinked client (e.g. created by a guest booking): link it to this login
    update public.clients
       set auth_id = v_uid,
           name = coalesce(nullif(name, ''), v_name),
           email = coalesce(email, v_email)
     where id = v_other.id
     returning * into v_mine;
    return v_mine;
  end if;

  insert into public.clients (phone, name, email, auth_id)
  values (v_phone, v_name, v_email, v_uid)
  returning * into v_mine;
  return v_mine;
end;
$function$;

revoke all on function public.register_my_client(text, text) from public, anon;
grant execute on function public.register_my_client(text, text) to authenticated;
