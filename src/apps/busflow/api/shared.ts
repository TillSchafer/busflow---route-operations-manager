import { supabase } from '../../../shared/lib/supabase';
import {
  Route as RouteType,
  Stop,
  Customer,
  CustomerContact,
  CustomerContactListItem,
  MapDefaultView
} from '../types';

export { supabase };

export type DbStop = {
  id: string;
  location: string | null;
  arrival_time: string | null;
  departure_time: string | null;
  actual_arrival_time?: string | null;
  actual_departure_time?: string | null;
  boarding: number | string | null;
  leaving: number | string | null;
  current_total: number | string | null;
  lat?: number | string | null;
  lon?: number | string | null;
  notes?: string | null;
  sequence_order?: number | null;
};

export type DbCustomer = {
  id: string;
  name: string;
  notes?: string | null;
  phone?: string | null;
  street?: string | null;
  postal_code?: string | null;
  city?: string | null;
  country?: string | null;
  email?: string | null;
  contact_person?: string | null;
  metadata?: Record<string, string> | null;
};

export type DbCustomerContact = {
  id: string;
  customer_id?: string | null;
  first_name?: string | null;
  last_name?: string | null;
  full_name?: string | null;
  email?: string | null;
  phone?: string | null;
  street?: string | null;
  postal_code?: string | null;
  city?: string | null;
  country?: string | null;
  notes?: string | null;
  metadata?: Record<string, string> | null;
  busflow_customers?: { id: string; name: string } | { id: string; name: string }[] | null;
};

export type DbRoute = {
  id: string;
  updated_at?: string | null;
  name: string | null;
  date: string | null;
  bus_number?: string | null;
  driver_name?: string | null;
  customer_id?: string | null;
  customer_contact_id?: string | null;
  customer_name?: string | null;
  capacity?: number | string | null;
  busflow_stops?: DbStop[];
  status?: string | null;
  bus_type_id?: string | null;
  worker_id?: string | null;
  operational_notes?: string | null;
  km_start_betrieb?: string | null;
  km_start_customer?: string | null;
  km_end_customer?: string | null;
  km_end_betrieb?: string | null;
  total_km?: string | null;
  time_return_betrieb?: string | null;
  time_return_customer?: string | null;
  busflow_customers?: DbCustomer | DbCustomer[] | null;
  busflow_customer_contacts?: DbCustomerContact | DbCustomerContact[] | null;
};

export type ErrorWithCode = Error & { code?: string; latestUpdatedAt?: string };
export type PostgrestLikeError = { code?: string };

export const getErrorMessage = (error: unknown, fallback: string): string =>
  error instanceof Error && error.message ? error.message : fallback;

export const getPostgrestCode = (error: unknown): string | undefined => {
  if (!error || typeof error !== 'object') return undefined;
  return (error as PostgrestLikeError).code;
};

export const createCodeError = (message: string, code: string, extra?: Partial<ErrorWithCode>): ErrorWithCode => {
  const err = new Error(message) as ErrorWithCode;
  err.code = code;
  if (extra?.latestUpdatedAt) err.latestUpdatedAt = extra.latestUpdatedAt;
  return err;
};

export const mapStopFromDb = (stop: DbStop): Stop => ({
  id: stop.id,
  location: stop.location || '',
  arrivalTime: stop.arrival_time || '',
  departureTime: stop.departure_time || '',
  actualArrivalTime: stop.actual_arrival_time || '',
  actualDepartureTime: stop.actual_departure_time || '',
  boarding: Number(stop.boarding) || 0,
  leaving: Number(stop.leaving) || 0,
  currentTotal: Number(stop.current_total) || 0,
  lat: typeof stop.lat === 'number' ? stop.lat : (stop.lat != null ? Number(stop.lat) : undefined),
  lon: typeof stop.lon === 'number' ? stop.lon : (stop.lon != null ? Number(stop.lon) : undefined),
  notes: stop.notes || undefined
});

