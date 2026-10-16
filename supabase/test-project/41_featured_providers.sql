-- 41 — "المقدمين المميزين": الأدمن بيختار بنفسه مقدمين الصفحة الرئيسية (حد أقصى 10) لكل منطقة، أو لكل المناطق ('*').
--  * التطبيق بيعرض المختارين الأول بالترتيب اللي حدده الأدمن، وبيكمّل الباقي (لحد 10) بالترتيب التلقائي.
--  * القراءة مفتوحة (بيانات مش حساسة: بس أرقام مقدمين نشطين)، والكتابة للأدمن فقط من خلال admin_set_featured.
-- Additive and idempotent.
create table if not exists public.featured_providers (
  id uuid primary key default gen_random_uuid(),
  area text not null default '*',                                    -- اسم المنطقة زي ما في coverage_areas، أو '*' = كل المناطق
  provider_id uuid not null references public.providers(id) on delete cascade,
  position int not null,
  created_at timestamptz not null default now(),
  unique (area, provider_id)
);
create index if not exists featured_providers_area_idx on public.featured_providers (area, position);

alter table public.featured_providers enable row level security;
drop policy if exists featured_read on public.featured_providers;
create policy featured_read on public.featured_providers for select to anon, authenticated using (true);
revoke insert, update, delete on public.featured_providers from anon, authenticated;

-- الأدمن يحفظ قايمة منطقة كاملة بالترتيب (بتستبدل القديمة). p_ids بالترتيب؛ حد أقصى 10، المقدمين النشطين بس.
create or replace function public.admin_set_featured(p_area text, p_ids uuid[])
returns text
language plpgsql
security definer
set search_path to 'public'
as $function$
declare v_area text := coalesce(nullif(btrim(p_area), ''), '*');
begin
  if not public.is_admin() then return 'forbidden'; end if;
  if coalesce(array_length(p_ids, 1), 0) > 10 then return 'max_10'; end if;
  delete from public.featured_providers where area = v_area;
  insert into public.featured_providers (area, provider_id, position)
  select v_area, t.id, t.ord::int
    from unnest(coalesce(p_ids, '{}'::uuid[])) with ordinality as t(id, ord)
    join public.providers p on p.id = t.id and p.status = 'active'
  on conflict (area, provider_id) do update set position = excluded.position;
  return 'ok';
end;
$function$;
revoke all on function public.admin_set_featured(text, uuid[]) from public, anon;
grant execute on function public.admin_set_featured(text, uuid[]) to authenticated;
