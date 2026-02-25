-- Migration workflow bootstrap marker
-- Date: 2026-02-24
-- Purpose:
-- 1) Establish supabase/migrations as canonical path for future CLI db push/pull workflows.
-- 2) Keep legacy SQL history under docs/migrations as archive/reference only.
--
-- This migration is intentionally no-op for schema state.

do $$
begin
  raise notice 'Migration workflow bootstrap active: use supabase/migrations for new migrations.';
end
$$;
