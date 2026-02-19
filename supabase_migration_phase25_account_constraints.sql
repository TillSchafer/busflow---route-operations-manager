-- Phase 25: Tenant strict constraints and tenant-level uniqueness

-- Ensure account_id is mandatory for tenant-scoped data.
alter table public.busflow_routes alter column account_id set not null;
alter table public.busflow_stops alter column account_id set not null;
alter table public.busflow_customers alter column account_id set not null;
alter table public.busflow_customer_contacts alter column account_id set not null;
alter table public.busflow_workers alter column account_id set not null;
alter table public.busflow_bus_types alter column account_id set not null;
alter table public.busflow_app_settings alter column account_id set not null;

-- Replace global uniqueness with tenant-level uniqueness for customers.
alter table public.busflow_customers drop constraint if exists busflow_customers_name_key;
drop index if exists idx_busflow_customers_name;

create unique index if not exists uq_busflow_customers_account_name
  on public.busflow_customers(account_id, lower(btrim(name)));

-- Replace contact uniqueness with tenant+customer scoped uniqueness.
drop index if exists idx_busflow_customer_contacts_customer_email_unique;

create unique index if not exists uq_busflow_customer_contacts_account_customer_email
  on public.busflow_customer_contacts(account_id, customer_id, lower(email))
  where email is not null and btrim(email) <> '';

create index if not exists idx_busflow_customer_contacts_account_name_phone
  on public.busflow_customer_contacts(account_id, customer_id, lower(coalesce(full_name, '')), lower(coalesce(phone, '')));

-- Keep route and stop lookup performant per account.
create index if not exists idx_busflow_routes_account_date
  on public.busflow_routes(account_id, date);

create index if not exists idx_busflow_stops_account_route
  on public.busflow_stops(account_id, route_id, sequence_order);
