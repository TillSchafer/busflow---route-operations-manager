-- Phase 9: Concurrency safety for multi-user route editing

-- 1) Add updated_at to routes for optimistic concurrency checks
alter table public.busflow_routes
add column if not exists updated_at timestamp with time zone default timezone('utc'::text, now()) not null;

-- Keep updated_at current for any direct update paths.
create or replace function public.set_updated_at()
returns trigger as $$
begin
  new.updated_at = timezone('utc'::text, now());
  return new;
end;
$$ language plpgsql;

drop trigger if exists set_busflow_routes_updated_at on public.busflow_routes;
create trigger set_busflow_routes_updated_at
before update on public.busflow_routes
for each row execute function public.set_updated_at();

-- 2) Atomic save RPC: route header + stops in one transaction with conflict detection.
create or replace function public.save_busflow_route_with_stops(
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
begin
  select updated_at
    into v_current_updated_at
  from public.busflow_routes
  where id = p_route_id
  for update;

  if not found then
    return jsonb_build_object(
      'ok', false,
      'code', 'ROUTE_NOT_FOUND'
    );
  end if;

  if p_expected_updated_at is not null and v_current_updated_at <> p_expected_updated_at then
    return jsonb_build_object(
      'ok', false,
      'code', 'ROUTE_CONFLICT',
      'updated_at', v_current_updated_at
    );
  end if;

  update public.busflow_routes
  set
    name = coalesce(p_route->>'name', name),
    date = coalesce((p_route->>'date')::date, date),
    status = coalesce(p_route->>'status', status),
    bus_number = nullif(p_route->>'busNumber', ''),
    driver_name = nullif(p_route->>'driverName', ''),
    customer_name = nullif(p_route->>'customerName', ''),
    operational_notes = nullif(p_route->>'operationalNotes', ''),
    capacity = coalesce((p_route->>'capacity')::int, capacity),
    bus_type_id = nullif(p_route->>'busTypeId', '')::uuid,
    worker_id = nullif(p_route->>'workerId', '')::uuid,
    km_start_betrieb = nullif(p_route->>'kmStartBetrieb', ''),
    km_start_customer = nullif(p_route->>'kmStartCustomer', ''),
    km_end_customer = nullif(p_route->>'kmEndCustomer', ''),
    km_end_betrieb = nullif(p_route->>'kmEndBetrieb', ''),
    total_km = nullif(p_route->>'totalKm', ''),
    time_return_betrieb = nullif(p_route->>'timeReturnBetrieb', ''),
    time_return_customer = nullif(p_route->>'timeReturnCustomer', '')
  where id = p_route_id
  returning updated_at into v_new_updated_at;

  delete from public.busflow_stops where route_id = p_route_id;

  insert into public.busflow_stops (
    route_id,
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

  return jsonb_build_object(
    'ok', true,
    'updated_at', v_new_updated_at
  );
end;
$$;
