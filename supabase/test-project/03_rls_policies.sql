-- Test project schema, part 3: row level security and policies (public schema).
-- Copied from production as-is. NOTE: several policies are intentionally permissive in
-- production (e.g. anyone can insert bookings/clients/reviews; broadcast_notifications is
-- readable and insertable by anyone). Review them separately before reusing in production.

alter table public.aac_custom_words enable row level security;
alter table public.aac_events enable row level security;
alter table public.aac_family_links enable row level security;
alter table public.admin_alerts enable row level security;
alter table public.admin_users enable row level security;
alter table public.ask_doctor_attachments enable row level security;
alter table public.ask_doctor_cases enable row level security;
alter table public.ask_doctor_messages enable row level security;
alter table public.blog_posts enable row level security;
alter table public.booking_offers enable row level security;
alter table public.bookings enable row level security;
alter table public.broadcast_notifications enable row level security;
alter table public.care_reports enable row level security;
alter table public.client_addresses enable row level security;
alter table public.clients enable row level security;
alter table public.coverage_areas enable row level security;
alter table public.email_send_logs enable row level security;
alter table public.family_members enable row level security;
alter table public.governorates enable row level security;
alter table public.medical_files enable row level security;
alter table public.medicine_reminders enable row level security;
alter table public.provider_services enable row level security;
alter table public.providers enable row level security;
alter table public.push_tokens enable row level security;
alter table public.reviews enable row level security;
alter table public.services enable row level security;
alter table public.site_content enable row level security;
alter table public.sub_services enable row level security;
alter table public.testimonials enable row level security;

create policy aac_custom_words_all on public.aac_custom_words as permissive for all to public
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy aac_events_insert on public.aac_events as permissive for insert to public
  with check (auth.uid() = user_id);
create policy aac_events_select on public.aac_events as permissive for select to public
  using (auth.uid() = user_id);

create policy aac_family_links_owner on public.aac_family_links as permissive for all to public
  using (auth.uid() = patient_user_id) with check (auth.uid() = patient_user_id);

create policy admin_alerts_admin_only on public.admin_alerts as permissive for select to public
  using (exists (select 1 from admin_users au where au.user_id = auth.uid()));
create policy admin_alerts_admin_update on public.admin_alerts as permissive for update to public
  using (exists (select 1 from admin_users au where au.user_id = auth.uid()));

create policy admin_users_read_own on public.admin_users as permissive for select to authenticated
  using (user_id = auth.uid());

create policy attachments_access on public.ask_doctor_attachments as permissive for all to public
  using (case_id in (
    select c.id from ask_doctor_cases c
    where c.client_id in (select clients.id from clients where clients.auth_id = auth.uid())
       or c.assigned_doctor_id in (select providers.id from providers where providers.user_id = auth.uid())
       or c.status = 'new'
  ));

create policy doctor_see_new_cases on public.ask_doctor_cases as permissive for select to public
  using (status = 'new' or assigned_doctor_id in (select providers.id from providers where providers.user_id = auth.uid()));
create policy doctor_update_case on public.ask_doctor_cases as permissive for update to public
  using (assigned_doctor_id in (select providers.id from providers where providers.user_id = auth.uid())
         or (status = 'new' and assigned_doctor_id is null));
create policy patient_insert_case on public.ask_doctor_cases as permissive for insert to public
  with check (true);
create policy patient_own_cases on public.ask_doctor_cases as permissive for all to public
  using (client_id in (select clients.id from clients where clients.auth_id = auth.uid()));

create policy messages_access on public.ask_doctor_messages as permissive for all to public
  using (case_id in (
    select c.id from ask_doctor_cases c
    where c.client_id in (select clients.id from clients where clients.auth_id = auth.uid())
       or c.assigned_doctor_id in (select providers.id from providers where providers.user_id = auth.uid())
  ));

create policy admin_all_blog_posts on public.blog_posts as permissive for all to authenticated
  using (exists (select 1 from admin_users where admin_users.user_id = auth.uid()))
  with check (exists (select 1 from admin_users where admin_users.user_id = auth.uid()));
create policy public_read_blog_posts on public.blog_posts as permissive for select to anon
  using (status = 'published');

create policy providers_select_own_offers on public.booking_offers as permissive for select to public
  using (provider_id in (select providers.id from providers where providers.user_id = auth.uid()));

create policy p_delete on public.bookings as permissive for delete to authenticated
  using (exists (select 1 from admin_users where admin_users.user_id = auth.uid()));
create policy p_insert on public.bookings as permissive for insert to anon, authenticated
  with check (true);
create policy p_select on public.bookings as permissive for select to authenticated
  using (exists (select 1 from admin_users where admin_users.user_id = auth.uid())
         or client_id in (select clients.id from clients where clients.auth_id = auth.uid())
         or provider_id in (select providers.id from providers where providers.user_id = auth.uid()));
create policy p_update on public.bookings as permissive for update to authenticated
  using (exists (select 1 from admin_users where admin_users.user_id = auth.uid())
         or provider_id in (select providers.id from providers where providers.user_id = auth.uid()));

create policy "admin insert" on public.broadcast_notifications as permissive for insert to public
  with check (true);
