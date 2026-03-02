-- Phase: Driver-as-User
-- Replace busflow_workers with real auth users for route assignment.
-- Routes now store assigned_user_id (FK → profiles) instead of worker_id.
-- driver_name is kept as a denormalized display field populated from profiles.full_name.

-- 1. Add assigned_user_id column
ALTER TABLE public.busflow_routes
  ADD COLUMN IF NOT EXISTS assigned_user_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL;

-- 2. Update save_busflow_route_with_stops RPC to handle assigned_user_id
CREATE OR REPLACE FUNCTION public.save_busflow_route_with_stops(
  p_account_id uuid,
  p_route_id uuid,
  p_expected_updated_at timestamp with time zone,
  p_route jsonb,
  p_stops jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_current_updated_at timestamp with time zone;
  v_new_updated_at      timestamp with time zone;
  v_customer_id         uuid;
  v_customer_contact_id uuid;
  v_contact_customer_id uuid;
  v_bus_type_id         uuid;
  v_bus_type_account_id uuid;
  v_route_account_id    uuid;
  v_assigned_user_id    uuid;
BEGIN
  IF p_account_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'code', 'ACCOUNT_REQUIRED');
  END IF;

  IF NOT public.has_account_access(p_account_id) THEN
    RETURN jsonb_build_object('ok', false, 'code', 'ACCOUNT_ACCESS_DENIED');
  END IF;

  SELECT updated_at, account_id
    INTO v_current_updated_at, v_route_account_id
  FROM public.busflow_routes
  WHERE id = p_route_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'code', 'ROUTE_NOT_FOUND');
  END IF;

  IF v_route_account_id <> p_account_id THEN
    RETURN jsonb_build_object('ok', false, 'code', 'ACCOUNT_MISMATCH');
  END IF;

  IF p_expected_updated_at IS NOT NULL AND v_current_updated_at <> p_expected_updated_at THEN
    RETURN jsonb_build_object('ok', false, 'code', 'ROUTE_CONFLICT', 'updated_at', v_current_updated_at);
  END IF;

  v_customer_id := nullif(p_route->>'customerId', '')::uuid;
  IF v_customer_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'code', 'CUSTOMER_REQUIRED');
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.busflow_customers c
    WHERE c.id = v_customer_id AND c.account_id = p_account_id
  ) THEN
    RETURN jsonb_build_object('ok', false, 'code', 'ACCOUNT_MISMATCH');
  END IF;

  v_customer_contact_id := nullif(p_route->>'customerContactId', '')::uuid;
  IF v_customer_contact_id IS NOT NULL THEN
    SELECT customer_id
      INTO v_contact_customer_id
    FROM public.busflow_customer_contacts
    WHERE id = v_customer_contact_id AND account_id = p_account_id;

    IF NOT FOUND THEN
      RETURN jsonb_build_object('ok', false, 'code', 'CONTACT_NOT_FOUND');
    END IF;

    IF v_contact_customer_id <> v_customer_id THEN
      RETURN jsonb_build_object('ok', false, 'code', 'CUSTOMER_CONTACT_MISMATCH');
    END IF;
  END IF;

  -- assigned_user_id: optional, validate existence in profiles
  v_assigned_user_id := nullif(p_route->>'assignedUserId', '')::uuid;
  IF v_assigned_user_id IS NOT NULL THEN
    IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = v_assigned_user_id) THEN
      RETURN jsonb_build_object('ok', false, 'code', 'ASSIGNED_USER_NOT_FOUND');
    END IF;
  END IF;

  v_bus_type_id := nullif(p_route->>'busTypeId', '')::uuid;
  IF v_bus_type_id IS NOT NULL THEN
    SELECT account_id INTO v_bus_type_account_id
    FROM public.busflow_bus_types WHERE id = v_bus_type_id;

    IF NOT FOUND THEN
      RETURN jsonb_build_object('ok', false, 'code', 'BUS_TYPE_NOT_FOUND');
    END IF;

    IF v_bus_type_account_id <> p_account_id THEN
      RETURN jsonb_build_object('ok', false, 'code', 'BUS_TYPE_ACCOUNT_MISMATCH');
    END IF;
  END IF;

  UPDATE public.busflow_routes SET
    account_id           = p_account_id,
    name                 = COALESCE(p_route->>'name', name),
    date                 = COALESCE((p_route->>'date')::date, date),
    status               = COALESCE(p_route->>'status', status),
    bus_number           = nullif(p_route->>'busNumber', ''),
    driver_name          = nullif(p_route->>'driverName', ''),
    customer_id          = v_customer_id,
    customer_contact_id  = v_customer_contact_id,
    operational_notes    = nullif(p_route->>'operationalNotes', ''),
    capacity             = COALESCE((p_route->>'capacity')::int, capacity),
    bus_type_id          = v_bus_type_id,
    assigned_user_id     = v_assigned_user_id,
    km_start_betrieb     = nullif(p_route->>'kmStartBetrieb', ''),
    km_start_customer    = nullif(p_route->>'kmStartCustomer', ''),
    km_end_customer      = nullif(p_route->>'kmEndCustomer', ''),
    km_end_betrieb       = nullif(p_route->>'kmEndBetrieb', ''),
    total_km             = nullif(p_route->>'totalKm', ''),
    time_return_betrieb  = nullif(p_route->>'timeReturnBetrieb', ''),
    time_return_customer = nullif(p_route->>'timeReturnCustomer', '')
  WHERE id = p_route_id
  RETURNING updated_at INTO v_new_updated_at;

  DELETE FROM public.busflow_stops
  WHERE route_id = p_route_id AND account_id = p_account_id;

  INSERT INTO public.busflow_stops (
    route_id, account_id, location,
    arrival_time, departure_time,
    actual_arrival_time, actual_departure_time,
    boarding, leaving, current_total,
    sequence_order, lat, lon, notes
  )
  SELECT
    p_route_id,
    p_account_id,
    COALESCE(item->>'location', ''),
    nullif(item->>'arrivalTime', '')::time,
    nullif(item->>'departureTime', '')::time,
    nullif(item->>'actualArrivalTime', '')::time,
    nullif(item->>'actualDepartureTime', '')::time,
    COALESCE(nullif(item->>'boarding', ''), '0')::int,
    COALESCE(nullif(item->>'leaving', ''), '0')::int,
    COALESCE(nullif(item->>'currentTotal', ''), '0')::int,
    ordinality - 1,
    nullif(item->>'lat', '')::double precision,
    nullif(item->>'lon', '')::double precision,
    nullif(item->>'notes', '')
  FROM jsonb_array_elements(COALESCE(p_stops, '[]'::jsonb)) WITH ORDINALITY AS s(item, ordinality);

  RETURN jsonb_build_object('ok', true, 'updated_at', v_new_updated_at);
END;
$$;