export const mapRouteFromDb = (route: DbRoute): RouteType => {
  const linkedCustomer = Array.isArray(route.busflow_customers)
    ? route.busflow_customers[0]
    : route.busflow_customers;

  const linkedContact = Array.isArray(route.busflow_customer_contacts)
    ? route.busflow_customer_contacts[0]
    : route.busflow_customer_contacts;

  return {
    id: route.id,
    updatedAt: route.updated_at || undefined,
    name: route.name || '',
    date: route.date || '',
    busNumber: route.bus_number || '',
    driverName: route.driver_name || '',
    customerId: route.customer_id || linkedCustomer?.id || '',
    customerName: linkedCustomer?.name || route.customer_name || '',
    customerContactId: route.customer_contact_id || linkedContact?.id || undefined,
    customerContactName: linkedContact?.full_name || undefined,
    capacity: Number(route.capacity) || 0,
    stops: (route.busflow_stops || [])
      .sort((a, b) => (a.sequence_order || 0) - (b.sequence_order || 0))
      .map(mapStopFromDb),
    status: (route.status || 'Entwurf') as RouteType['status'],
    busTypeId: route.bus_type_id || undefined,
    workerId: route.worker_id || undefined,
    operationalNotes: route.operational_notes || '',
    kmStartBetrieb: route.km_start_betrieb || '',
    kmStartCustomer: route.km_start_customer || '',
    kmEndCustomer: route.km_end_customer || '',
    kmEndBetrieb: route.km_end_betrieb || '',
    totalKm: route.total_km || '',
    timeReturnBetrieb: route.time_return_betrieb || '',
    timeReturnCustomer: route.time_return_customer || ''
  };
};

export const mapCustomerFromDb = (customer: DbCustomer): Customer => ({
  id: customer.id,
  name: customer.name,
  notes: customer.notes || undefined,
  phone: customer.phone || undefined,
  street: customer.street || undefined,
  postalCode: customer.postal_code || undefined,
  city: customer.city || undefined,
  country: customer.country || undefined,
  email: customer.email || undefined,
  contactPerson: customer.contact_person || undefined,
  metadata: customer.metadata || undefined
});

export const mapCustomerInsert = (customer: Omit<Customer, 'id'>) => ({
  name: customer.name,
  notes: customer.notes,
  phone: customer.phone,
  street: customer.street,
  postal_code: customer.postalCode,
  city: customer.city,
  country: customer.country,
  email: customer.email,
  contact_person: customer.contactPerson,
  metadata: customer.metadata || {}
});

export const mapCustomerContactFromDb = (contact: DbCustomerContact): CustomerContact => ({
  id: contact.id,
  customerId: contact.customer_id || '',
  firstName: contact.first_name || undefined,
  lastName: contact.last_name || undefined,
  fullName: contact.full_name || undefined,
  email: contact.email || undefined,
  phone: contact.phone || undefined,
  street: contact.street || undefined,
  postalCode: contact.postal_code || undefined,
  city: contact.city || undefined,
  country: contact.country || undefined,
  notes: contact.notes || undefined,
  metadata: contact.metadata || undefined
});

export const mapCustomerContactListItemFromDb = (contact: DbCustomerContact): CustomerContactListItem => {
  const company = Array.isArray(contact.busflow_customers)
    ? contact.busflow_customers[0]
    : contact.busflow_customers;
  return {
    contactId: contact.id,
    customerId: contact.customer_id || company?.id || '',
    companyName: company?.name || '',
    firstName: contact.first_name || undefined,
    lastName: contact.last_name || undefined,
    fullName: contact.full_name || undefined,
    email: contact.email || undefined,
    phone: contact.phone || undefined,
    street: contact.street || undefined,
    postalCode: contact.postal_code || undefined,
    city: contact.city || undefined,
    country: contact.country || undefined,
    notes: contact.notes || undefined,
    metadata: contact.metadata || undefined
  };
};

export const escapeIlikeValue = (value: string) =>
  value.replace(/[%_]/g, s => `\\${s}`).replace(/,/g, '\\,');

export const normalizeCompanyName = (value: string) => value.trim();

let activeAccountId: string | null = null;

export const setActiveAccountId = (accountId: string | null) => {
  activeAccountId = accountId;
};

export const requireActiveAccountId = () => {
  if (!activeAccountId) {
    throw createCodeError('ACCOUNT_REQUIRED', 'ACCOUNT_REQUIRED');
  }
  return activeAccountId;
};

export const toMapDefaultView = (value: Partial<MapDefaultView>): MapDefaultView | null => {
  if (typeof value.lat !== 'number' || typeof value.lon !== 'number') return null;
  return {
    address: typeof value.address === 'string' ? value.address : '',
    lat: value.lat,
    lon: value.lon,
    zoom: typeof value.zoom === 'number' ? value.zoom : 6
  };
};
