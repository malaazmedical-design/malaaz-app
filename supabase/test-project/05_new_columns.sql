-- Test project only: new optional profile columns for the redesigned Edit Profile screen.
alter table public.clients add column if not exists birth_date date;
alter table public.clients add column if not exists gender text
  check (gender is null or gender in ('male', 'female'));
