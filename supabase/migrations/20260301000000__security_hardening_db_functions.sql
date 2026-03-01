-- Security hardening: DB function search_path and SECURITY DEFINER fixes
-- HIGH-2: account_role() — add SECURITY DEFINER + set search_path = public
--   Reason: All other security-sensitive helper functions (is_platform_admin,
--   has_account_access, can_manage_account) were hardened in Phase 38. account_role()
--   was missed. It is called in RLS write-path policies for all 7 BusFlow tables,
--   so a missing search_path opens a schema-injection vector if a user-controlled
--   search_path is ever set before the function runs.
alter function public.account_role(uuid)
  security definer
  set search_path = public;

-- HIGH-3: save_busflow_route_with_stops — add set search_path = public
--   Note: SECURITY INVOKER is intentionally kept so RLS policies apply to the
--   calling user. Only search_path is hardened for defence-in-depth.
alter function public.save_busflow_route_with_stops(
  uuid,
  uuid,
  timestamp with time zone,
  jsonb,
  jsonb
)
  set search_path = public;

-- Verification
do $$
begin
  raise notice 'OK: security_hardening_db_functions applied';
end
$$;
