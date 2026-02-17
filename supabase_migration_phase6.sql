-- Phase 6: Persist missing form fields
-- Adds columns that are already used in the UI but were not stored in DB.

ALTER TABLE public.busflow_routes
ADD COLUMN IF NOT EXISTS bus_number text;

ALTER TABLE public.busflow_stops
ADD COLUMN IF NOT EXISTS actual_arrival_time time,
ADD COLUMN IF NOT EXISTS actual_departure_time time,
ADD COLUMN IF NOT EXISTS lat double precision,
ADD COLUMN IF NOT EXISTS lon double precision;
