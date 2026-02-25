-- Phase 43 (read-only): Architecture consistency checks
-- Replace placeholders where needed and run in Supabase SQL editor.

-- 0) Role stats (CLI fallback for inspect bug on NULL configs)
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

-- 1) Core table inventory
select table_name
from information_schema.tables
where table_schema = 'public'
  and table_name in (
    'profiles', 'app_permissions', 'platform_accounts', 'account_memberships',
    'account_invitations', 'admin_access_audit',
    'busflow_routes', 'busflow_stops', 'busflow_customers',
    'busflow_customer_contacts', 'busflow_workers', 'busflow_bus_types', 'busflow_app_settings'
  )
order by table_name;

-- 2) Role-bearing columns and constraints
select
  c.table_name,
  c.column_name,
  c.data_type,
  c.is_nullable,
  pgd.description as column_comment
from information_schema.columns c
left join pg_catalog.pg_statio_all_tables st
  on st.schemaname = c.table_schema and st.relname = c.table_name
left join pg_catalog.pg_description pgd
  on pgd.objoid = st.relid and pgd.objsubid = c.ordinal_position
where c.table_schema = 'public'
  and c.column_name in ('global_role', 'role', 'status')
  and c.table_name in ('profiles', 'account_memberships', 'account_invitations', 'app_permissions', 'busflow_workers')
order by c.table_name, c.column_name;

-- 3) RLS status
select schemaname, tablename, rowsecurity, forcerowsecurity
from pg_tables
where schemaname = 'public'
  and tablename in (
    'profiles', 'app_permissions', 'platform_accounts', 'account_memberships',
    'account_invitations', 'admin_access_audit',
    'busflow_routes', 'busflow_stops', 'busflow_customers',
    'busflow_customer_contacts', 'busflow_workers', 'busflow_bus_types', 'busflow_app_settings'
  )
order by tablename;

-- 4) app_permissions legacy usage
select
  count(*) as rows_total,
  count(*) filter (where app_id = 'busflow') as rows_busflow
from public.app_permissions;

-- 5) Invitation status hygiene
select status, count(*) as cnt
from public.account_invitations
group by status
order by status;

select count(*) as expired_but_pending
from public.account_invitations
where status = 'PENDING'
  and expires_at <= timezone('utc'::text, now());

-- 6) Single-active-membership policy health
select user_id, count(*) as active_cnt
from public.account_memberships
where status = 'ACTIVE'
group by user_id
having count(*) > 1;

-- 7) Audit retention FK behavior check
select
  con.conname,
  rel.relname as table_name,
  att.attname as column_name,
  con.confdeltype
from pg_constraint con
join pg_class rel on rel.oid = con.conrelid
join pg_namespace n on n.oid = rel.relnamespace
join unnest(con.conkey) as ck(attnum) on true
join pg_attribute att on att.attrelid = rel.oid and att.attnum = ck.attnum
where n.nspname = 'public'
  and rel.relname = 'admin_access_audit'
  and con.contype = 'f'
  and att.attname in ('admin_user_id', 'target_account_id')
order by att.attname;
