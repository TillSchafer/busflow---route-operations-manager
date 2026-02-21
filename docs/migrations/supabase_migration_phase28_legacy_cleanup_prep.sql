-- Phase 28: Legacy cleanup preparation (non-destructive)
--
-- This phase intentionally does not drop legacy auth model objects yet.
-- app_permissions deprecation is postponed until full account_memberships cutover is validated.
-- customer_name drop remains in phase21 and should run only after tenant cutover and pilot verification.

do $$
begin
  raise notice 'Phase28 prep completed: legacy cleanup deferred by design.';
end
$$;
