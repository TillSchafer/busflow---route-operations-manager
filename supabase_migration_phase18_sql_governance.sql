-- Phase 18: SQL governance and drift control (migration-first)
--
-- This migration does not change business behavior. It documents canonical ownership
-- for critical functions and validates that required DB objects still exist.
--
-- Canonical owners:
-- - public.handle_new_user -> supabase_migration_phase12_backend_cleanup.sql
-- - public.save_busflow_route_with_stops -> supabase_migration_phase20b_rpc_strict_customer.sql

-- Keep expected lookup indexes idempotent.
create index if not exists idx_busflow_routes_customer_id
  on public.busflow_routes(customer_id);

create index if not exists idx_busflow_routes_customer_contact_id
  on public.busflow_routes(customer_contact_id);

-- Annotate canonical functions directly in DB metadata for operators.
comment on function public.handle_new_user()
  is 'Canonical owner migration: supabase_migration_phase12_backend_cleanup.sql. Do not patch manually.';

comment on function public.save_busflow_route_with_stops(uuid, timestamp with time zone, jsonb, jsonb)
  is 'Canonical owner migration: supabase_migration_phase20b_rpc_strict_customer.sql. Do not patch manually.';

-- Sanity checks: raise warnings if required objects are missing.
do $$
begin
  if not exists (
    select 1
    from information_schema.triggers
    where event_object_schema = 'auth'
      and event_object_table = 'users'
      and trigger_name = 'on_auth_user_created'
  ) then
    raise warning 'Missing expected trigger: auth.users -> on_auth_user_created';
  end if;

  if not exists (
    select 1
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname = 'handle_new_user'
  ) then
    raise warning 'Missing expected function: public.handle_new_user';
  end if;

  if not exists (
    select 1
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname = 'save_busflow_route_with_stops'
  ) then
    raise warning 'Missing expected function: public.save_busflow_route_with_stops';
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'profiles'
      and policyname = 'Admins can update profiles.'
  ) then
    raise warning 'Missing expected policy: public.profiles -> Admins can update profiles.';
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'app_permissions'
      and policyname = 'Admins can insert permissions.'
  ) then
    raise warning 'Missing expected policy: public.app_permissions -> Admins can insert permissions.';
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'app_permissions'
      and policyname = 'Admins can update permissions.'
  ) then
    raise warning 'Missing expected policy: public.app_permissions -> Admins can update permissions.';
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'app_permissions'
      and policyname = 'Admins can delete permissions.'
  ) then
    raise warning 'Missing expected policy: public.app_permissions -> Admins can delete permissions.';
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'busflow_customers'
      and policyname = 'Dispatch+ can manage customers'
  ) then
    raise warning 'Missing expected policy: public.busflow_customers -> Dispatch+ can manage customers';
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'busflow_customer_contacts'
      and policyname = 'Dispatch+ can manage customer contacts'
  ) then
    raise warning 'Missing expected policy: public.busflow_customer_contacts -> Dispatch+ can manage customer contacts';
  end if;
end
$$;
