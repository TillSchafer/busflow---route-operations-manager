-- Phase 24: Tenant RLS enforcement and account integrity checks

-- Force RLS on tenant-scoped tables.
alter table public.busflow_routes force row level security;
alter table public.busflow_stops force row level security;
alter table public.busflow_customers force row level security;
alter table public.busflow_customer_contacts force row level security;
alter table public.busflow_workers force row level security;
alter table public.busflow_bus_types force row level security;
alter table public.busflow_app_settings force row level security;

-- Drop legacy broad policies.
drop policy if exists "Everyone can view published routes" on public.busflow_routes;
drop policy if exists "Dispatch+ can view all routes" on public.busflow_routes;
drop policy if exists "Dispatch+ can manage routes" on public.busflow_routes;
drop policy if exists "Viewable through routes" on public.busflow_stops;
drop policy if exists "Dispatch+ can manage stops" on public.busflow_stops;
drop policy if exists "Authenticated users can view customers" on public.busflow_customers;
drop policy if exists "Dispatch+ can manage customers" on public.busflow_customers;
drop policy if exists "Authenticated users can view customer contacts" on public.busflow_customer_contacts;
drop policy if exists "Dispatch+ can manage customer contacts" on public.busflow_customer_contacts;
drop policy if exists "Authenticated users can view workers" on public.busflow_workers;
drop policy if exists "Dispatch+ can manage workers" on public.busflow_workers;
drop policy if exists "Authenticated users can view bus types" on public.busflow_bus_types;
drop policy if exists "Dispatch+ can manage bus types" on public.busflow_bus_types;
drop policy if exists "Authenticated users can view app settings" on public.busflow_app_settings;
drop policy if exists "Dispatch+ can manage app settings" on public.busflow_app_settings;

-- Account-scoped read policies.
create policy "Account members can read routes"
  on public.busflow_routes for select
  using (public.has_account_access(account_id));

create policy "Account members can read stops"
  on public.busflow_stops for select
  using (public.has_account_access(account_id));

create policy "Account members can read customers"
  on public.busflow_customers for select
  using (public.has_account_access(account_id));

create policy "Account members can read customer contacts"
  on public.busflow_customer_contacts for select
  using (public.has_account_access(account_id));

create policy "Account members can read workers"
  on public.busflow_workers for select
  using (public.has_account_access(account_id));

create policy "Account members can read bus types"
  on public.busflow_bus_types for select
  using (public.has_account_access(account_id));

create policy "Account members can read app settings"
  on public.busflow_app_settings for select
  using (public.has_account_access(account_id));

-- Account-scoped write policies.
create policy "Dispatch or admin can write routes"
  on public.busflow_routes for all
  using (public.is_platform_admin() or public.account_role(account_id) in ('ADMIN','DISPATCH'))
  with check (public.is_platform_admin() or public.account_role(account_id) in ('ADMIN','DISPATCH'));

create policy "Dispatch or admin can write stops"
  on public.busflow_stops for all
  using (public.is_platform_admin() or public.account_role(account_id) in ('ADMIN','DISPATCH'))
  with check (public.is_platform_admin() or public.account_role(account_id) in ('ADMIN','DISPATCH'));

create policy "Dispatch or admin can write customers"
  on public.busflow_customers for all
  using (public.is_platform_admin() or public.account_role(account_id) in ('ADMIN','DISPATCH'))
  with check (public.is_platform_admin() or public.account_role(account_id) in ('ADMIN','DISPATCH'));

create policy "Dispatch or admin can write customer contacts"
  on public.busflow_customer_contacts for all
  using (public.is_platform_admin() or public.account_role(account_id) in ('ADMIN','DISPATCH'))
  with check (public.is_platform_admin() or public.account_role(account_id) in ('ADMIN','DISPATCH'));

create policy "Dispatch or admin can write workers"
  on public.busflow_workers for all
  using (public.is_platform_admin() or public.account_role(account_id) in ('ADMIN','DISPATCH'))
  with check (public.is_platform_admin() or public.account_role(account_id) in ('ADMIN','DISPATCH'));

create policy "Dispatch or admin can write bus types"
  on public.busflow_bus_types for all
  using (public.is_platform_admin() or public.account_role(account_id) in ('ADMIN','DISPATCH'))
  with check (public.is_platform_admin() or public.account_role(account_id) in ('ADMIN','DISPATCH'));

create policy "Dispatch or admin can write app settings"
  on public.busflow_app_settings for all
  using (public.is_platform_admin() or public.account_role(account_id) in ('ADMIN','DISPATCH'))
  with check (public.is_platform_admin() or public.account_role(account_id) in ('ADMIN','DISPATCH'));

-- Cross-table account consistency checks.
create or replace function public.enforce_busflow_account_integrity()
returns trigger
language plpgsql
as $$
declare
  v_route_account uuid;
  v_customer_account uuid;
  v_contact_customer uuid;
  v_contact_account uuid;
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

-- Admin cross-tenant audit trigger.
create or replace function public.audit_platform_admin_mutations()
returns trigger
language plpgsql
as $$
declare
  v_account_id uuid;
  v_resource_id uuid;
begin
  if not public.is_platform_admin() then
    return coalesce(new, old);
  end if;

  v_account_id := coalesce(new.account_id, old.account_id);
  v_resource_id := coalesce(new.id, old.id);

  insert into public.admin_access_audit(admin_user_id, target_account_id, action, resource, resource_id, meta)
  values (
    auth.uid(),
    v_account_id,
    tg_op,
    tg_table_name,
    v_resource_id,
    jsonb_build_object('source', 'db_trigger')
  );

  return coalesce(new, old);
end;
$$;

drop trigger if exists audit_admin_routes on public.busflow_routes;
create trigger audit_admin_routes
after insert or update or delete on public.busflow_routes
for each row execute function public.audit_platform_admin_mutations();

drop trigger if exists audit_admin_stops on public.busflow_stops;
create trigger audit_admin_stops
after insert or update or delete on public.busflow_stops
for each row execute function public.audit_platform_admin_mutations();

drop trigger if exists audit_admin_customers on public.busflow_customers;
create trigger audit_admin_customers
after insert or update or delete on public.busflow_customers
for each row execute function public.audit_platform_admin_mutations();

drop trigger if exists audit_admin_contacts on public.busflow_customer_contacts;
create trigger audit_admin_contacts
after insert or update or delete on public.busflow_customer_contacts
for each row execute function public.audit_platform_admin_mutations();

drop trigger if exists audit_admin_workers on public.busflow_workers;
create trigger audit_admin_workers
after insert or update or delete on public.busflow_workers
for each row execute function public.audit_platform_admin_mutations();

drop trigger if exists audit_admin_bus_types on public.busflow_bus_types;
create trigger audit_admin_bus_types
after insert or update or delete on public.busflow_bus_types
for each row execute function public.audit_platform_admin_mutations();

drop trigger if exists audit_admin_app_settings on public.busflow_app_settings;
create trigger audit_admin_app_settings
after insert or update or delete on public.busflow_app_settings
for each row execute function public.audit_platform_admin_mutations();
