-- Phase 11: Cleanup legacy customer_name after customer_id rollout is stable

-- Drop legacy free-text column. Route/customer display should now come from customer_id joins.
alter table public.busflow_routes
drop column if exists customer_name;

-- Optional hard rule (enable later if customer must always be selected):
-- alter table public.busflow_routes
-- alter column customer_id set not null;
