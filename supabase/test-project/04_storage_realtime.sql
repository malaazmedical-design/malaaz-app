-- Test project schema, part 4: storage buckets/policies and realtime.
-- Buckets are created empty (no files are copied from production).

insert into storage.buckets (id, name, public) values ('avatars', 'avatars', true) on conflict (id) do nothing;
insert into storage.buckets (id, name, public) values ('medical-files', 'medical-files', false) on conflict (id) do nothing;
insert into storage.buckets (id, name, public) values ('mizo-tts', 'mizo-tts', true) on conflict (id) do nothing;
insert into storage.buckets (id, name, public) values ('provider-photos', 'provider-photos', true) on conflict (id) do nothing;

create policy avatars_auth_insert on storage.objects as permissive for insert to authenticated
  with check (bucket_id = 'avatars' and auth.uid() is not null and (
    (storage.foldername(name))[1] in (select (clients.id)::text from clients where clients.auth_id = auth.uid())
    or (auth.uid())::text = (storage.foldername(name))[1]));

create policy avatars_auth_update on storage.objects as permissive for update to authenticated
  using (bucket_id = 'avatars' and (
    (storage.foldername(name))[1] in (select (clients.id)::text from clients where clients.auth_id = auth.uid())
    or (auth.uid())::text = (storage.foldername(name))[1]));

create policy avatars_public_read on storage.objects as permissive for select to public
  using (bucket_id = 'avatars');

create policy medical_files_storage_rw on storage.objects as permissive for all to authenticated
  using (bucket_id = 'medical-files' and (storage.foldername(name))[1] = (auth.uid())::text)
  with check (bucket_id = 'medical-files' and (storage.foldername(name))[1] = (auth.uid())::text);

create policy "mizo-tts anon upload temp" on storage.objects as permissive for insert to public
  with check (bucket_id = 'mizo-tts');
create policy "mizo-tts public read" on storage.objects as permissive for select to public
  using (bucket_id = 'mizo-tts');

create policy providers_update_photos on storage.objects as permissive for update to authenticated
  using (bucket_id = 'provider-photos');
create policy providers_upload_photos on storage.objects as permissive for all to authenticated
  using (bucket_id = 'provider-photos') with check (bucket_id = 'provider-photos');

-- Realtime
alter publication supabase_realtime add table public.admin_alerts;
alter publication supabase_realtime add table public.booking_offers;
alter publication supabase_realtime add table public.bookings;
alter publication supabase_realtime add table public.provider_services;
alter publication supabase_realtime add table public.providers;
