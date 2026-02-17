-- Phase 3: Add Customer Name to Routes
alter table public.busflow_routes 
add column if not exists customer_name text;
