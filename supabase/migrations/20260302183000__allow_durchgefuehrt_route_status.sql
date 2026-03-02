-- Ensure busflow route status allows "Durchgeführt" for completed plans.
ALTER TABLE public.busflow_routes
  DROP CONSTRAINT IF EXISTS busflow_routes_status_check;

ALTER TABLE public.busflow_routes
  ADD CONSTRAINT busflow_routes_status_check
  CHECK (status IN ('Entwurf', 'Geplant', 'Aktiv', 'Durchgeführt', 'Archiviert'));
