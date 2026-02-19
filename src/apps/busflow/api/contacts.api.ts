import {
  CustomerContact,
  CustomerContactListItem,
  CustomerContactListParams,
  CustomerContactListResult
} from '../types';
import {
  createCodeError,
  escapeIlikeValue,
  getPostgrestCode,
  mapCustomerContactFromDb,
  mapCustomerContactListItemFromDb,
  normalizeCompanyName,
  requireActiveAccountId,
  supabase,
  type DbCustomerContact
} from './shared';

export async function getCustomerContactsList(params: CustomerContactListParams): Promise<CustomerContactListResult> {
  const accountId = requireActiveAccountId();
  const query = (params.query || '').trim();
  const from = Math.max(0, (params.page - 1) * params.pageSize);
  const to = from + params.pageSize - 1;
  const ilikeQuery = `%${escapeIlikeValue(query)}%`;
  let companyIdFilter = '';

  if (query) {
    const { data: matchingCompanies, error: matchingCompaniesError } = await supabase
      .from('busflow_customers')
      .select('id')
      .eq('account_id', accountId)
      .ilike('name', ilikeQuery);
    if (matchingCompaniesError) throw matchingCompaniesError;
    const companyIds = ((matchingCompanies || []) as Array<{ id: string }>)
      .map(item => item.id)
      .filter(Boolean);
    if (companyIds.length > 0) {
      companyIdFilter = `customer_id.in.(${companyIds.join(',')})`;
    }
  }

  let req = supabase
    .from('busflow_customer_contacts')
    .select(
      `
        *,
        busflow_customers!inner (id, name)
      `,
      { count: 'exact' }
    )
    .eq('account_id', accountId)
    .order('full_name', { ascending: true, nullsFirst: false })
    .range(from, to);

  if (query) {
    const filters = [
      `full_name.ilike.${ilikeQuery}`,
      `first_name.ilike.${ilikeQuery}`,
      `last_name.ilike.${ilikeQuery}`,
      `email.ilike.${ilikeQuery}`,
      `phone.ilike.${ilikeQuery}`,
      `city.ilike.${ilikeQuery}`,
      `street.ilike.${ilikeQuery}`
    ];
    if (companyIdFilter) filters.push(companyIdFilter);
    req = req.or(filters.join(','));
  }

  const { data, error, count } = await req;
  if (error) throw error;

  return {
    items: ((data || []) as DbCustomerContact[]).map(mapCustomerContactListItemFromDb),
    total: count || 0,
    page: params.page,
    pageSize: params.pageSize
  };
}

export async function getCustomerContacts(customerId: string): Promise<CustomerContact[]> {
  const accountId = requireActiveAccountId();
  const { data, error } = await supabase
    .from('busflow_customer_contacts')
    .select('*')
    .eq('account_id', accountId)
    .eq('customer_id', customerId)
    .order('full_name', { ascending: true });

  if (error) throw error;
  return ((data || []) as DbCustomerContact[]).map(mapCustomerContactFromDb);
}

export async function upsertCustomerContact(contact: Omit<CustomerContact, 'id'> & { id?: string }) {
  const accountId = requireActiveAccountId();
  const payload = {
    account_id: accountId,
    customer_id: contact.customerId,
    first_name: contact.firstName || null,
    last_name: contact.lastName || null,
    full_name: contact.fullName || [contact.firstName, contact.lastName].filter(Boolean).join(' ').trim() || null,
    email: contact.email || null,
    phone: contact.phone || null,
    street: contact.street || null,
    postal_code: contact.postalCode || null,
    city: contact.city || null,
    country: contact.country || null,
    notes: contact.notes || null,
    metadata: contact.metadata || {}
  };

  const query = contact.id
    ? supabase.from('busflow_customer_contacts').update(payload).eq('account_id', accountId).eq('id', contact.id)
    : supabase.from('busflow_customer_contacts').insert(payload);

  const { data, error } = await query.select().single();
  if (error) throw error;
  return mapCustomerContactFromDb(data as DbCustomerContact);
}

