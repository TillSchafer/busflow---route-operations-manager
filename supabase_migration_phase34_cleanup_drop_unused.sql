-- Phase 34: Verified unused artifact cleanup
-- Safe, idempotent drops for legacy artifacts superseded by tenant/account integrity logic.

-- Legacy trigger name from pre-account-integrity model.
drop trigger if exists enforce_busflow_route_customer_contact_match on public.busflow_routes;

-- Legacy function superseded by enforce_busflow_account_integrity().
drop function if exists public.enforce_busflow_route_customer_contact_match();
