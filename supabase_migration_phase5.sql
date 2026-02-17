-- Phase 5: Add missing Route fields
-- These fields were added to the UI but not the database schema.

ALTER TABLE public.busflow_routes
ADD COLUMN IF NOT EXISTS capacity int DEFAULT 0,
ADD COLUMN IF NOT EXISTS worker_id uuid REFERENCES public.busflow_workers(id),
ADD COLUMN IF NOT EXISTS km_start_betrieb text,
ADD COLUMN IF NOT EXISTS km_start_customer text,
ADD COLUMN IF NOT EXISTS km_end_customer text,
ADD COLUMN IF NOT EXISTS km_end_betrieb text,
ADD COLUMN IF NOT EXISTS total_km text,
ADD COLUMN IF NOT EXISTS time_return_betrieb text,
ADD COLUMN IF NOT EXISTS time_return_customer text;

-- Ensure RLS allows updates to these new columns (existing policies should cover "all" or specific operations, but good to verify)
-- Existing policies: "Dispatch+ can manage routes" ... using (exists...)
-- This covers INSERT/UPDATE/DELETE so no new policy needed.
