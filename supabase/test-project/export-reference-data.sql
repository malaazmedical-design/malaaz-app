select string_agg(stmt, E'\n\n' order by ord) as reference_data_sql
from (
  select 1 as ord, 'insert into public.governorates select * from json_populate_recordset(null::public.governorates, '
         || quote_literal(coalesce(json_agg(t)::text, '[]')) || ') on conflict do nothing;' as stmt
  from public.governorates t
  union all
  select 2, 'insert into public.coverage_areas select * from json_populate_recordset(null::public.coverage_areas, '
         || quote_literal(coalesce(json_agg(t)::text, '[]')) || ') on conflict do nothing;'
  from public.coverage_areas t
  union all
  select 3, 'insert into public.sub_services select * from json_populate_recordset(null::public.sub_services, '
         || quote_literal(coalesce(json_agg(t)::text, '[]')) || ') on conflict do nothing;'
  from public.sub_services t
  union all
  select 4, 'insert into public.services select * from json_populate_recordset(null::public.services, '
         || quote_literal(coalesce(json_agg(t)::text, '[]')) || ') on conflict do nothing;'
  from public.services t
) s;
