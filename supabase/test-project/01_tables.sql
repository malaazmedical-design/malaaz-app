-- Test project schema, part 1: tables, constraints, indexes.
-- Derived from the production schema export, with no data and no secrets.
-- Run order: 01 -> 02 -> 03 -> 04 -> 05.
-- Requires: a fresh Supabase project (auth + storage schemas already exist).

create table public.aac_custom_words (
  id uuid not null default gen_random_uuid(),
  user_id uuid,
  label text not null,
  emoji text not null,
  phrase text not null,
  category_id text not null default 'basic',
  created_at timestamptz default now(),
  constraint aac_custom_words_pkey primary key (id)
);

create table public.aac_events (
  id uuid not null default gen_random_uuid(),
  user_id uuid,
  word_id text,
  phrase text not null,
  category text,
  is_emergency boolean default false,
  created_at timestamptz default now(),
  constraint aac_events_pkey primary key (id)
);

create table public.aac_family_links (
  id uuid not null default gen_random_uuid(),
  patient_user_id uuid,
  family_name text not null,
  relation text,
  push_token text,
  created_at timestamptz default now(),
  notify_emergency_only boolean not null default false,
  phone text,
  is_primary boolean default false,
  constraint aac_family_links_pkey primary key (id)
);

create table public.admin_users (
  id uuid not null default gen_random_uuid(),
  user_id uuid,
  role text default 'admin',
  created_at timestamptz default now(),
  constraint admin_users_pkey primary key (id)
);

create table public.blog_posts (
  id uuid not null default gen_random_uuid(),
  title text not null,
  category text default 'نصائح طبية',
  summary text,
  content text,
  emoji text default '📝',
  read_time integer default 5,
  status text default 'published',
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  slug text,
  constraint blog_posts_pkey primary key (id),
  constraint blog_posts_status_check check (status = any (array['published','draft']))
);

create table public.broadcast_notifications (
  id uuid not null default gen_random_uuid(),
  title text not null,
  body text not null,
  target text not null default 'all',
  sent_count integer default 0,
  failed_count integer default 0,
  created_at timestamptz default now(),
  constraint broadcast_notifications_pkey primary key (id)
);

create table public.care_reports (
  id uuid not null default gen_random_uuid(),
  patient_user_id uuid,
  nurse_user_id uuid,
  note text not null,
  severity text default 'low',
  created_at timestamptz default now(),
  constraint care_reports_pkey primary key (id),
  constraint care_reports_severity_check check (severity = any (array['low','medium','high']))
);

create table public.clients (
  id uuid not null default gen_random_uuid(),
  phone text not null,
  name text,
  email text,
  created_at timestamptz default now(),
  phone2 text,
  whatsapp text,
  auth_id uuid,
  avatar_url text,
  constraint clients_pkey primary key (id),
  constraint clients_phone_key unique (phone)
);

create table public.client_addresses (
  id uuid not null default gen_random_uuid(),
  client_id uuid,
  area text,
  address text,
  is_default boolean default false,
  created_at timestamptz default now(),
  lat double precision,
  lng double precision,
  constraint client_addresses_pkey primary key (id)
);

create table public.family_members (
  id uuid not null default gen_random_uuid(),
  client_id uuid not null,
  name text not null,
  relation text,
  birth_year integer,
  notes text,
  created_at timestamptz not null default now(),
  phone text,
  gender text,
  blood_type text,
  chronic_conditions text,
  allergies text,
  constraint family_members_pkey primary key (id)
);

create table public.coverage_areas (
  id uuid not null default gen_random_uuid(),
  name text not null,
  city text default 'القاهرة',
  is_active boolean default true,
  created_at timestamptz default now(),
  constraint coverage_areas_pkey primary key (id)
);

create table public.governorates (
  id uuid not null default gen_random_uuid(),
  name text not null,
  is_active boolean not null default true,
  created_at timestamptz default now(),
  constraint governorates_pkey primary key (id),
  constraint governorates_name_key unique (name)
);

create table public.services (
  id uuid not null default gen_random_uuid(),
  name text not null,
  icon text,
  description text,
  price_min numeric,
  price_max numeric,
  is_active boolean default true,
  created_at timestamptz default now(),
  constraint services_pkey primary key (id)
);

create table public.sub_services (
  id uuid not null default gen_random_uuid(),
  service_name text not null,
  name text not null,
  group_name text,
  duration text,
  price_min numeric,
  price_max numeric,
  price_min_specialist numeric,
  price_max_specialist numeric,
  price_min_consultant numeric,
  price_max_consultant numeric,
  is_active boolean default true,
  created_at timestamptz default now(),
  constraint sub_services_pkey primary key (id)
);

