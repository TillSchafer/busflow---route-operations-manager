-- Phase 23: Add account_id to all BusFlow domain tables and backfill

do $$
declare
  v_default_account_id uuid;
begin
  select id into v_default_account_id
  from public.platform_accounts
  where slug = 'pilot-account'
  limit 1;

  if v_default_account_id is null then
    raise exception 'Default account not found. Run phase22 first.';
  end if;

  alter table public.busflow_routes add column if not exists account_id uuid;
  alter table public.busflow_stops add column if not exists account_id uuid;
  alter table public.busflow_customers add column if not exists account_id uuid;
  alter table public.busflow_customer_contacts add column if not exists account_id uuid;
  alter table public.busflow_workers add column if not exists account_id uuid;
  alter table public.busflow_bus_types add column if not exists account_id uuid;
  alter table public.busflow_app_settings add column if not exists account_id uuid;

  -- Direct backfill for master data tables.
  update public.busflow_customers
  set account_id = v_default_account_id
  where account_id is null;

  update public.busflow_workers
  set account_id = v_default_account_id
  where account_id is null;

  update public.busflow_bus_types
  set account_id = v_default_account_id
  where account_id is null;

  update public.busflow_app_settings
  set account_id = v_default_account_id
  where account_id is null;

  -- Routes first, then stops/contacts from parent relation.
  update public.busflow_routes
  set account_id = v_default_account_id
  where account_id is null;

  update public.busflow_customer_contacts c
  set account_id = coalesce(c.account_id, cust.account_id, v_default_account_id)
  from public.busflow_customers cust
  where cust.id = c.customer_id
    and c.account_id is null;

  update public.busflow_stops s
  set account_id = coalesce(r.account_id, v_default_account_id)
  from public.busflow_routes r
  where r.id = s.route_id
    and s.account_id is null;

  -- Add foreign keys if not present.
  if not exists (
    select 1 from information_schema.table_constraints
    where table_schema = 'public' and table_name = 'busflow_routes' and constraint_name = 'busflow_routes_account_id_fkey'
  ) then
    alter table public.busflow_routes
      add constraint busflow_routes_account_id_fkey
      foreign key (account_id) references public.platform_accounts(id);
  end if;

  if not exists (
    select 1 from information_schema.table_constraints
    where table_schema = 'public' and table_name = 'busflow_stops' and constraint_name = 'busflow_stops_account_id_fkey'
  ) then
    alter table public.busflow_stops
      add constraint busflow_stops_account_id_fkey
      foreign key (account_id) references public.platform_accounts(id);
  end if;

  if not exists (
    select 1 from information_schema.table_constraints
    where table_schema = 'public' and table_name = 'busflow_customers' and constraint_name = 'busflow_customers_account_id_fkey'
  ) then
    alter table public.busflow_customers
      add constraint busflow_customers_account_id_fkey
      foreign key (account_id) references public.platform_accounts(id);
  end if;

  if not exists (
    select 1 from information_schema.table_constraints
    where table_schema = 'public' and table_name = 'busflow_customer_contacts' and constraint_name = 'busflow_customer_contacts_account_id_fkey'
  ) then
    alter table public.busflow_customer_contacts
      add constraint busflow_customer_contacts_account_id_fkey
      foreign key (account_id) references public.platform_accounts(id);
  end if;

  if not exists (
    select 1 from information_schema.table_constraints
    where table_schema = 'public' and table_name = 'busflow_workers' and constraint_name = 'busflow_workers_account_id_fkey'
  ) then
    alter table public.busflow_workers
      add constraint busflow_workers_account_id_fkey
      foreign key (account_id) references public.platform_accounts(id);
  end if;

  if not exists (
    select 1 from information_schema.table_constraints
    where table_schema = 'public' and table_name = 'busflow_bus_types' and constraint_name = 'busflow_bus_types_account_id_fkey'
  ) then
    alter table public.busflow_bus_types
      add constraint busflow_bus_types_account_id_fkey
      foreign key (account_id) references public.platform_accounts(id);
  end if;

  if not exists (
    select 1 from information_schema.table_constraints
    where table_schema = 'public' and table_name = 'busflow_app_settings' and constraint_name = 'busflow_app_settings_account_id_fkey'
  ) then
    alter table public.busflow_app_settings
      add constraint busflow_app_settings_account_id_fkey
      foreign key (account_id) references public.platform_accounts(id);
  end if;

  -- Prepare app settings for tenant keying.
  alter table public.busflow_app_settings drop constraint if exists busflow_app_settings_pkey;

  if not exists (
    select 1 from information_schema.table_constraints
    where table_schema = 'public' and table_name = 'busflow_app_settings' and constraint_name = 'busflow_app_settings_pkey'
  ) then
    alter table public.busflow_app_settings
      add constraint busflow_app_settings_pkey primary key (account_id, key);
  end if;

  -- Account indexes for performance.
  create index if not exists idx_busflow_routes_account_id on public.busflow_routes(account_id);
  create index if not exists idx_busflow_stops_account_id on public.busflow_stops(account_id);
  create index if not exists idx_busflow_customers_account_id on public.busflow_customers(account_id);
  create index if not exists idx_busflow_customer_contacts_account_id on public.busflow_customer_contacts(account_id);
  create index if not exists idx_busflow_workers_account_id on public.busflow_workers(account_id);
  create index if not exists idx_busflow_bus_types_account_id on public.busflow_bus_types(account_id);
  create index if not exists idx_busflow_app_settings_account_id on public.busflow_app_settings(account_id);
end
$$;
