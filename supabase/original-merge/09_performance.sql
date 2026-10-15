-- 09_performance.sql — تحسينات أداء آمنة للتطبيق الأصلي (من تقرير Supabase Performance Advisor)
-- 1) فهارس للمفاتيح الأجنبية اللي مالهاش فهرس (29 حالة) — مفيش تغيير في البيانات ولا في سلوك التطبيق.
-- 2) سياسات RLS بتستدعي auth.uid()/auth.role() لكل صف (38 سياسة): بنلفّها في (select ...) فتتحسب مرة واحدة.
--    المعنى ثابت 100% (نفس الشرط بالظبط)، بس أسرع على الجداول الكبيرة.
-- آمن ويتشغّل أكتر من مرة. بيطبع في الآخر عدد اللي اتغيّر.
-- مش بنلمس "multiple permissive policies" (57): دمج السياسات ممكن يغيّر الصلاحيات، فبنسيبه.
-- الرجوع: drop index لأي فهرس اسمه idx_fk_... ؛ السياسات بترجع بنفس المعنى فمفيش حاجة تتراجع.

-- ===== 1) فهارس المفاتيح الأجنبية =====
do $$
declare
  r record;
  v_name text;
  n int := 0;
begin
  for r in
    select c.oid, c.conname, c.conrelid, cl.relname as tbl, c.conkey,
           (select string_agg(quote_ident(a.attname), ', ' order by k.ord)
              from unnest(c.conkey) with ordinality k(attnum, ord)
              join pg_attribute a on a.attrelid = c.conrelid and a.attnum = k.attnum) as cols
      from pg_constraint c
      join pg_class cl on cl.oid = c.conrelid
      join pg_namespace ns on ns.oid = cl.relnamespace
     where c.contype = 'f' and ns.nspname = 'public'
       and not exists (
         select 1 from pg_index i
          where i.indrelid = c.conrelid
            and i.indisvalid
            and (i.indkey::int2[])[0:array_length(c.conkey,1)-1] = c.conkey)
  loop
    v_name := left('idx_fk_' || r.tbl || '_' || substr(md5(r.conname), 1, 8), 63);
    execute format('create index if not exists %I on public.%I (%s)', v_name, r.tbl, r.cols);
    n := n + 1;
  end loop;
  raise notice 'فهارس اتضافت: %', n;
end $$;

-- ===== 2) سياسات RLS: (select auth.xxx()) =====
do $$
declare
  p record;
  v_q text;
  v_w text;
  n int := 0;
  pat_wrapped constant text := '\(\s*select\s+auth\.(uid|role|jwt)\(\)(\s+as\s+\w+)?\s*\)';
  pat_bare    constant text := 'auth\.(uid|role|jwt)\(\)';
  function_marker constant text := '@@AUTH_\1@@';
begin
  for p in
    select schemaname, tablename, policyname, qual, with_check
      from pg_policies
     where schemaname = 'public'
  loop
    v_q := p.qual;
    v_w := p.with_check;
    if v_q is not null then
      v_q := regexp_replace(v_q, pat_wrapped, function_marker, 'gi');
      v_q := regexp_replace(v_q, pat_bare, function_marker, 'gi');
      v_q := regexp_replace(v_q, '@@AUTH_(uid|role|jwt)@@', '(select auth.\1())', 'g');
    end if;
    if v_w is not null then
      v_w := regexp_replace(v_w, pat_wrapped, function_marker, 'gi');
      v_w := regexp_replace(v_w, pat_bare, function_marker, 'gi');
      v_w := regexp_replace(v_w, '@@AUTH_(uid|role|jwt)@@', '(select auth.\1())', 'g');
    end if;
    -- نعدّل بس لو لسه فيه استدعاء auth.xxx() مش ملفوف في select
    if regexp_replace(coalesce(p.qual,'') || ' ' || coalesce(p.with_check,''), pat_wrapped, '', 'gi') ~* pat_bare then
      execute format('alter policy %I on %I.%I%s%s',
        p.policyname, p.schemaname, p.tablename,
        case when v_q is not null then ' using (' || v_q || ')' else '' end,
        case when v_w is not null then ' with check (' || v_w || ')' else '' end);
      n := n + 1;
    end if;
  end loop;
  raise notice 'سياسات اتعدّلت: %', n;
end $$;

-- فحص: لازم يرجّع صفر صفوف في الاتنين
select 'fk_without_index' as check, c.conname
  from pg_constraint c join pg_namespace ns on ns.oid = c.connamespace
 where c.contype='f' and ns.nspname='public'
   and not exists (select 1 from pg_index i where i.indrelid=c.conrelid and i.indisvalid
                   and (i.indkey::int2[])[0:array_length(c.conkey,1)-1] = c.conkey)
union all
select 'policy_bare_auth', policyname from pg_policies
 where schemaname='public'
   and (coalesce(qual,'') ~* 'auth\.(uid|role|jwt)\(\)' or coalesce(with_check,'') ~* 'auth\.(uid|role|jwt)\(\)')
   and regexp_replace(coalesce(qual,'')||coalesce(with_check,''), '\(\s*select\s+auth\.(uid|role|jwt)\(\)(\s+as\s+\w+)?\s*\)', '', 'gi') ~* 'auth\.(uid|role|jwt)\(\)';
