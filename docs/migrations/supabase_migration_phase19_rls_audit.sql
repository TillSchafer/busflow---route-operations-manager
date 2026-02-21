-- Phase 19: Production RLS audit and security sanity checks (non-mutating)
--
-- This migration only emits warnings. It does not change business data.
-- Use it to verify launch readiness in shared Supabase environments.

do $$
declare
  v_missing_rls text[] := '{}';
  v_table text;
  v_unresolved_count integer;
  v_sample text;
begin
  -- Ensure RLS is enabled on all critical application tables.
  foreach v_table in array array[
    'profiles',
    'app_permissions',
    'busflow_routes',
    'busflow_stops',
    'busflow_bus_types',
    'busflow_workers',
    'busflow_customers',
    'busflow_customer_contacts',
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
  end loop;

  if array_length(v_missing_rls, 1) is not null then
    raise warning 'RLS not enabled on: %', array_to_string(v_missing_rls, ', ');
  end if;

  -- Verify expected trigger exists.
  if not exists (
    select 1
    from information_schema.triggers
    where event_object_schema = 'auth'
      and event_object_table = 'users'
      and trigger_name = 'on_auth_user_created'
  ) then
    raise warning 'Missing expected trigger: auth.users -> on_auth_user_created';
  end if;

  -- Verify critical policies for role model and customer/contact scope.
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'profiles' and policyname = 'Admins can update profiles.'
  ) then
    raise warning 'Missing policy: public.profiles -> Admins can update profiles.';
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'app_permissions' and policyname = 'Admins can insert permissions.'
  ) then
    raise warning 'Missing policy: public.app_permissions -> Admins can insert permissions.';
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'app_permissions' and policyname = 'Admins can update permissions.'
  ) then
    raise warning 'Missing policy: public.app_permissions -> Admins can update permissions.';
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'app_permissions' and policyname = 'Admins can delete permissions.'
  ) then
    raise warning 'Missing policy: public.app_permissions -> Admins can delete permissions.';
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'busflow_customers' and policyname = 'Dispatch+ can manage customers'
  ) then
    raise warning 'Missing policy: public.busflow_customers -> Dispatch+ can manage customers';
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'busflow_customer_contacts' and policyname = 'Dispatch+ can manage customer contacts'
  ) then
    raise warning 'Missing policy: public.busflow_customer_contacts -> Dispatch+ can manage customer contacts';
  end if;

  -- Route linkage sanity checks.
  if not exists (
    select 1
    from information_schema.columns
    where table_schema = 'public' and table_name = 'busflow_routes' and column_name = 'customer_id'
  ) then
    raise warning 'Missing column: public.busflow_routes.customer_id';
  end if;

  if not exists (
    select 1
    from information_schema.columns
    where table_schema = 'public' and table_name = 'busflow_routes' and column_name = 'customer_contact_id'
  ) then
    raise warning 'Missing column: public.busflow_routes.customer_contact_id';
  end if;

  select count(*)
    into v_unresolved_count
  from public.busflow_routes
  where customer_id is null;

  if v_unresolved_count > 0 then
    select string_agg(id::text, ', ')
      into v_sample
    from (
      select id
      from public.busflow_routes
      where customer_id is null
      order by created_at desc
      limit 20
    ) s;

    raise warning 'Routes without customer_id: %, sample route IDs: %', v_unresolved_count, coalesce(v_sample, 'n/a');
  end if;
end
$$;
