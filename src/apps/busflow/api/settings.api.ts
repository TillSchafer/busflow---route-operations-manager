import { AccountMember, BusType, MapDefaultView, MapPageSettings } from '../types';
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

/** Returns all active members of the current account, sorted by name. */
export async function getAccountMembers(): Promise<AccountMember[]> {
  const accountId = requireActiveAccountId();
  const { data, error } = await supabase
    .from('account_memberships')
    .select('user_id, role, profiles!inner(id, full_name, email)')
    .eq('account_id', accountId)
    .eq('status', 'ACTIVE');

  if (error) throw error;

  return ((data ?? []) as unknown as Array<{
    user_id: string;
    role: string;
    profiles: { id: string; full_name: string | null; email: string };
  }>)
    .map(row => ({
      id: row.profiles.id,
      fullName: row.profiles.full_name?.trim() || row.profiles.email,
      email: row.profiles.email,
      role: row.role,
    }))
    .sort((a, b) => a.fullName.localeCompare(b.fullName));
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

// ── Shared helper: robust write across mixed PostgREST/runtime behaviors ──────
// 1) Try UPSERT first (POST) to avoid PATCH-only failures seen in some envs.
// 2) Fall back to UPDATE-then-INSERT for environments where on_conflict parsing
//    is unstable with column names like "key".
async function writeAppSetting(accountId: string, settingKey: string, value: unknown): Promise<void> {
  const payload = { account_id: accountId, key: settingKey, value };

  const { error: upsertErr } = await supabase
    .from('busflow_app_settings')
    .upsert(payload, { onConflict: 'account_id,key' });

  if (!upsertErr) return;

  const { data, error: updateErr } = await supabase
    .from('busflow_app_settings')
    .update({ value })
    .eq('account_id', accountId)
    .eq('key', settingKey)
    .select('account_id')
    .maybeSingle();

  if (updateErr) throw updateErr;

  if (!data) {
    const { error: insertErr } = await supabase
      .from('busflow_app_settings')
      .insert(payload);
    if (insertErr) throw insertErr;
  }
}

export async function upsertMapDefaultView(view: MapDefaultView) {
  const accountId = requireActiveAccountId();
  await writeAppSetting(accountId, 'map_default', {
    address: view.address, lat: view.lat, lon: view.lon, zoom: view.zoom,
  });
}

export async function getMapPageDefaultView(): Promise<MapDefaultView | null> {
  // Unify with shared route/planner default-view setting.
  const sharedDefault = await getMapDefaultView();
  if (sharedDefault) return sharedDefault;

  // Backward compatibility for previously persisted map-page-specific key.
  const accountId = requireActiveAccountId();
  const { data, error } = await supabase
    .from('busflow_app_settings')
    .select('value')
    .eq('account_id', accountId)
    .eq('key', 'map_page_default')
    .maybeSingle();

  if (error) throw error;
  if (!data?.value) return null;
  return toMapDefaultView(data.value as Partial<MapDefaultView>);
}

export async function upsertMapPageDefaultView(view: MapDefaultView) {
  // Persist under the shared key so Map Screen and planner use the same default view.
  await upsertMapDefaultView(view);
}

export async function getMapPageSettings(): Promise<MapPageSettings | null> {
  const accountId = requireActiveAccountId();
  const { data, error } = await supabase
    .from('busflow_app_settings')
    .select('value')
    .eq('account_id', accountId)
    .eq('key', 'map_page_settings')
    .maybeSingle();

  if (error) throw error;
  if (!data?.value) return null;
  return data.value as MapPageSettings;
}

export async function upsertMapPageSettings(settings: MapPageSettings) {
  const accountId = requireActiveAccountId();
  await writeAppSetting(accountId, 'map_page_settings', settings);
}
