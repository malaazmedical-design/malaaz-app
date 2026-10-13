-- Test project only. In-app account deletion (required by Apple App Store and Google Play).
-- delete_my_account() is called by the signed-in user from the app. It:
--   * refuses while the user still has live work (open consultations / pending or confirmed bookings) -> 'active_items'
--   * removes the personal data and the login, keeps only anonymous business records (prices, dates, payment status)
--     so the other party's history and the accounting stay intact.
-- Returns 'ok' | 'active_items' | 'admin' | 'unauthorized'.
-- Needs 31_provider_name_en.sql and 39_delete_account_storage.sql (providers.name_en) to be applied first.

create or replace function public.delete_my_account()
 returns text language plpgsql security definer set search_path to 'public'
as $$
declare
  uid uuid := auth.uid();
  cid uuid; cphone text;
  pid uuid;
begin
  if uid is null then return 'unauthorized'; end if;
  if exists (select 1 from public.admin_users where user_id = uid) then return 'admin'; end if;

  select id, phone into cid, cphone from public.clients where auth_id = uid limit 1;
  select id into pid from public.providers where user_id = uid limit 1;

  -- live work blocks deletion (cancel / finish it first)
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

  if cid is not null then
    -- stored files are removed by the app through the Storage API BEFORE this runs (see 39_delete_account_storage.sql);
    -- Supabase does not allow deleting from storage.objects in SQL.
    -- chat content and ask-a-doctor content
    delete from public.consultation_messages where consultation_id in (select id from public.consultations where client_id = cid);
    delete from public.ask_doctor_attachments where case_id in (select id from public.ask_doctor_cases where client_id = cid);
    delete from public.ask_doctor_messages where case_id in (select id from public.ask_doctor_cases where client_id = cid);
    update public.ask_doctor_cases set patient_name = null, patient_phone = null, location = null,
           message = '[تم حذف المحتوى بناءً على طلب صاحب الحساب]' where client_id = cid;
    -- the client's personal records
    delete from public.medical_files where client_id = cid;
    delete from public.medicine_reminders where client_id = cid;
    delete from public.family_members where client_id = cid;
    delete from public.client_addresses where client_id = cid;
    delete from public.care_reports where patient_user_id = uid;
    delete from public.push_tokens where owner_type = 'client' and phone = cphone;
    -- business records stay, but anonymous
    update public.bookings set patient_name = 'حساب محذوف', phone = null, address = null, notes = null, patient_email = null, lat = null, lng = null where client_id = cid;
    update public.consultations set client_name = 'حساب محذوف' where client_id = cid;
    -- the client row is kept only as an anonymous anchor for those records (foreign keys), detached from the login
    update public.clients set auth_id = null, name = 'حساب محذوف', email = null, phone = 'deleted-' || id::text, phone2 = null,
           whatsapp = null, avatar_url = null, birth_date = null, gender = null where id = cid;
  end if;

  if pid is not null then
    delete from public.push_tokens where provider_id = pid;
    delete from public.provider_channels where provider_id = pid;
    delete from public.provider_services where provider_id = pid;
    delete from public.testimonials where provider_id = pid;
    delete from public.booking_offers where provider_id = pid;
    update public.bookings set provider_phone = null where provider_id = pid;
    update public.providers set user_id = null, status = 'suspended', is_available = false, name = 'مقدم خدمة سابق', name_en = null,
           email = null, phone = null, whatsapp = null, bio = null, photo_url = null, lat = null, lng = null where id = pid;
  end if;

  -- finally the login itself (cascades to sessions, identities, aac_* and install_attribution)
  delete from auth.users where id = uid;
  return 'ok';
end; $$;
revoke all on function public.delete_my_account() from public, anon;
grant execute on function public.delete_my_account() to authenticated;
