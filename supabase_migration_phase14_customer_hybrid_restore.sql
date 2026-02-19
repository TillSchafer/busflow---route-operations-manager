-- Phase 14: Hybrid customer model (free text + optional customer link)
-- Restores customer_name so routes can store arbitrary customer text.

alter table public.busflow_routes
add column if not exists customer_name text;

-- Backfill free-text customer label from linked customer where text is missing.
update public.busflow_routes r
set customer_name = c.name
from public.busflow_customers c
where r.customer_id = c.id
  and (r.customer_name is null or btrim(r.customer_name) = '');

-- Keep customer_id optional (no NOT NULL constraint by design).
create index if not exists idx_busflow_routes_customer_id on public.busflow_routes(customer_id);
