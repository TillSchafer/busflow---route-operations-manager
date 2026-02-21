-- Phase 12: Backend cleanup (safe, incremental, idempotent)
-- Purpose:
-- - Canonicalize auth trigger + signup defaults
-- - Canonicalize atomic route save RPC (customer FK aware)
-- - Keep compatibility with legacy customer_name until explicit cleanup phase
-- - Add metadata checks for key RLS policies

-- Ensure route/customer lookup index exists
create index if not exists idx_busflow_routes_customer_id on public.busflow_routes(customer_id);

-- Canonical signup trigger function
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, email, full_name, avatar_url, global_role)
  values (
    new.id,
    new.email,
    new.raw_user_meta_data->>'full_name',
    new.raw_user_meta_data->>'avatar_url',
    'USER'
  )
  on conflict (id) do nothing;

  insert into public.app_permissions (user_id, app_id, role)
  values (new.id, 'busflow', 'DISPATCH')
  on conflict (user_id, app_id) do nothing;

  return new;
end;
$$ language plpgsql security definer;

-- Ensure trigger binding is singular and explicit
-- (recreate to avoid drift from earlier migrations/scripts)
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- Canonical atomic route save RPC
-- Notes:
-- - Uses optimistic concurrency via updated_at
-- - Writes both customer_id and customer_name for one-release compatibility
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

-- Safety checks: verify key RLS policies exist (non-breaking warnings)
do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'profiles'
      and policyname = 'Admins can update profiles.'
  ) then
    raise warning 'Missing expected policy: public.profiles -> Admins can update profiles.';
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'app_permissions'
      and policyname = 'Admins can insert permissions.'
  ) then
    raise warning 'Missing expected policy: public.app_permissions -> Admins can insert permissions.';
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'app_permissions'
      and policyname = 'Admins can update permissions.'
  ) then
    raise warning 'Missing expected policy: public.app_permissions -> Admins can update permissions.';
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'app_permissions'
      and policyname = 'Admins can delete permissions.'
  ) then
    raise warning 'Missing expected policy: public.app_permissions -> Admins can delete permissions.';
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'busflow_customers'
      and policyname = 'Dispatch+ can manage customers'
  ) then
    raise warning 'Missing expected policy: public.busflow_customers -> Dispatch+ can manage customers';
  end if;
end
$$;
