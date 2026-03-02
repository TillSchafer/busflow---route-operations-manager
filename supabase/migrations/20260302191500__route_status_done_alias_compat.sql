-- Compatibility migration for completed route status values.
-- Some environments may already use "Durchgefuehrt" (ASCII).
-- Normalize existing rows and keep both values allowed in check constraint.

ALTER TABLE public.busflow_routes
  DROP CONSTRAINT IF EXISTS busflow_routes_status_check;

UPDATE public.busflow_routes
SET status = 'Durchgeführt'
WHERE status = 'Durchgefuehrt';

ALTER TABLE public.busflow_routes
  ADD CONSTRAINT busflow_routes_status_check
  CHECK (
    status IN (
      'Entwurf',
      'Geplant',
      'Aktiv',
      'Durchgeführt',
      'Durchgefuehrt',
      'Archiviert'
    )
  );