export async function createCustomerContactWithCompany(payload: {
  companyName: string;
  firstName?: string;
  lastName?: string;
  fullName?: string;
  email?: string;
  phone?: string;
  street?: string;
  postalCode?: string;
  city?: string;
  country?: string;
  notes?: string;
  metadata?: Record<string, string>;
}): Promise<CustomerContactListItem> {
  const accountId = requireActiveAccountId();
  const companyName = normalizeCompanyName(payload.companyName);
  if (!companyName) throw new Error('Firmenname ist erforderlich.');

  let companyId = '';
  const { data: existingCompany, error: existingCompanyError } = await supabase
    .from('busflow_customers')
    .select('id,name')
    .eq('account_id', accountId)
    .ilike('name', companyName)
    .maybeSingle();
  if (existingCompanyError) throw existingCompanyError;

  if (existingCompany?.id) {
    companyId = existingCompany.id;
  } else {
    const { data: createdCompany, error: createCompanyError } = await supabase
      .from('busflow_customers')
      .insert({ account_id: accountId, name: companyName })
      .select('id,name')
      .single();
    if (createCompanyError) throw createCompanyError;
    companyId = createdCompany.id;
  }

  const created = await upsertCustomerContact({
    customerId: companyId,
    firstName: payload.firstName,
    lastName: payload.lastName,
    fullName: payload.fullName,
    email: payload.email,
    phone: payload.phone,
    street: payload.street,
    postalCode: payload.postalCode,
    city: payload.city,
    country: payload.country,
    notes: payload.notes,
    metadata: payload.metadata
  });

  return {
    contactId: created.id,
    customerId: companyId,
    companyName,
    firstName: created.firstName,
    lastName: created.lastName,
    fullName: created.fullName,
    email: created.email,
    phone: created.phone,
    street: created.street,
    postalCode: created.postalCode,
    city: created.city,
    country: created.country,
    notes: created.notes,
    metadata: created.metadata
  };
}

export async function updateCustomerContact(
  contactId: string,
  patch: {
    companyName?: string;
    firstName?: string;
    lastName?: string;
    fullName?: string;
    email?: string;
    phone?: string;
    street?: string;
    postalCode?: string;
    city?: string;
    country?: string;
    notes?: string;
    metadata?: Record<string, string>;
  }
): Promise<CustomerContactListItem> {
  const accountId = requireActiveAccountId();
  const { data: existingContactData, error: existingContactError } = await supabase
    .from('busflow_customer_contacts')
    .select(`
      *,
      busflow_customers!inner (id, name)
    `)
    .eq('account_id', accountId)
    .eq('id', contactId)
    .single();
  if (existingContactError) throw existingContactError;
  const existing = mapCustomerContactListItemFromDb(existingContactData as DbCustomerContact);

  let customerId = existing.customerId;
  let companyName = existing.companyName;
  const requestedCompany = patch.companyName ? normalizeCompanyName(patch.companyName) : '';
  if (requestedCompany && requestedCompany.toLocaleLowerCase('de-DE') !== existing.companyName.toLocaleLowerCase('de-DE')) {
    const { data: existingCompany, error: existingCompanyError } = await supabase
      .from('busflow_customers')
      .select('id,name')
      .eq('account_id', accountId)
      .ilike('name', requestedCompany)
      .maybeSingle();
    if (existingCompanyError) throw existingCompanyError;

    if (existingCompany?.id) {
      customerId = existingCompany.id;
      companyName = existingCompany.name;
    } else {
      const { data: createdCompany, error: createCompanyError } = await supabase
        .from('busflow_customers')
        .insert({ account_id: accountId, name: requestedCompany })
        .select('id,name')
        .single();
      if (createCompanyError) throw createCompanyError;
      customerId = createdCompany.id;
      companyName = createdCompany.name;
    }
  }

  const updated = await upsertCustomerContact({
    id: contactId,
    customerId,
    firstName: patch.firstName,
    lastName: patch.lastName,
    fullName: patch.fullName,
    email: patch.email,
    phone: patch.phone,
    street: patch.street,
    postalCode: patch.postalCode,
    city: patch.city,
    country: patch.country,
    notes: patch.notes,
    metadata: patch.metadata
  });

  return {
    contactId: updated.id,
    customerId,
    companyName,
    firstName: updated.firstName,
    lastName: updated.lastName,
    fullName: updated.fullName,
    email: updated.email,
    phone: updated.phone,
    street: updated.street,
    postalCode: updated.postalCode,
    city: updated.city,
    country: updated.country,
    notes: updated.notes,
    metadata: updated.metadata
  };
}

export async function deleteCustomerContact(contactId: string) {
  const accountId = requireActiveAccountId();
  const { error } = await supabase
    .from('busflow_customer_contacts')
    .delete()
    .eq('account_id', accountId)
    .eq('id', contactId);

  if (!error) return;

  if (getPostgrestCode(error) === '23503') {
    throw createCodeError('CONTACT_IN_USE', 'CONTACT_IN_USE');
  }

  throw error;
}
