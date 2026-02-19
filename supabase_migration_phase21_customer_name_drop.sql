-- Phase 21: Compatibility cleanup after pilot verification
-- Run only after strict relational mode is stable in production.

alter table public.busflow_routes
  drop column if exists customer_name;
