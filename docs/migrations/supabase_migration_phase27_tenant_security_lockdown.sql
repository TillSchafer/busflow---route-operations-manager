-- Phase 27: Tenant security lockdown (shared DB isolation hardening)
--
-- Goals:
-- - Enforce RLS + FORCE RLS on all tenant-relevant tables
-- - Remove legacy/unknown policies and recreate canonical tenant-safe policies
-- - Lock profiles/app_permissions to prevent privilege escalation
-- - Strengthen cross-table account integrity checks

-- 1) Ensure RLS + FORCE RLS are active on all sensitive tables.
do $$
declare
  v_table text;
begin
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
    if to_regclass(format('public.%I', v_table)) is not null then
      execute format('alter table public.%I enable row level security', v_table);
      execute format('alter table public.%I force row level security', v_table);
    end if;
  end loop;
end
$$;

-- 2) Deterministically drop all existing policies on tenant-relevant tables.
do $$
declare
  v_table text;
  v_policy text;
begin
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
    for v_policy in
      select p.policyname
      from pg_policies p
      where p.schemaname = 'public'
        and p.tablename = v_table
    loop
      execute format('drop policy if exists %I on public.%I', v_policy, v_table);
    end loop;
  end loop;
end
$$;

-- 3) Canonical profiles policies (strict visibility + anti-escalation).
create policy "Profiles: self or platform admin read"
  on public.profiles
  for select
  using (id = auth.uid() or public.is_platform_admin());

create policy "Profiles: self or platform admin insert"
  on public.profiles
  for insert
  with check (
    id = auth.uid()
    or public.is_platform_admin()
    or auth.role() in ('service_role', 'supabase_auth_admin')
  );

create policy "Profiles: self update without role escalation"
  on public.profiles
  for update
  using (id = auth.uid())
  with check (
    id = auth.uid()
    and global_role = 'USER'
  );

create policy "Profiles: platform admin update"
  on public.profiles
  for update
  using (public.is_platform_admin())
  with check (public.is_platform_admin());

create policy "Profiles: platform admin delete"
  on public.profiles
  for delete
  using (public.is_platform_admin());

-- 4) Canonical app_permissions policies.
create policy "App permissions: self or platform admin read"
  on public.app_permissions
  for select
  using (user_id = auth.uid() or public.is_platform_admin());

create policy "App permissions: platform admin or default-self insert"
  on public.app_permissions
  for insert
  with check (
    public.is_platform_admin()
    or (
      auth.role() in ('service_role', 'supabase_auth_admin')
      and app_id = 'busflow'
      and role = 'DISPATCH'
    )
    or (
      user_id = auth.uid()
      and app_id = 'busflow'
      and role = 'DISPATCH'
    )
  );

create policy "App permissions: platform admin update"
  on public.app_permissions
  for update
  using (public.is_platform_admin())
  with check (public.is_platform_admin());

create policy "App permissions: platform admin delete"
  on public.app_permissions
  for delete
  using (public.is_platform_admin());

-- 5) Canonical account table policies.
create policy "Accounts visible to members and platform admins"
  on public.platform_accounts
  for select
  using (public.has_account_access(id));

create policy "Only platform admins can create accounts"
  on public.platform_accounts
  for insert
  with check (public.is_platform_admin());

create policy "Only platform admins can update accounts"
  on public.platform_accounts
  for update
  using (public.is_platform_admin())
  with check (public.is_platform_admin());

create policy "Only platform admins can delete accounts"
  on public.platform_accounts
  for delete
  using (public.is_platform_admin());

create policy "Memberships visible to owner and platform admins"
  on public.account_memberships
  for select
  using (user_id = auth.uid() or public.is_platform_admin());

create policy "Only platform admins can manage memberships"
  on public.account_memberships
  for all
  using (public.is_platform_admin())
  with check (public.is_platform_admin());

create policy "Only platform admins can read admin audit"
  on public.admin_access_audit
  for select
  using (public.is_platform_admin());

create policy "System can write admin audit"
  on public.admin_access_audit
  for insert
  with check (public.is_platform_admin());

-- 6) Canonical BusFlow tenant policies.
create policy "Account members can read routes"
  on public.busflow_routes
  for select
  using (public.has_account_access(account_id));

create policy "Dispatch or admin can write routes"
  on public.busflow_routes
  for all
  using (public.is_platform_admin() or public.account_role(account_id) in ('ADMIN', 'DISPATCH'))
  with check (public.is_platform_admin() or public.account_role(account_id) in ('ADMIN', 'DISPATCH'));

create policy "Account members can read stops"
  on public.busflow_stops
  for select
  using (public.has_account_access(account_id));

create policy "Dispatch or admin can write stops"
  on public.busflow_stops
  for all
  using (public.is_platform_admin() or public.account_role(account_id) in ('ADMIN', 'DISPATCH'))
  with check (public.is_platform_admin() or public.account_role(account_id) in ('ADMIN', 'DISPATCH'));

create policy "Account members can read customers"
  on public.busflow_customers
  for select
  using (public.has_account_access(account_id));

create policy "Dispatch or admin can write customers"
  on public.busflow_customers
  for all
  using (public.is_platform_admin() or public.account_role(account_id) in ('ADMIN', 'DISPATCH'))
  with check (public.is_platform_admin() or public.account_role(account_id) in ('ADMIN', 'DISPATCH'));

create policy "Account members can read customer contacts"
  on public.busflow_customer_contacts
  for select
  using (public.has_account_access(account_id));

