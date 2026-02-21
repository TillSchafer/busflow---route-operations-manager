-- Phase 10: Connect routes to customers via FK (relational model)

-- 1) Add FK column on routes
alter table public.busflow_routes
add column if not exists customer_id uuid references public.busflow_customers(id);

-- 2) Backfill customer master data from legacy free-text route values
insert into public.busflow_customers (name)
select distinct btrim(r.customer_name) as name
from public.busflow_routes r
where r.customer_name is not null
  and btrim(r.customer_name) <> ''
on conflict (name) do nothing;

-- 3) Backfill customer_id on routes by matching legacy text name
update public.busflow_routes r
set customer_id = c.id
from public.busflow_customers c
where r.customer_id is null
  and r.customer_name is not null
  and btrim(r.customer_name) <> ''
  and btrim(r.customer_name) = c.name;

-- 4) Add index for route/customer joins and filters
create index if not exists idx_busflow_routes_customer_id on public.busflow_routes(customer_id);

-- 5) Keep legacy customer_name for compatibility during transition.

-- 6) Update atomic save RPC to persist customer_id (compat: still writes customer_name)
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
    customer_id = nullif(p_route->>'customerId', '')::uuid,
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
