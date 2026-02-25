-- Phase 43 (read-only): Role stats fallback
-- Use this in Supabase SQL Editor when `supabase inspect db role-stats`
-- fails in CLI with scan errors on NULL role configs.

select
  r.rolname as role_name,
  (
    select count(*)
    from pg_stat_activity a
    where a.usename = r.rolname
  ) as active_connections,
  case
    when r.rolconnlimit = -1 then current_setting('max_connections')::bigint
    else r.rolconnlimit::bigint
  end as connection_limit,
  coalesce(array_to_string(r.rolconfig, ',', '*'), '') as custom_config
from pg_roles r
order by r.rolname;

