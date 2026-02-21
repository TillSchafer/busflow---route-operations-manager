-- Phase 16: Customer search indexes for server-side filtering

create index if not exists idx_busflow_customers_city on public.busflow_customers(city);
create index if not exists idx_busflow_customers_street on public.busflow_customers(street);
create index if not exists idx_busflow_customers_email on public.busflow_customers(email);
create index if not exists idx_busflow_customers_phone on public.busflow_customers(phone);
