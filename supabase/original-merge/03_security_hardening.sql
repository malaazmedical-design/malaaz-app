-- ReVoice -> ORIGINAL project, step 3 of 3: SECURITY HARDENING (Phase 4). Run after 01 (and normally after 02).
-- Only changes that are safe once 01 is applied. Everything riskier is listed as a commented proposal at the bottom.
begin;

-- 1) governorates: "Allow auth all" let ANY signed-in user edit them. 01 added admin-only write (admin_all_governorates)
--    and read for signed-in users, so the open policy can go. (anon read stays: "Allow anon read".)
drop policy if exists "Allow auth all" on public.governorates;

commit;

-- ---------------------------------------------------------------------------------------------------------
-- DIAGNOSTIC (read-only, safe to run any time): who may call delete_auth_user(uuid)? It deletes ANY auth user.
-- If anon or authenticated has EXECUTE it is a serious hole, unless the website admin page calls it as the admin.
--   select r.rolname, has_function_privilege(r.rolname, 'public.delete_auth_user(uuid)', 'execute') as can_execute
--   from pg_roles r where r.rolname in ('anon','authenticated','service_role');
-- Proposed fix (after checking who calls it - grep the admin website and the Edge Functions):
--   revoke execute on function public.delete_auth_user(uuid) from public, anon, authenticated;
--   -- or make it admin-only: add at the top of the body  IF NOT EXISTS (SELECT 1 FROM admin_users WHERE user_id = auth.uid()) THEN RAISE EXCEPTION 'forbidden'; END IF;
--
-- WEBHOOK SECRET ROTATION (notify_booking_change / notify_booking_offer_change <-> Edge Function notify-booking):
--   1. Generate a new random value:  openssl rand -hex 24   (keep it out of chat and git)
--   2. Supabase Dashboard -> Edge Functions -> Secrets: set the webhook secret used by notify-booking to the new value.
--   3. In the SQL Editor re-create BOTH functions with the new value in the header (the header NAME must be x-webhook-secret).
--      Better: store it in Vault (select vault.create_secret('<value>','webhook_secret')) and read it with
--      (select decrypted_secret from vault.decrypted_secrets where name='webhook_secret') so it is never in function text.
--   4. Send a test booking and check the Edge Function log.
--
-- OTHER OPEN POLICIES FOUND IN THE EXPORT (decide per item; each needs the callers checked first):
--   * public_insert_clients / patient_insert_case / public_insert_reviews / public_insert_testimonials: anyone can insert (spam risk).
--   * "admin insert" / "admin read" on broadcast_notifications: public read+insert although named admin.
--   * email_send_logs: anon + authenticated insert (only an Edge Function should write it).
--   * push_tokens_insert: anyone can register a token for any phone.
--   * storage provider-photos: any signed-in user can write/overwrite any provider photo (restrict by folder = providers.id).
--   * storage mizo-tts: anonymous upload (temporary) - remove when voice features no longer need it.
--   * bookings p_insert with check (true) for anon: needed for guest booking; keep but rate-limit in the app.
