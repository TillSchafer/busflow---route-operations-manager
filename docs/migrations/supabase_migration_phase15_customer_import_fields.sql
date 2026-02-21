-- Phase 15: Extend customers for CSV import with structured contact fields

alter table public.busflow_customers
  add column if not exists phone text,
  add column if not exists street text,
  add column if not exists postal_code text,
  add column if not exists city text,
  add column if not exists country text,
  add column if not exists email text,
  add column if not exists contact_person text,
  add column if not exists metadata jsonb not null default '{}'::jsonb;

create index if not exists idx_busflow_customers_name on public.busflow_customers(name);