create table public.providers (
  id uuid not null default gen_random_uuid(),
  user_id uuid,
  name text not null,
  email text,
  phone text,
  service_type text,
  specialty text,
  grade text,
  area text,
  bio text,
  experience numeric,
  rating numeric default 5,
  price numeric,
  status text default 'pending',
  is_available boolean default false,
  created_at timestamptz default now(),
  commission_rate numeric default 15,
  areas text,
  photo_url text,
  lat double precision,
  lng double precision,
  location_updated_at timestamptz,
  constraint providers_pkey primary key (id)
);

create table public.provider_services (
  id uuid not null default gen_random_uuid(),
  provider_id uuid,
  sub_service_id uuid,
  custom_price numeric,
  is_active boolean default true,
  constraint provider_services_pkey primary key (id)
);

create table public.bookings (
  id uuid not null default gen_random_uuid(),
  patient_name text not null,
  phone text,
  area text,
  address text,
  appointment_time text,
  service_type text,
  sub_option text,
  payment_method text,
  payment_status text default 'pending',
  status text default 'pending',
  notes text,
  provider_phone text,
  created_at timestamptz default now(),
  provider_id uuid,
  price numeric,
  patient_email text,
  client_id uuid,
  on_way_at timestamptz,
  lat double precision,
  lng double precision,
  escalation_level integer not null default 0,
  escalated_at timestamptz,
  constraint bookings_pkey primary key (id)
);

create table public.booking_offers (
  id uuid not null default gen_random_uuid(),
  booking_id uuid not null,
  provider_id uuid not null,
  distance_km double precision,
  status text not null default 'pending',
  created_at timestamptz not null default now(),
  responded_at timestamptz,
  constraint booking_offers_pkey primary key (id),
  constraint booking_offers_status_check check (status = any (array['pending','accepted','expired','declined']))
);

create table public.admin_alerts (
  id uuid not null default gen_random_uuid(),
  booking_id uuid,
  level integer not null,
  message text not null,
  whatsapp_link text,
  created_at timestamptz not null default now(),
  acknowledged boolean not null default false,
  constraint admin_alerts_pkey primary key (id)
);

create table public.ask_doctor_cases (
  id uuid not null default gen_random_uuid(),
  case_number text,
  client_id uuid,
  patient_name text,
  patient_phone text,
  message text not null,
  intent text not null default 'unknown',
  suggested_specialty text,
  location text,
  urgency_flag boolean not null default false,
  status text not null default 'new',
  assigned_doctor_id uuid,
  communication_type text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint ask_doctor_cases_pkey primary key (id),
  constraint ask_doctor_cases_case_number_key unique (case_number)
);

create table public.ask_doctor_messages (
  id uuid not null default gen_random_uuid(),
  case_id uuid not null,
  sender_id text not null,
  sender_type text not null default 'patient',
  content text not null,
  created_at timestamptz not null default now(),
  constraint ask_doctor_messages_pkey primary key (id)
);

create table public.ask_doctor_attachments (
  id uuid not null default gen_random_uuid(),
  case_id uuid not null,
  storage_path text not null,
  file_type text not null default 'image',
  created_at timestamptz not null default now(),
  constraint ask_doctor_attachments_pkey primary key (id)
);

create table public.medical_files (
  id uuid not null default gen_random_uuid(),
  client_id uuid not null,
  family_member_id uuid,
  title text not null,
  file_type text not null default 'report',
  storage_path text not null,
  created_at timestamptz not null default now(),
  constraint medical_files_pkey primary key (id),
  constraint medical_files_file_type_check check (file_type = any (array['report','lab','xray','prescription','other']))
);

create table public.medicine_reminders (
  id uuid not null default gen_random_uuid(),
  client_id uuid not null,
  family_member_id uuid,
  medicine_name text not null,
  dose text,
  times text[] not null default '{}',
  notify_caregiver boolean not null default true,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  constraint medicine_reminders_pkey primary key (id)
);

create table public.push_tokens (
  id uuid not null default gen_random_uuid(),
  owner_type text not null,
  provider_id uuid,
  phone text,
  expo_token text not null,
  platform text,
  updated_at timestamptz not null default now(),
  constraint push_tokens_pkey primary key (id),
  constraint push_tokens_expo_token_key unique (expo_token),
  constraint push_tokens_owner_type_check check (owner_type = any (array['client','provider']))
);

create table public.reviews (
  id uuid not null default gen_random_uuid(),
  client_name text,
  service_type text,
  rating integer default 5,
  text text,
  is_approved boolean default false,
  created_at timestamptz default now(),
  provider_id uuid,
  constraint reviews_pkey primary key (id)
);

create table public.testimonials (
  id uuid not null default gen_random_uuid(),
  client_name text,
  service_type text,
  rating integer default 5,
  text text,
  is_active boolean default true,
  created_at timestamptz default now(),
  provider_id uuid,
  constraint testimonials_pkey primary key (id)
);

create table public.site_content (
  id uuid not null default gen_random_uuid(),
  section text not null,
  key text not null,
  value text,
  updated_at timestamptz default now(),
  constraint site_content_pkey primary key (id),
  constraint site_content_section_key_key unique (section, key)
);

