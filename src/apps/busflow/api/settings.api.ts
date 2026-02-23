import { BusType, MapDefaultView, Worker } from '../types';
import { createCodeError, getPostgrestCode, requireActiveAccountId, supabase, toMapDefaultView } from './shared';

export async function getBusTypes() {
  const accountId = requireActiveAccountId();
  const { data, error } = await supabase
    .from('busflow_bus_types')
    .select('*')
    .eq('account_id', accountId)
    .order('name');

  if (error) throw error;
  return data as BusType[];
}

export async function createBusType(busType: Omit<BusType, 'id'>) {
  const accountId = requireActiveAccountId();
  const { data, error } = await supabase
    .from('busflow_bus_types')
    .insert({
      account_id: accountId,
      name: busType.name,
      capacity: busType.capacity
    })
    .select()
    .single();

  if (error) throw error;
  return data as BusType;
}

export async function deleteBusType(id: string) {
  const accountId = requireActiveAccountId();
  const { data, error } = await supabase
    .from('busflow_bus_types')
    .delete()
    .eq('account_id', accountId)
    .eq('id', id)
    .select('id')
    .maybeSingle();

  if (error) {
    if (getPostgrestCode(error) === '23503') {
      throw createCodeError('BUS_TYPE_IN_USE', 'BUS_TYPE_IN_USE');
    }
    throw error;
  }

  if (!data) {
    throw createCodeError('BUS_TYPE_NOT_FOUND', 'BUS_TYPE_NOT_FOUND');
  }
}

export async function getWorkers() {
  const accountId = requireActiveAccountId();
  const { data, error } = await supabase
    .from('busflow_workers')
    .select('*')
    .eq('account_id', accountId)
    .order('name');

  if (error) throw error;
  return data as Worker[];
}

export async function createWorker(worker: Omit<Worker, 'id'>) {
  const accountId = requireActiveAccountId();
  const { data, error } = await supabase
    .from('busflow_workers')
    .insert({
      account_id: accountId,
      name: worker.name,
      role: worker.role
    })
    .select()
    .single();

  if (error) throw error;
  return data as Worker;
}

export async function deleteWorker(id: string) {
  const accountId = requireActiveAccountId();
  const { data, error } = await supabase
    .from('busflow_workers')
    .delete()
    .eq('account_id', accountId)
    .eq('id', id)
    .select('id')
    .maybeSingle();

  if (error) {
    if (getPostgrestCode(error) === '23503') {
      throw createCodeError('WORKER_IN_USE', 'WORKER_IN_USE');
    }
    throw error;
  }

  if (!data) {
    throw createCodeError('WORKER_NOT_FOUND', 'WORKER_NOT_FOUND');
  }
}

export async function getMapDefaultView(): Promise<MapDefaultView | null> {
  const accountId = requireActiveAccountId();
  const { data, error } = await supabase
    .from('busflow_app_settings')
    .select('value')
    .eq('account_id', accountId)
    .eq('key', 'map_default')
    .maybeSingle();

  if (error) throw error;
  if (!data?.value) return null;

  return toMapDefaultView(data.value as Partial<MapDefaultView>);
}

export async function upsertMapDefaultView(view: MapDefaultView) {
  const accountId = requireActiveAccountId();
  const { error } = await supabase
    .from('busflow_app_settings')
    .upsert(
      {
        account_id: accountId,
        key: 'map_default',
        value: {
          address: view.address,
          lat: view.lat,
          lon: view.lon,
          zoom: view.zoom
        }
      },
      { onConflict: 'account_id,key' }
    );

  if (error) throw error;
}
