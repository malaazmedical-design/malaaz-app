-- Test project only. Install-source tracking (where each user came from: facebook / tiktok / google / whatsapp ...).
-- The app reads the Google Play install referrer (utm_source=...&utm_medium=...&utm_campaign=...) on first launch (Android)
-- and sends it here once a user is signed in. One row per user; the first one wins.
create table if not exists public.install_attribution (
  user_id uuid primary key references auth.users(id) on delete cascade,
  referrer text,
  source text not null default 'unknown',
  medium text,
  campaign text,
  content text,
  platform text,
  created_at timestamptz not null default now()
);
alter table public.install_attribution enable row level security;
-- no policies: users never read or write it directly; they go through the functions below

create or replace function public.record_install_attribution(p_referrer text, p_platform text default null)
 returns text language plpgsql security definer set search_path to 'public'
as $$
declare
  uid uuid := auth.uid();
  q text := coalesce(btrim(p_referrer), '');
  src text; med text; cmp text; cnt text;
begin
  if uid is null then return 'unauthorized'; end if;
  if exists (select 1 from public.install_attribution where user_id = uid) then return 'exists'; end if;
  -- the referrer arrives as "utm_source=facebook&utm_medium=cpc&utm_campaign=oct_ads" (may be url-encoded)
  q := replace(q, '%3D', '='); q := replace(q, '%26', '&');
  src := lower(nullif(substring(q from '(?:^|&)utm_source=([^&]*)'), ''));
  med := lower(nullif(substring(q from '(?:^|&)utm_medium=([^&]*)'), ''));
  cmp := nullif(substring(q from '(?:^|&)utm_campaign=([^&]*)'), '');
  cnt := nullif(substring(q from '(?:^|&)utm_content=([^&]*)'), '');
  if src is null then src := case when q = '' then 'unknown' else 'other' end; end if;
  if src in ('ig', 'instagram.com') then src := 'instagram'; end if;
  if src in ('fb', 'facebook.com', 'apps.facebook.com', 'meta') then src := 'facebook'; end if;
  insert into public.install_attribution (user_id, referrer, source, medium, campaign, content, platform)
  values (uid, left(nullif(q, ''), 500), left(src, 60), left(med, 60), left(cmp, 100), left(cnt, 100), left(p_platform, 20))
  on conflict (user_id) do nothing;
  return 'ok';
end; $$;
revoke all on function public.record_install_attribution(text, text) from public, anon;
grant execute on function public.record_install_attribution(text, text) to authenticated;

-- Admin report: per source / medium / campaign — users, how many made a booking, how many paid a consultation
create or replace function public.admin_install_stats(p_days int default 30)
 returns table(source text, medium text, campaign text, users bigint, with_booking bigint, with_paid_consult bigint)
 language plpgsql security definer set search_path to 'public'
as $$
begin
  if not public.is_admin() then raise exception 'forbidden'; end if;
  return query
  select a.source, a.medium, a.campaign,
         count(*)::bigint,
         count(*) filter (where exists (select 1 from public.bookings b join public.clients c on c.id = b.client_id
                                         where c.auth_id = a.user_id and coalesce(b.status, '') <> 'cancelled'))::bigint,
         count(*) filter (where exists (select 1 from public.consultations k join public.clients c on c.id = k.client_id
                                         where c.auth_id = a.user_id and k.pay_status = 'paid'))::bigint
  from public.install_attribution a
  where a.created_at >= now() - make_interval(days => greatest(p_days, 1))
  group by a.source, a.medium, a.campaign
  order by count(*) desc;
end; $$;
revoke all on function public.admin_install_stats(int) from public, anon;
grant execute on function public.admin_install_stats(int) to authenticated;