create table public.email_send_logs (
  id uuid not null default gen_random_uuid(),
  created_at timestamptz not null default now(),
  to_email text not null,
  subject text,
  ok boolean not null,
  status_code integer,
  response_body text,
  constraint email_send_logs_pkey primary key (id)
);

-- ─── Foreign keys ───────────────────────────────────────────────────────────
alter table public.aac_custom_words add constraint aac_custom_words_user_id_fkey foreign key (user_id) references auth.users(id) on delete cascade;
alter table public.aac_events add constraint aac_events_user_id_fkey foreign key (user_id) references auth.users(id) on delete cascade;
alter table public.aac_family_links add constraint aac_family_links_patient_user_id_fkey foreign key (patient_user_id) references auth.users(id) on delete cascade;
alter table public.admin_users add constraint admin_users_user_id_fkey foreign key (user_id) references auth.users(id) on delete cascade;
alter table public.care_reports add constraint care_reports_nurse_user_id_fkey foreign key (nurse_user_id) references auth.users(id) on delete cascade;
alter table public.care_reports add constraint care_reports_patient_user_id_fkey foreign key (patient_user_id) references auth.users(id);
alter table public.clients add constraint clients_auth_id_fkey foreign key (auth_id) references auth.users(id) on delete cascade;
alter table public.client_addresses add constraint client_addresses_client_id_fkey foreign key (client_id) references public.clients(id) on delete cascade;
alter table public.family_members add constraint family_members_client_id_fkey foreign key (client_id) references public.clients(id) on delete cascade;
alter table public.providers add constraint providers_user_id_fkey foreign key (user_id) references auth.users(id) on delete cascade;
alter table public.provider_services add constraint provider_services_provider_id_fkey foreign key (provider_id) references public.providers(id) on delete cascade;
alter table public.provider_services add constraint provider_services_sub_service_id_fkey foreign key (sub_service_id) references public.sub_services(id);
alter table public.bookings add constraint bookings_client_id_fkey foreign key (client_id) references public.clients(id) on delete cascade;
alter table public.bookings add constraint bookings_provider_id_fkey foreign key (provider_id) references public.providers(id) on delete cascade;
alter table public.booking_offers add constraint booking_offers_booking_id_fkey foreign key (booking_id) references public.bookings(id) on delete cascade;
alter table public.booking_offers add constraint booking_offers_provider_id_fkey foreign key (provider_id) references public.providers(id) on delete cascade;
alter table public.admin_alerts add constraint admin_alerts_booking_id_fkey foreign key (booking_id) references public.bookings(id) on delete cascade;
alter table public.ask_doctor_cases add constraint ask_doctor_cases_assigned_doctor_id_fkey foreign key (assigned_doctor_id) references public.providers(id);
alter table public.ask_doctor_cases add constraint ask_doctor_cases_client_id_fkey foreign key (client_id) references public.clients(id);
alter table public.ask_doctor_messages add constraint ask_doctor_messages_case_id_fkey foreign key (case_id) references public.ask_doctor_cases(id) on delete cascade;
alter table public.ask_doctor_attachments add constraint ask_doctor_attachments_case_id_fkey foreign key (case_id) references public.ask_doctor_cases(id) on delete cascade;
alter table public.medical_files add constraint medical_files_client_id_fkey foreign key (client_id) references public.clients(id) on delete cascade;
alter table public.medical_files add constraint medical_files_family_member_id_fkey foreign key (family_member_id) references public.family_members(id) on delete cascade;
alter table public.medicine_reminders add constraint medicine_reminders_client_id_fkey foreign key (client_id) references public.clients(id) on delete cascade;
alter table public.medicine_reminders add constraint medicine_reminders_family_member_id_fkey foreign key (family_member_id) references public.family_members(id) on delete cascade;
alter table public.push_tokens add constraint push_tokens_provider_id_fkey foreign key (provider_id) references public.providers(id) on delete cascade;
alter table public.reviews add constraint reviews_provider_id_fkey foreign key (provider_id) references public.providers(id) on delete cascade;
alter table public.testimonials add constraint testimonials_provider_id_fkey foreign key (provider_id) references public.providers(id) on delete cascade;

-- ─── Indexes ────────────────────────────────────────────────────────────────
create unique index blog_posts_slug_idx on public.blog_posts using btree (slug);
create index idx_booking_offers_booking on public.booking_offers using btree (booking_id);
create index idx_booking_offers_provider_status on public.booking_offers using btree (provider_id, status);
create index idx_providers_lat_lng on public.providers using btree (lat, lng);
create index idx_push_tokens_phone on public.push_tokens using btree (phone) where (owner_type = 'client');
create index idx_push_tokens_provider on public.push_tokens using btree (provider_id) where (owner_type = 'provider');
