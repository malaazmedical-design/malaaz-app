-- Test project only: columns/tables for the redesigned provider app (cancel reason + private visit notes).
alter table public.bookings add column if not exists cancel_reason text;
alter table public.bookings add column if not exists cancelled_by text
  check (cancelled_by is null or cancelled_by in ('client', 'provider'));

-- Post-visit notes written by the provider. Admin-only readable: providers can insert but never read them back.
create table if not exists public.booking_visit_notes (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid not null references public.bookings(id) on delete cascade,
  provider_id uuid not null references public.providers(id) on delete cascade,
  note text not null,
  created_at timestamptz not null default now()
);
alter table public.booking_visit_notes enable row level security;

drop policy if exists provider_insert_visit_note on public.booking_visit_notes;
create policy provider_insert_visit_note on public.booking_visit_notes as permissive for insert to authenticated
  with check (provider_id in (select providers.id from providers where providers.user_id = auth.uid()));

drop policy if exists admin_read_visit_notes on public.booking_visit_notes;
create policy admin_read_visit_notes on public.booking_visit_notes as permissive for select to authenticated
  using (exists (select 1 from admin_users where admin_users.user_id = auth.uid()));

-- Reviews: link a review to its booking so the provider can see approved ones on that booking.
alter table public.reviews add column if not exists booking_id uuid;
