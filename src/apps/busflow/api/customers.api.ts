import { Customer, CustomerListParams, CustomerListResult } from '../types';
import {
  createCodeError,
  escapeIlikeValue,
  getPostgrestCode,
  mapCustomerFromDb,
  mapCustomerInsert,
  requireActiveAccountId,
  supabase,
  type DbCustomer
} from './shared';

export async function getCustomers(params: CustomerListParams): Promise<CustomerListResult> {
  const accountId = requireActiveAccountId();
  const query = (params.query || '').trim();
  const from = Math.max(0, (params.page - 1) * params.pageSize);
  const to = from + params.pageSize - 1;
  const ilikeQuery = `%${escapeIlikeValue(query)}%`;
  let req = supabase
    .from('busflow_customers')
    .select('*', { count: 'exact' })
    .eq('account_id', accountId)
    .order('name')
    .range(from, to);

  if (query) {
    req = req.or(
      `name.ilike.${ilikeQuery},city.ilike.${ilikeQuery},street.ilike.${ilikeQuery},email.ilike.${ilikeQuery},phone.ilike.${ilikeQuery}`
    );
  }

  const { data, error, count } = await req;
  if (error) throw error;

  return {
    items: ((data || []) as DbCustomer[]).map(mapCustomerFromDb),
    total: count || 0,
    page: params.page,
    pageSize: params.pageSize
  };
}

export async function getCustomersForSuggestions(limit = 5000): Promise<Customer[]> {
  const result = await getCustomers({ page: 1, pageSize: limit, query: '' });
  return result.items;
}

export async function createCustomer(customer: Omit<Customer, 'id'>) {
  const accountId = requireActiveAccountId();
  const { data, error } = await supabase
    .from('busflow_customers')
    .insert({ ...mapCustomerInsert(customer), account_id: accountId })
    .select()
    .single();

  if (error) throw error;
  return mapCustomerFromDb(data as DbCustomer);
}

export async function updateCustomer(id: string, patch: Partial<Omit<Customer, 'id'>>) {
  const accountId = requireActiveAccountId();
  const updatePayload: Record<string, unknown> = {
    notes: patch.notes,
    phone: patch.phone,
    street: patch.street,
    postal_code: patch.postalCode,
    city: patch.city,
    country: patch.country,
    email: patch.email,
    contact_person: patch.contactPerson,
    metadata: patch.metadata || {}
  };
  if (typeof patch.name === 'string' && patch.name.trim()) {
    updatePayload.name = patch.name.trim();
  }

  const { data, error } = await supabase
    .from('busflow_customers')
    .update(updatePayload)
    .eq('account_id', accountId)
    .eq('id', id)
    .select()
    .single();

  if (error) throw error;
  return mapCustomerFromDb(data as DbCustomer);
}

export async function deleteCustomer(id: string) {
  const accountId = requireActiveAccountId();
  const { data, error } = await supabase
    .from('busflow_customers')
    .delete()
    .eq('account_id', accountId)
    .eq('id', id)
    .select('id')
    .maybeSingle();

  if (error) {
    if (getPostgrestCode(error) === '23503') {
      throw createCodeError('CUSTOMER_IN_USE', 'CUSTOMER_IN_USE');
    }
    throw error;
  }

  if (!data) {
    throw createCodeError('CUSTOMER_NOT_FOUND', 'CUSTOMER_NOT_FOUND');
  }
}