create policy "Dispatch or admin can write customer contacts"
  on public.busflow_customer_contacts
  for all
  using (public.is_platform_admin() or public.account_role(account_id) in ('ADMIN', 'DISPATCH'))
  with check (public.is_platform_admin() or public.account_role(account_id) in ('ADMIN', 'DISPATCH'));

create policy "Account members can read workers"
  on public.busflow_workers
  for select
  using (public.has_account_access(account_id));

create policy "Dispatch or admin can write workers"
  on public.busflow_workers
  for all
  using (public.is_platform_admin() or public.account_role(account_id) in ('ADMIN', 'DISPATCH'))
  with check (public.is_platform_admin() or public.account_role(account_id) in ('ADMIN', 'DISPATCH'));

create policy "Account members can read bus types"
  on public.busflow_bus_types
  for select
  using (public.has_account_access(account_id));

create policy "Dispatch or admin can write bus types"
  on public.busflow_bus_types
  for all
  using (public.is_platform_admin() or public.account_role(account_id) in ('ADMIN', 'DISPATCH'))
  with check (public.is_platform_admin() or public.account_role(account_id) in ('ADMIN', 'DISPATCH'));

create policy "Account members can read app settings"
  on public.busflow_app_settings
  for select
  using (public.has_account_access(account_id));

create policy "Dispatch or admin can write app settings"
  on public.busflow_app_settings
  for all
  using (public.is_platform_admin() or public.account_role(account_id) in ('ADMIN', 'DISPATCH'))
  with check (public.is_platform_admin() or public.account_role(account_id) in ('ADMIN', 'DISPATCH'));

-- 7) Strengthen account-integrity trigger checks (routes, stops, contacts).
create or replace function public.enforce_busflow_account_integrity()
returns trigger
language plpgsql
as $$
declare
  v_route_account uuid;
  v_customer_account uuid;
  v_contact_customer uuid;
  v_contact_account uuid;
  v_worker_account uuid;
  v_bus_type_account uuid;
begin
  if tg_table_name = 'busflow_stops' then
    select account_id into v_route_account
    from public.busflow_routes
    where id = new.route_id;

    if v_route_account is null then
      raise exception 'Route not found for stop.' using errcode = '23503';
    end if;

    if new.account_id is null then
      new.account_id := v_route_account;
    elsif new.account_id <> v_route_account then
      raise exception 'Stop account mismatch with route account.' using errcode = '23514';
    end if;

    return new;
  end if;

  if tg_table_name = 'busflow_routes' then
    select account_id into v_customer_account
    from public.busflow_customers
    where id = new.customer_id;

    if v_customer_account is null then
      raise exception 'Customer not found for route.' using errcode = '23503';
    end if;

    if new.account_id is null then
      new.account_id := v_customer_account;
    elsif new.account_id <> v_customer_account then
      raise exception 'Route account mismatch with customer account.' using errcode = '23514';
    end if;

    if new.customer_contact_id is not null then
      select customer_id, account_id
        into v_contact_customer, v_contact_account
      from public.busflow_customer_contacts
      where id = new.customer_contact_id;

      if v_contact_customer is null then
        raise exception 'Customer contact not found for route.' using errcode = '23503';
      end if;

      if v_contact_customer <> new.customer_id then
        raise exception 'Route contact does not belong to selected customer.' using errcode = '23514';
      end if;

      if v_contact_account <> new.account_id then
        raise exception 'Route contact account mismatch.' using errcode = '23514';
      end if;
    end if;

    if new.worker_id is not null then
      select account_id
        into v_worker_account
      from public.busflow_workers
      where id = new.worker_id;

      if v_worker_account is null then
        raise exception 'Worker not found for route.' using errcode = '23503';
      end if;

      if v_worker_account <> new.account_id then
        raise exception 'Route worker account mismatch.' using errcode = '23514';
      end if;
    end if;

    if new.bus_type_id is not null then
      select account_id
        into v_bus_type_account
      from public.busflow_bus_types
      where id = new.bus_type_id;

      if v_bus_type_account is null then
        raise exception 'Bus type not found for route.' using errcode = '23503';
      end if;

      if v_bus_type_account <> new.account_id then
        raise exception 'Route bus type account mismatch.' using errcode = '23514';
      end if;
    end if;

    return new;
  end if;

  if tg_table_name = 'busflow_customer_contacts' then
    select account_id into v_customer_account
    from public.busflow_customers
    where id = new.customer_id;

    if v_customer_account is null then
      raise exception 'Customer not found for contact.' using errcode = '23503';
    end if;

    if new.account_id is null then
      new.account_id := v_customer_account;
    elsif new.account_id <> v_customer_account then
      raise exception 'Contact account mismatch with customer account.' using errcode = '23514';
    end if;

    return new;
  end if;

  return new;
end;
$$;

drop trigger if exists enforce_busflow_stops_account_integrity on public.busflow_stops;
create trigger enforce_busflow_stops_account_integrity
before insert or update on public.busflow_stops
for each row execute function public.enforce_busflow_account_integrity();

drop trigger if exists enforce_busflow_routes_account_integrity on public.busflow_routes;
create trigger enforce_busflow_routes_account_integrity
before insert or update on public.busflow_routes
for each row execute function public.enforce_busflow_account_integrity();

drop trigger if exists enforce_busflow_contacts_account_integrity on public.busflow_customer_contacts;
create trigger enforce_busflow_contacts_account_integrity
before insert or update on public.busflow_customer_contacts
for each row execute function public.enforce_busflow_account_integrity();
