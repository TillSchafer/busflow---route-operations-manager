-- Phase 26: Account-scoped canonical route/stops RPC

create or replace function public.save_busflow_route_with_stops(
  p_account_id uuid,
  p_route_id uuid,
  p_expected_updated_at timestamp with time zone,
  p_route jsonb,
  p_stops jsonb
)
returns jsonb
language plpgsql
as $$
declare
  v_current_updated_at timestamp with time zone;
  v_new_updated_at timestamp with time zone;
  v_customer_id uuid;
  v_customer_contact_id uuid;
  v_contact_customer_id uuid;
  v_worker_id uuid;
  v_worker_account_id uuid;
  v_bus_type_id uuid;
  v_bus_type_account_id uuid;
  v_route_account_id uuid;
begin
  if p_account_id is null then
    return jsonb_build_object('ok', false, 'code', 'ACCOUNT_REQUIRED');
  end if;

  if not public.has_account_access(p_account_id) then
    return jsonb_build_object('ok', false, 'code', 'ACCOUNT_ACCESS_DENIED');
  end if;

  select updated_at, account_id
    into v_current_updated_at, v_route_account_id
  from public.busflow_routes
  where id = p_route_id
  for update;

  if not found then
    return jsonb_build_object('ok', false, 'code', 'ROUTE_NOT_FOUND');
  end if;

  if v_route_account_id <> p_account_id then
    return jsonb_build_object('ok', false, 'code', 'ACCOUNT_MISMATCH');
  end if;

  if p_expected_updated_at is not null and v_current_updated_at <> p_expected_updated_at then
    return jsonb_build_object('ok', false, 'code', 'ROUTE_CONFLICT', 'updated_at', v_current_updated_at);
  end if;

  v_customer_id := nullif(p_route->>'customerId', '')::uuid;
  if v_customer_id is null then
    return jsonb_build_object('ok', false, 'code', 'CUSTOMER_REQUIRED');
  end if;

  if not exists (
    select 1 from public.busflow_customers c
    where c.id = v_customer_id
      and c.account_id = p_account_id
  ) then
    return jsonb_build_object('ok', false, 'code', 'ACCOUNT_MISMATCH');
  end if;

  v_customer_contact_id := nullif(p_route->>'customerContactId', '')::uuid;
  if v_customer_contact_id is not null then
    select customer_id
      into v_contact_customer_id
    from public.busflow_customer_contacts
    where id = v_customer_contact_id
      and account_id = p_account_id;

    if not found then
      return jsonb_build_object('ok', false, 'code', 'CONTACT_NOT_FOUND');
    end if;

    if v_contact_customer_id <> v_customer_id then
      return jsonb_build_object('ok', false, 'code', 'CUSTOMER_CONTACT_MISMATCH');
    end if;
  end if;

  v_worker_id := nullif(p_route->>'workerId', '')::uuid;
  if v_worker_id is not null then
    select account_id
      into v_worker_account_id
    from public.busflow_workers
    where id = v_worker_id;

    if not found then
      return jsonb_build_object('ok', false, 'code', 'WORKER_NOT_FOUND');
    end if;

    if v_worker_account_id <> p_account_id then
      return jsonb_build_object('ok', false, 'code', 'WORKER_ACCOUNT_MISMATCH');
    end if;
  end if;

  v_bus_type_id := nullif(p_route->>'busTypeId', '')::uuid;
  if v_bus_type_id is not null then
    select account_id
      into v_bus_type_account_id
    from public.busflow_bus_types
    where id = v_bus_type_id;

    if not found then
      return jsonb_build_object('ok', false, 'code', 'BUS_TYPE_NOT_FOUND');
    end if;

    if v_bus_type_account_id <> p_account_id then
      return jsonb_build_object('ok', false, 'code', 'BUS_TYPE_ACCOUNT_MISMATCH');
    end if;
  end if;

  update public.busflow_routes
  set
    account_id = p_account_id,
    name = coalesce(p_route->>'name', name),
    date = coalesce((p_route->>'date')::date, date),
    status = coalesce(p_route->>'status', status),
    bus_number = nullif(p_route->>'busNumber', ''),
    driver_name = nullif(p_route->>'driverName', ''),
    customer_id = v_customer_id,
    customer_contact_id = v_customer_contact_id,
    operational_notes = nullif(p_route->>'operationalNotes', ''),
    capacity = coalesce((p_route->>'capacity')::int, capacity),
    bus_type_id = v_bus_type_id,
    worker_id = v_worker_id,
    km_start_betrieb = nullif(p_route->>'kmStartBetrieb', ''),
    km_start_customer = nullif(p_route->>'kmStartCustomer', ''),
    km_end_customer = nullif(p_route->>'kmEndCustomer', ''),
    km_end_betrieb = nullif(p_route->>'kmEndBetrieb', ''),
    total_km = nullif(p_route->>'totalKm', ''),
    time_return_betrieb = nullif(p_route->>'timeReturnBetrieb', ''),
    time_return_customer = nullif(p_route->>'timeReturnCustomer', '')
  where id = p_route_id
  returning updated_at into v_new_updated_at;

  delete from public.busflow_stops where route_id = p_route_id and account_id = p_account_id;

  insert into public.busflow_stops (
    route_id,
    account_id,
    location,
    arrival_time,
    departure_time,
    actual_arrival_time,
    actual_departure_time,
    boarding,
    leaving,
    current_total,
    sequence_order,
    lat,
    lon,
    notes
  )
  select
    p_route_id,
    p_account_id,
    coalesce(item->>'location', ''),
    nullif(item->>'arrivalTime', '')::time,
    nullif(item->>'departureTime', '')::time,
    nullif(item->>'actualArrivalTime', '')::time,
    nullif(item->>'actualDepartureTime', '')::time,
    coalesce(nullif(item->>'boarding', ''), '0')::int,
    coalesce(nullif(item->>'leaving', ''), '0')::int,
    coalesce(nullif(item->>'currentTotal', ''), '0')::int,
    ordinality - 1,
    nullif(item->>'lat', '')::double precision,
    nullif(item->>'lon', '')::double precision,
    nullif(item->>'notes', '')
  from jsonb_array_elements(coalesce(p_stops, '[]'::jsonb)) with ordinality as s(item, ordinality);

  return jsonb_build_object('ok', true, 'updated_at', v_new_updated_at);
end;
$$;
