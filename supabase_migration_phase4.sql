-- Phase 4: Update Status Enum & Constraints

-- 1. Drop existing check constraint
ALTER TABLE public.busflow_routes DROP CONSTRAINT IF EXISTS busflow_routes_status_check;

-- 2. Migrate existing data to new statuses
-- Map 'Draft' -> 'Entwurf'
UPDATE public.busflow_routes SET status = 'Entwurf' WHERE status = 'Draft';
-- Map 'Published' -> 'Aktiv' (Assuming Published meant Active)
UPDATE public.busflow_routes SET status = 'Aktiv' WHERE status = 'Published';

-- 3. Add new check constraint
ALTER TABLE public.busflow_routes 
ADD CONSTRAINT busflow_routes_status_check 
CHECK (status IN ('Aktiv', 'Geplant', 'Entwurf', 'Archiviert'));
