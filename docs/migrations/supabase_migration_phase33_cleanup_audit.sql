-- Phase 33: Cleanup audit (read-only)
-- Emits warnings for legacy drift and non-canonical runtime shapes.

do $$
declare
  v_count integer;
  v_exists boolean;
begin
  -- 1) Legacy compatibility function should no longer be active.
  select exists (
    select 1
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname = 'enforce_busflow_route_customer_contact_match'
      and p.pronargs = 0
  ) into v_exists;

  if v_exists then
    raise warning 'Legacy function still present: public.enforce_busflow_route_customer_contact_match()';
  end if;

  -- 2) Canonical route RPC should have account-scoped signature.
  if not exists (
    select 1
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname = 'save_busflow_route_with_stops'
      and p.pronargs = 5
  ) then
    raise warning 'Expected account-scoped save_busflow_route_with_stops(p_account_id, ...) signature not found.';
  end if;

  -- 3) Tenant-critical tables should have non-null account_id.
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name in (
        'busflow_routes',
        'busflow_stops',
        'busflow_customers',
        'busflow_customer_contacts',
        'busflow_workers',
        'busflow_bus_types',
        'busflow_app_settings'
      )
      and column_name = 'account_id'
      and is_nullable = 'YES'
  ) then
    raise warning 'One or more tenant tables still allow NULL account_id.';
  end if;

  -- 4) Potentially unresolved invite rows (expired but pending).
  select count(*) into v_count
  from public.account_invitations
  where status = 'PENDING'
    and expires_at <= timezone('utc'::text, now());

  if v_count > 0 then
    raise warning 'Expired invitations still pending: %', v_count;
  end if;

  -- 5) Optional compatibility warning: legacy customer_name column.
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'busflow_routes'
      and column_name = 'customer_name'
  ) then
    raise warning 'Legacy column busflow_routes.customer_name still exists (expected only before phase21 rollout).';
  end if;
end
$$;
