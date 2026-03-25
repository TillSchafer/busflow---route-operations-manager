import { Customer, CustomerListParams, CustomerListResult } from '../types';
import {
  escapeIlikeValue,
  mapCustomerFromDb,
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

export async function getCustomersForSuggestions(limit = 1000): Promise<Customer[]> {
  const result = await getCustomers({ page: 1, pageSize: limit, query: '' });
  return result.items;
}

