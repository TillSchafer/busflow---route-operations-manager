-- Phase 35: Cleanup hardening indexes (non-breaking)
-- Adds/normalizes indexes matching current account-scoped query patterns.

create index if not exists idx_busflow_routes_account_date
  on public.busflow_routes(account_id, date);

create index if not exists idx_busflow_routes_account_status_date
  on public.busflow_routes(account_id, status, date);

create index if not exists idx_busflow_bus_types_account_name
  on public.busflow_bus_types(account_id, name);

create index if not exists idx_busflow_workers_account_name
  on public.busflow_workers(account_id, name);

create index if not exists idx_busflow_customer_contacts_account_full_name
  on public.busflow_customer_contacts(account_id, full_name);

create index if not exists idx_busflow_customer_contacts_account_customer
  on public.busflow_customer_contacts(account_id, customer_id);

create index if not exists idx_account_memberships_user_status
  on public.account_memberships(user_id, status);

create index if not exists idx_account_invitations_account_status_expires
  on public.account_invitations(account_id, status, expires_at);