create policy "admin read" on public.broadcast_notifications as permissive for select to public
  using (true);

create policy care_reports_nurse_only on public.care_reports as permissive for all to public
  using (auth.uid() = nurse_user_id) with check (auth.uid() = nurse_user_id);

create policy client_own_addresses on public.client_addresses as permissive for all to authenticated
  using (client_id in (select clients.id from clients where clients.auth_id = auth.uid()));

create policy client_read_own on public.clients as permissive for select to authenticated
  using (auth.uid() = auth_id);
create policy client_update_own on public.clients as permissive for update to authenticated
  using (auth.uid() = auth_id);
create policy public_insert_clients on public.clients as permissive for insert to public
  with check (true);

create policy admin_all_areas on public.coverage_areas as permissive for all to public
  using (exists (select 1 from admin_users where admin_users.user_id = auth.uid()));
create policy public_read_areas on public.coverage_areas as permissive for select to public
  using (is_active = true);

create policy "anon can insert email logs" on public.email_send_logs as permissive for insert to anon
  with check (true);
create policy "authenticated can insert email logs" on public.email_send_logs as permissive for insert to authenticated
  with check (true);

create policy family_own on public.family_members as permissive for all to authenticated
  using (client_id in (select clients.id from clients where clients.auth_id = auth.uid()))
  with check (client_id in (select clients.id from clients where clients.auth_id = auth.uid()));

create policy "Allow anon read" on public.governorates as permissive for select to anon
  using (true);
create policy "Allow auth all" on public.governorates as permissive for all to authenticated
  using (true) with check (true);

create policy medical_files_own on public.medical_files as permissive for all to authenticated
  using (client_id in (select clients.id from clients where clients.auth_id = auth.uid()))
  with check (client_id in (select clients.id from clients where clients.auth_id = auth.uid()));

create policy medicine_reminders_own on public.medicine_reminders as permissive for all to authenticated
  using (client_id in (select clients.id from clients where clients.auth_id = auth.uid()))
  with check (client_id in (select clients.id from clients where clients.auth_id = auth.uid()));

create policy provider_own_services on public.provider_services as permissive for all to public
  using (provider_id in (select providers.id from providers where providers.user_id = auth.uid()));
create policy provider_services_public_read on public.provider_services as permissive for select to anon, authenticated
  using (is_active = true and provider_id in (select providers.id from providers where providers.status = 'active'));

create policy admin_all_providers on public.providers as permissive for all to public
  using (exists (select 1 from admin_users where admin_users.user_id = auth.uid()));
create policy provider_own_data on public.providers as permissive for all to authenticated
  using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy public_read_providers on public.providers as permissive for select to public
  using (status = 'active');

create policy push_tokens_admin on public.push_tokens as permissive for select to authenticated
  using (exists (select 1 from admin_users where admin_users.user_id = auth.uid()));
create policy push_tokens_insert on public.push_tokens as permissive for insert to anon, authenticated
  with check (true);
create policy push_tokens_select_own on public.push_tokens as permissive for select to authenticated
  using ((owner_type = 'client' and phone in (select clients.phone from clients where clients.auth_id = auth.uid()))
      or (owner_type = 'provider' and provider_id in (select providers.id from providers where providers.user_id = auth.uid())));
create policy push_tokens_update_own on public.push_tokens as permissive for update to authenticated
  using ((owner_type = 'client' and phone in (select clients.phone from clients where clients.auth_id = auth.uid()))
      or (owner_type = 'provider' and provider_id in (select providers.id from providers where providers.user_id = auth.uid())))
  with check ((owner_type = 'client' and phone in (select clients.phone from clients where clients.auth_id = auth.uid()))
      or (owner_type = 'provider' and provider_id in (select providers.id from providers where providers.user_id = auth.uid())));

create policy admin_all_reviews on public.reviews as permissive for all to public
  using (exists (select 1 from admin_users where admin_users.user_id = auth.uid()));
create policy public_insert_reviews on public.reviews as permissive for insert to public
  with check (true);
create policy public_read_reviews on public.reviews as permissive for select to public
  using (is_approved = true);

create policy admin_all_services on public.services as permissive for all to public
  using (exists (select 1 from admin_users where admin_users.user_id = auth.uid()));
create policy public_read_services on public.services as permissive for select to public
  using (is_active = true);

create policy admin_all_content on public.site_content as permissive for all to public
  using (exists (select 1 from admin_users where admin_users.user_id = auth.uid()));
create policy public_read_content on public.site_content as permissive for select to public
  using (true);

create policy admin_all_sub_services on public.sub_services as permissive for all to authenticated
  using (exists (select 1 from admin_users where admin_users.user_id = auth.uid()))
  with check (exists (select 1 from admin_users where admin_users.user_id = auth.uid()));
create policy public_read_sub_services on public.sub_services as permissive for select to public
  using (is_active = true);

create policy admin_all_testimonials on public.testimonials as permissive for all to public
  using (exists (select 1 from admin_users where admin_users.user_id = auth.uid()));
create policy public_insert_testimonials on public.testimonials as permissive for insert to public
  with check (true);
create policy public_read_testimonials on public.testimonials as permissive for select to public
  using (is_active = true);
