import { Route as RouteType } from '../types';
import { createCodeError, mapRouteFromDb, requireActiveAccountId, supabase, type DbRoute } from './shared';

export async function getRoutes() {
  const accountId = requireActiveAccountId();
  const { data, error } = await supabase
    .from('busflow_routes')
    .select(`
      *,
      busflow_stops (*),
      busflow_customers!busflow_routes_customer_id_fkey (id, name, notes),
      busflow_customer_contacts!busflow_routes_customer_contact_id_fkey (id, full_name)
    `)
    .eq('account_id', accountId)
    .order('date', { ascending: true });

  if (error) throw error;
  return ((data || []) as DbRoute[]).map(mapRouteFromDb);
}

export async function createRoute(route: Omit<RouteType, 'id'>) {
  const accountId = requireActiveAccountId();
  if (route.status !== 'Entwurf' && !route.customerId) {
    throw createCodeError('CUSTOMER_REQUIRED', 'CUSTOMER_REQUIRED');
  }

  const { data, error } = await supabase
    .from('busflow_routes')
    .insert({
      account_id: accountId,
      name: route.name,
      date: route.date,
      status: route.status,
      bus_number: route.busNumber,
      driver_name: route.driverName,
      customer_id: route.customerId || null,
      customer_contact_id: route.customerContactId || null,
      operational_notes: route.operationalNotes,
      capacity: route.capacity,
      bus_type_id: route.busTypeId,
      worker_id: route.workerId,
      km_start_betrieb: route.kmStartBetrieb,
      km_start_customer: route.kmStartCustomer,
      km_end_customer: route.kmEndCustomer,
      km_end_betrieb: route.kmEndBetrieb,
      total_km: route.totalKm,
      time_return_betrieb: route.timeReturnBetrieb,
      time_return_customer: route.timeReturnCustomer
    })
    .select()
    .single();

  if (error) throw error;
  return mapRouteFromDb({ ...data, busflow_stops: [] });
}

export async function saveRouteWithStops(route: RouteType, expectedUpdatedAt?: string) {
  const accountId = requireActiveAccountId();

  const { data, error } = await supabase.rpc('save_busflow_route_with_stops', {
    p_account_id: accountId,
    p_route_id: route.id,
    p_expected_updated_at: expectedUpdatedAt || null,
    p_route: {
      name: route.name,
      date: route.date,
      status: route.status,
      busNumber: route.busNumber,
      driverName: route.driverName,
      customerId: route.customerId,
      customerContactId: route.customerContactId,
      operationalNotes: route.operationalNotes,
      capacity: route.capacity,
      busTypeId: route.busTypeId,
      workerId: route.workerId,
      kmStartBetrieb: route.kmStartBetrieb,
      kmStartCustomer: route.kmStartCustomer,
      kmEndCustomer: route.kmEndCustomer,
      kmEndBetrieb: route.kmEndBetrieb,
      totalKm: route.totalKm,
      timeReturnBetrieb: route.timeReturnBetrieb,
      timeReturnCustomer: route.timeReturnCustomer
    },
    p_stops: route.stops
  });

  if (error) throw error;

  if (data?.ok === false && data?.code === 'ROUTE_CONFLICT') {
    throw createCodeError('ROUTE_CONFLICT', 'ROUTE_CONFLICT', { latestUpdatedAt: data.updated_at });
  }
  if (data?.ok === false && data?.code === 'ROUTE_NOT_FOUND') {
    throw createCodeError('ROUTE_NOT_FOUND', 'ROUTE_NOT_FOUND');
  }
  if (data?.ok === false && data?.code === 'CUSTOMER_REQUIRED') {
    throw createCodeError('CUSTOMER_REQUIRED', 'CUSTOMER_REQUIRED');
  }
  if (data?.ok === false && data?.code === 'CUSTOMER_CONTACT_MISMATCH') {
    throw createCodeError('CUSTOMER_CONTACT_MISMATCH', 'CUSTOMER_CONTACT_MISMATCH');
  }
  if (data?.ok === false && data?.code === 'CONTACT_NOT_FOUND') {
    throw createCodeError('CONTACT_NOT_FOUND', 'CONTACT_NOT_FOUND');
  }
  if (data?.ok === false && data?.code === 'ACCOUNT_REQUIRED') {
    throw createCodeError('ACCOUNT_REQUIRED', 'ACCOUNT_REQUIRED');
  }
  if (data?.ok === false && data?.code === 'ACCOUNT_ACCESS_DENIED') {
    throw createCodeError('ACCOUNT_ACCESS_DENIED', 'ACCOUNT_ACCESS_DENIED');
  }
  if (data?.ok === false && data?.code === 'ACCOUNT_MISMATCH') {
    throw createCodeError('ACCOUNT_MISMATCH', 'ACCOUNT_MISMATCH');
  }
  if (data?.ok === false && data?.code === 'WORKER_NOT_FOUND') {
    throw createCodeError('WORKER_NOT_FOUND', 'WORKER_NOT_FOUND');
  }
  if (data?.ok === false && data?.code === 'WORKER_ACCOUNT_MISMATCH') {
    throw createCodeError('WORKER_ACCOUNT_MISMATCH', 'WORKER_ACCOUNT_MISMATCH');
  }
  if (data?.ok === false && data?.code === 'BUS_TYPE_NOT_FOUND') {
    throw createCodeError('BUS_TYPE_NOT_FOUND', 'BUS_TYPE_NOT_FOUND');
  }
  if (data?.ok === false && data?.code === 'BUS_TYPE_ACCOUNT_MISMATCH') {
    throw createCodeError('BUS_TYPE_ACCOUNT_MISMATCH', 'BUS_TYPE_ACCOUNT_MISMATCH');
  }

  return data;
}

export async function deleteRoute(id: string) {
  const accountId = requireActiveAccountId();
  const { data, error } = await supabase
    .from('busflow_routes')
    .delete()
    .eq('account_id', accountId)
    .eq('id', id)
    .select('id')
    .maybeSingle();

  if (error) throw error;
  if (!data) {
    throw createCodeError('ROUTE_NOT_FOUND', 'ROUTE_NOT_FOUND');
  }
}
