-- Phase 27b: Tenant isolation audit (read-only warnings)
--
-- This migration intentionally does NOT change business data.
-- It emits warnings for potential isolation risks and drift.

do $$
declare
  v_table text;
  v_count integer;
  v_expr text;
  v_policy record;
  v_missing_rls text[] := '{}';
  v_missing_force_rls text[] := '{}';
begin
  -- 1) RLS + FORCE RLS verification.
  foreach v_table in array array[
    'profiles',
    'app_permissions',
    'platform_accounts',
    'account_memberships',
    'admin_access_audit',
    'busflow_routes',
    'busflow_stops',
    'busflow_customers',
    'busflow_customer_contacts',
    'busflow_workers',
    'busflow_bus_types',
    'busflow_app_settings'
  ] loop
    if not exists (
      select 1
      from pg_class c
      join pg_namespace n on n.oid = c.relnamespace
      where n.nspname = 'public'
        and c.relname = v_table
        and c.relrowsecurity = true
    ) then
      v_missing_rls := array_append(v_missing_rls, v_table);
    end if;

    if not exists (
      select 1
      from pg_class c
      join pg_namespace n on n.oid = c.relnamespace
      where n.nspname = 'public'
        and c.relname = v_table
        and c.relforcerowsecurity = true
    ) then
      v_missing_force_rls := array_append(v_missing_force_rls, v_table);
    end if;
  end loop;

  if array_length(v_missing_rls, 1) is not null then
    raise warning 'RLS not enabled on: %', array_to_string(v_missing_rls, ', ');
  end if;

  if array_length(v_missing_force_rls, 1) is not null then
    raise warning 'FORCE RLS not enabled on: %', array_to_string(v_missing_force_rls, ', ');
  end if;

  -- 2) Canonical BusFlow policy presence.
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='busflow_routes' and policyname='Account members can read routes') then
    raise warning 'Missing policy: busflow_routes -> Account members can read routes';
  end if;
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='busflow_routes' and policyname='Dispatch or admin can write routes') then
    raise warning 'Missing policy: busflow_routes -> Dispatch or admin can write routes';
  end if;

  if not exists (select 1 from pg_policies where schemaname='public' and tablename='busflow_stops' and policyname='Account members can read stops') then
    raise warning 'Missing policy: busflow_stops -> Account members can read stops';
  end if;
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='busflow_stops' and policyname='Dispatch or admin can write stops') then
    raise warning 'Missing policy: busflow_stops -> Dispatch or admin can write stops';
  end if;

  if not exists (select 1 from pg_policies where schemaname='public' and tablename='busflow_customers' and policyname='Account members can read customers') then
    raise warning 'Missing policy: busflow_customers -> Account members can read customers';
  end if;
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='busflow_customers' and policyname='Dispatch or admin can write customers') then
    raise warning 'Missing policy: busflow_customers -> Dispatch or admin can write customers';
  end if;

  if not exists (select 1 from pg_policies where schemaname='public' and tablename='busflow_customer_contacts' and policyname='Account members can read customer contacts') then
    raise warning 'Missing policy: busflow_customer_contacts -> Account members can read customer contacts';
  end if;
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='busflow_customer_contacts' and policyname='Dispatch or admin can write customer contacts') then
    raise warning 'Missing policy: busflow_customer_contacts -> Dispatch or admin can write customer contacts';
  end if;

  if not exists (select 1 from pg_policies where schemaname='public' and tablename='busflow_workers' and policyname='Account members can read workers') then
    raise warning 'Missing policy: busflow_workers -> Account members can read workers';
  end if;
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='busflow_workers' and policyname='Dispatch or admin can write workers') then
    raise warning 'Missing policy: busflow_workers -> Dispatch or admin can write workers';
  end if;

  if not exists (select 1 from pg_policies where schemaname='public' and tablename='busflow_bus_types' and policyname='Account members can read bus types') then
    raise warning 'Missing policy: busflow_bus_types -> Account members can read bus types';
  end if;
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='busflow_bus_types' and policyname='Dispatch or admin can write bus types') then
    raise warning 'Missing policy: busflow_bus_types -> Dispatch or admin can write bus types';
  end if;

  if not exists (select 1 from pg_policies where schemaname='public' and tablename='busflow_app_settings' and policyname='Account members can read app settings') then
    raise warning 'Missing policy: busflow_app_settings -> Account members can read app settings';
  end if;
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='busflow_app_settings' and policyname='Dispatch or admin can write app settings') then
    raise warning 'Missing policy: busflow_app_settings -> Dispatch or admin can write app settings';
  end if;

  -- 3) Warn on suspicious policy expressions lacking account-scoping keywords.
  for v_policy in
    select tablename, policyname, coalesce(qual, '') as qual, coalesce(with_check, '') as with_check
    from pg_policies
    where schemaname = 'public'
      and tablename like 'busflow_%'
  loop
    v_expr := lower(v_policy.qual || ' ' || v_policy.with_check);
    if position('account_id' in v_expr) = 0
      and position('has_account_access' in v_expr) = 0
      and position('account_role' in v_expr) = 0
      and position('is_platform_admin' in v_expr) = 0 then
      raise warning 'Policy % on % may be missing account scoping. qual=% with_check=%',
        v_policy.policyname,
        v_policy.tablename,
        v_policy.qual,
        v_policy.with_check;
    end if;
  end loop;

  -- 4) Null account_id checks.
  foreach v_table in array array[
    'busflow_routes',
    'busflow_stops',
    'busflow_customers',
    'busflow_customer_contacts',
    'busflow_workers',
    'busflow_bus_types',
    'busflow_app_settings'
  ] loop
    execute format('select count(*) from public.%I where account_id is null', v_table) into v_count;
    if v_count > 0 then
      raise warning 'Table %.account_id still has NULL rows: %', v_table, v_count;
    end if;
  end loop;

  -- 5) Cross-account reference sanity checks.
  select count(*) into v_count
  from public.busflow_routes r
  join public.busflow_customers c on c.id = r.customer_id
  where r.account_id <> c.account_id;
  if v_count > 0 then
    raise warning 'Cross-account mismatch: routes.customer_id -> customers.account_id count=%', v_count;
  end if;

  select count(*) into v_count
  from public.busflow_routes r
  join public.busflow_customer_contacts cc on cc.id = r.customer_contact_id
  where r.customer_contact_id is not null
    and (r.account_id <> cc.account_id or r.customer_id <> cc.customer_id);
  if v_count > 0 then
    raise warning 'Cross-account mismatch: routes.customer_contact_id mismatch count=%', v_count;
  end if;

  select count(*) into v_count
  from public.busflow_routes r
  join public.busflow_workers w on w.id = r.worker_id
  where r.worker_id is not null
    and r.account_id <> w.account_id;
  if v_count > 0 then
    raise warning 'Cross-account mismatch: routes.worker_id -> workers.account_id count=%', v_count;
  end if;

  select count(*) into v_count
  from public.busflow_routes r
  join public.busflow_bus_types bt on bt.id = r.bus_type_id
  where r.bus_type_id is not null
    and r.account_id <> bt.account_id;
  if v_count > 0 then
    raise warning 'Cross-account mismatch: routes.bus_type_id -> bus_types.account_id count=%', v_count;
  end if;

  select count(*) into v_count
  from public.busflow_stops s
  join public.busflow_routes r on r.id = s.route_id
  where s.account_id <> r.account_id;
  if v_count > 0 then
    raise warning 'Cross-account mismatch: stops.route_id -> routes.account_id count=%', v_count;
  end if;

  select count(*) into v_count
  from public.busflow_customer_contacts cc
  join public.busflow_customers c on c.id = cc.customer_id
  where cc.account_id <> c.account_id;
  if v_count > 0 then
    raise warning 'Cross-account mismatch: contacts.customer_id -> customers.account_id count=%', v_count;
  end if;

  -- 6) Legacy policy drift checks.
  if exists (select 1 from pg_policies where schemaname='public' and policyname='Public profiles are viewable by everyone.') then
    raise warning 'Legacy profile policy still exists: Public profiles are viewable by everyone.';
  end if;

  if exists (select 1 from pg_policies where schemaname='public' and policyname='Users can update own profile.') then
    raise warning 'Legacy profile policy still exists: Users can update own profile.';
  end if;

  if exists (select 1 from pg_policies where schemaname='public' and policyname='Admins can view all permissions.') then
    raise warning 'Legacy permission policy still exists: Admins can view all permissions.';
  end if;
end
$$;
