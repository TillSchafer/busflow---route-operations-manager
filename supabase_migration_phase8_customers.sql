-- Phase 8: Add customer master data for BusFlow suggestions

create table if not exists public.busflow_customers (
  id uuid default uuid_generate_v4() primary key,
  name text not null unique,
  notes text,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

alter table public.busflow_customers enable row level security;

drop policy if exists "Authenticated users can view customers" on public.busflow_customers;
create policy "Authenticated users can view customers"
  on public.busflow_customers
  for select
  using (auth.role() = 'authenticated');

drop policy if exists "Dispatch+ can manage customers" on public.busflow_customers;
create policy "Dispatch+ can manage customers"
  on public.busflow_customers
  for all
  using (
    (select global_role from public.profiles where id = auth.uid()) = 'ADMIN'
    or exists (
      select 1
      from public.app_permissions
      where user_id = auth.uid()
        and app_id = 'busflow'
        and role in ('ADMIN', 'DISPATCH')
    )
  );
