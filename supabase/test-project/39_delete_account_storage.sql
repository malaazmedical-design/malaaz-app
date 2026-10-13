-- Account deletion, step 2: stored files.
-- Supabase refuses "delete from storage.objects" inside SQL ("Use the Storage API instead"), so the app removes the files
-- through the Storage API (as the signed-in user) before it calls delete_my_account().
--   * delete_account_precheck()  -> 'ok' | 'active_items' | 'admin' | 'unauthorized'  (nothing is deleted before we know it can proceed)
--   * my_storage_files()         -> the files that belong to the caller's client account (bucket + path)
--   * delete policies so the owner can remove those files with the Storage API

create or replace function public.delete_account_precheck()
 returns text language plpgsql stable security definer set search_path to 'public'
as $$
declare uid uuid := auth.uid(); cid uuid; pid uuid;
begin
  if uid is null then return 'unauthorized'; end if;
  if exists (select 1 from public.admin_users where user_id = uid) then return 'admin'; end if;
  select id into cid from public.clients where auth_id = uid limit 1;
  select id into pid from public.providers where user_id = uid limit 1;
  if cid is not null and (
       exists (select 1 from public.consultations where client_id = cid and state in ('wait', 'live') and coalesce(pay_status, '') in ('paid', 'pending'))
    or exists (select 1 from public.bookings where client_id = cid and status in ('pending', 'confirmed'))) then
    return 'active_items';
  end if;
  if pid is not null and (
       exists (select 1 from public.consultations where provider_id = pid and state in ('wait', 'live') and coalesce(pay_status, '') in ('paid', 'pending'))
    or exists (select 1 from public.bookings where provider_id = pid and status in ('pending', 'confirmed'))) then
    return 'active_items';
  end if;
  return 'ok';
end; $$;
revoke all on function public.delete_account_precheck() from public, anon;
grant execute on function public.delete_account_precheck() to authenticated;

create or replace function public.my_storage_files()
 returns table (bucket text, path text)
 language sql stable security definer set search_path to 'public'
as $$
  with me as (select id from public.clients where auth_id = auth.uid() limit 1)
  select 'consultation-files'::text, m.file_path
    from public.consultation_messages m join public.consultations c on c.id = m.consultation_id
   where c.client_id = (select id from me) and m.file_path is not null
  union all
  select 'ask-doctor-attachments'::text, a.storage_path
    from public.ask_doctor_attachments a join public.ask_doctor_cases k on k.id = a.case_id
   where k.client_id = (select id from me) and a.storage_path is not null
  union all
  select 'medical-files'::text, f.storage_path
    from public.medical_files f
   where f.client_id = (select id from me);
$$;
revoke all on function public.my_storage_files() from public, anon;
grant execute on function public.my_storage_files() to authenticated;

-- the owner may remove these files (medical-files already has its own read/write policy)
drop policy if exists consult_files_delete on storage.objects;
create policy consult_files_delete on storage.objects for delete to authenticated
  using (bucket_id = 'consultation-files' and public.consult_role(((storage.foldername(name))[1])::uuid) = 'c');
drop policy if exists ask_att_delete on storage.objects;
create policy ask_att_delete on storage.objects for delete to authenticated
  using (bucket_id = 'ask-doctor-attachments' and exists (
    select 1 from public.ask_doctor_cases k join public.clients cl on cl.id = k.client_id
     where k.id = ((storage.foldername(name))[1])::uuid and cl.auth_id = auth.uid()));
