
export interface Stop {
  id: string;
  location: string;
  arrivalTime: string;
  departureTime: string;
  actualArrivalTime?: string;
  actualDepartureTime?: string;
  boarding: number;
  leaving: number;
  currentTotal: number;
  lat?: number;
  lon?: number;
  notes?: string;
}

export interface Route {
  id: string;
  updatedAt?: string;
  name: string;
  date: string;
  busNumber: string;
  driverName: string;
  customerId?: string;
  customerName?: string;
  customerContactId?: string;
  customerContactName?: string;
  capacity: number;
  stops: Stop[];
  status: 'Aktiv' | 'Geplant' | 'Entwurf' | 'Archiviert';
  busTypeId?: string;
  workerId?: string;
  operationalNotes?: string;
  kmStartBetrieb?: string;
  kmStartCustomer?: string;
  kmEndCustomer?: string;
  kmEndBetrieb?: string;
  totalKm?: string;
  timeReturnBetrieb?: string;
  timeReturnCustomer?: string;
}

export type RouteAction =
  | { type: 'ADD_ROUTE'; payload: Route }
  | { type: 'UPDATE_ROUTE'; payload: Route }
  | { type: 'DELETE_ROUTE'; payload: string }
  | { type: 'SET_ROUTES'; payload: Route[] };

export interface BusType {
  id: string;
  name: string;
  capacity: number;
  notes?: string;
}

export interface Worker {
  id: string;
  name: string;
  role?: string;
}

export interface Customer {
  id: string;
  name: string;
  notes?: string;
  phone?: string;
  street?: string;
  postalCode?: string;
  city?: string;
  country?: string;
  email?: string;
  contactPerson?: string;
  metadata?: Record<string, string>;
}

export interface CustomerContact {
  id: string;
  customerId: string;
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

export interface CustomerImportRow {
  rowNumber: number;
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
}

export interface CustomerImportConflictCandidate {
  rowNumber: number;
  companyName: string;
  incomingContact: Omit<CustomerContact, 'id' | 'customerId'>;
  existingContact: CustomerContact;
  resolution?: 'import' | 'skip';
}

export interface CustomerImportError {
  rowNumber: number;
  name?: string;
  reason: string;
  raw?: Record<string, string>;
}

export interface CustomerImportResult {
  insertedCompanies: number;
  insertedContacts: number;
  updatedContacts: number;
  skipped: number;
  conflicts: number;
  errors: CustomerImportError[];
}

export interface CustomerImportPreview {
  rows: CustomerImportRow[];
  conflicts: CustomerImportConflictCandidate[];
  errors: CustomerImportError[];
}

export interface CustomerListParams {
  query?: string;
  page: number;
  pageSize: number;
}

export interface CustomerListResult {
  items: Customer[];
  total: number;
  page: number;
  pageSize: number;
}

export interface CustomerBulkDeleteFailure {
  id: string;
  name: string;
  reason: string;
  code?: string;
}

export interface CustomerBulkDeleteResult {
  requested: number;
  deleted: number;
  failed: CustomerBulkDeleteFailure[];
}

export interface MapDefaultView {
  address: string;
  lat: number;
  lon: number;
  zoom: number;
}
