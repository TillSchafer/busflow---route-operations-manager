import { supabase } from '../../shared/lib/supabase';
import {
    Route as RouteType,
    Stop,
    BusType,
    Worker,
    Customer,
    CustomerContact,
    CustomerImportConflictCandidate,
    CustomerImportPreview,
    MapDefaultView,
    CustomerImportResult,
    CustomerImportRow,
    CustomerListParams,
    CustomerListResult
} from './types';

type DbStop = {
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

type DbCustomer = {
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

type DbCustomerContact = {
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
};

type DbRoute = {
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

const mapStopFromDb = (stop: DbStop): Stop => ({
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

const mapRouteFromDb = (route: DbRoute): RouteType => {
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
    customerId: route.customer_id || linkedCustomer?.id || undefined,
    customerName: route.customer_name || linkedCustomer?.name || '',
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

const mapCustomerFromDb = (customer: DbCustomer): Customer => ({
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

const mapCustomerInsert = (customer: Omit<Customer, 'id'>) => ({
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

const mapCustomerContactFromDb = (contact: DbCustomerContact): CustomerContact => ({
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

const escapeIlikeValue = (value: string) =>
    value.replace(/[%_]/g, s => `\\${s}`).replace(/,/g, '\\,');

export const BusFlowApi = {
    // --- Routes ---
    async getRoutes() {
        const { data, error } = await supabase
            .from('busflow_routes')
            .select(`
        *,
        busflow_stops (*),
        busflow_customers!busflow_routes_customer_id_fkey (id, name, notes),
        busflow_customer_contacts!busflow_routes_customer_contact_id_fkey (id, full_name)
      `)
            .order('date', { ascending: true });

        if (error) throw error;

        return ((data || []) as DbRoute[]).map(mapRouteFromDb);
    },

    async createRoute(route: Omit<RouteType, 'id'>) {
        const { data, error } = await supabase
            .from('busflow_routes')
            .insert({
                name: route.name,
                date: route.date,
                status: route.status,
                bus_number: route.busNumber,
                driver_name: route.driverName,
                customer_id: route.customerId || null,
                customer_contact_id: route.customerContactId || null,
                customer_name: route.customerName,
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
    },

    async saveRouteWithStops(route: RouteType, expectedUpdatedAt?: string) {
        const { data, error } = await supabase.rpc('save_busflow_route_with_stops', {
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
                customerName: route.customerName,
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
            const conflictError: any = new Error('ROUTE_CONFLICT');
            conflictError.code = 'ROUTE_CONFLICT';
            conflictError.latestUpdatedAt = data.updated_at;
            throw conflictError;
        }

        if (data?.ok === false && data?.code === 'ROUTE_NOT_FOUND') {
            const notFoundError: any = new Error('ROUTE_NOT_FOUND');
            notFoundError.code = 'ROUTE_NOT_FOUND';
            throw notFoundError;
        }

        return data;
    },

    async deleteRoute(id: string) {
        const { error } = await supabase
            .from('busflow_routes')
            .delete()
            .eq('id', id);

        if (error) throw error;
    },

    // --- Bus Types ---
    async getBusTypes() {
        const { data, error } = await supabase
            .from('busflow_bus_types')
            .select('*')
            .order('name');

        if (error) throw error;
        return data as BusType[];
    },

    async createBusType(busType: Omit<BusType, 'id'>) {
        const { data, error } = await supabase
            .from('busflow_bus_types')
            .insert({
                name: busType.name,
                capacity: busType.capacity
            })
            .select()
            .single();

        if (error) throw error;
        return data as BusType;
    },

    async deleteBusType(id: string) {
        const { error } = await supabase
            .from('busflow_bus_types')
            .delete()
            .eq('id', id);

        if (error) throw error;
    },

    // --- Workers (Drivers) ---
    async getWorkers() {
        const { data, error } = await supabase
            .from('busflow_workers')
            .select('*')
            .order('name');

        if (error) throw error;
        return data as Worker[];
    },

    async createWorker(worker: Omit<Worker, 'id'>) {
        const { data, error } = await supabase
            .from('busflow_workers')
            .insert({
                name: worker.name,
                role: worker.role
            })
            .select()
            .single();

        if (error) throw error;
        return data as Worker;
    },

    async deleteWorker(id: string) {
        const { error } = await supabase
            .from('busflow_workers')
            .delete()
            .eq('id', id);

        if (error) throw error;
    },

    // --- Customers ---
    async getCustomers(params: CustomerListParams): Promise<CustomerListResult> {
        const query = (params.query || '').trim();
        const from = Math.max(0, (params.page - 1) * params.pageSize);
        const to = from + params.pageSize - 1;
        const ilikeQuery = `%${escapeIlikeValue(query)}%`;
        let req = supabase
            .from('busflow_customers')
            .select('*', { count: 'exact' })
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
    },

    async getCustomersForSuggestions(limit = 5000): Promise<Customer[]> {
        const result = await this.getCustomers({ page: 1, pageSize: limit, query: '' });
        return result.items;
    },

    async getCustomerContacts(customerId: string): Promise<CustomerContact[]> {
        const { data, error } = await supabase
            .from('busflow_customer_contacts')
            .select('*')
            .eq('customer_id', customerId)
            .order('full_name', { ascending: true });

        if (error) throw error;
        return ((data || []) as DbCustomerContact[]).map(mapCustomerContactFromDb);
    },

    async createCustomer(customer: Omit<Customer, 'id'>) {
        const { data, error } = await supabase
            .from('busflow_customers')
            .insert(mapCustomerInsert(customer))
            .select()
            .single();

        if (error) throw error;
        return mapCustomerFromDb(data as DbCustomer);
    },

    async upsertCustomerContact(contact: Omit<CustomerContact, 'id'> & { id?: string }) {
        const payload = {
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
            ? supabase.from('busflow_customer_contacts').update(payload).eq('id', contact.id)
            : supabase.from('busflow_customer_contacts').insert(payload);

        const { data, error } = await query.select().single();
        if (error) throw error;
        return mapCustomerContactFromDb(data as DbCustomerContact);
    },

    async updateCustomer(id: string, patch: Partial<Omit<Customer, 'id'>>) {
        const updatePayload = mapCustomerInsert({
            name: patch.name || '',
            notes: patch.notes,
            phone: patch.phone,
            street: patch.street,
            postalCode: patch.postalCode,
            city: patch.city,
            country: patch.country,
            email: patch.email,
            contactPerson: patch.contactPerson,
            metadata: patch.metadata
        });

        if (!patch.name) delete (updatePayload as any).name;

        const { data, error } = await supabase
            .from('busflow_customers')
            .update(updatePayload)
            .eq('id', id)
            .select()
            .single();

        if (error) throw error;
        return mapCustomerFromDb(data as DbCustomer);
    },

    async importCustomersPreview(rows: CustomerImportRow[]): Promise<CustomerImportPreview> {
        const errors: CustomerImportPreview['errors'] = [];
        const conflicts: CustomerImportConflictCandidate[] = [];
        const validRows = rows.filter(row => {
            if (!row.companyName?.trim()) {
                errors.push({ rowNumber: row.rowNumber, reason: 'Firma/Kunde fehlt.', name: row.fullName || undefined });
                return false;
            }
            return true;
        });

        if (validRows.length === 0) {
            return { rows: [], conflicts: [], errors };
        }

        const { data: companies, error: companiesError } = await supabase
            .from('busflow_customers')
            .select('id,name');
        if (companiesError) throw companiesError;

        const companyMap = new Map<string, { id: string; name: string }>();
        ((companies || []) as Array<{ id: string; name: string }>).forEach(company => {
            companyMap.set(company.name.trim().toLocaleLowerCase('de-DE'), company);
        });

        const existingCompanyIds = Array.from(
            new Set(
                validRows
                    .map(r => companyMap.get(r.companyName.trim().toLocaleLowerCase('de-DE'))?.id)
                    .filter((v): v is string => Boolean(v))
            )
        );

        let contactsByCompany = new Map<string, CustomerContact[]>();
        if (existingCompanyIds.length > 0) {
            const { data: contacts, error: contactsError } = await supabase
                .from('busflow_customer_contacts')
                .select('*')
                .in('customer_id', existingCompanyIds);
            if (contactsError) throw contactsError;

            for (const contact of ((contacts || []) as DbCustomerContact[]).map(mapCustomerContactFromDb)) {
                const arr = contactsByCompany.get(contact.customerId) || [];
                arr.push(contact);
                contactsByCompany.set(contact.customerId, arr);
            }
        }

        for (const row of validRows) {
            const company = companyMap.get(row.companyName.trim().toLocaleLowerCase('de-DE'));
            if (!company) continue;

            const contacts = contactsByCompany.get(company.id) || [];
            const email = (row.email || '').trim().toLocaleLowerCase('de-DE');
            const fullName = (row.fullName || '').trim().toLocaleLowerCase('de-DE');
            const phone = (row.phone || '').trim();

            const existing = contacts.find(contact => {
                const contactEmail = (contact.email || '').trim().toLocaleLowerCase('de-DE');
                if (email) return contactEmail && contactEmail === email;
                return (contact.fullName || '').trim().toLocaleLowerCase('de-DE') === fullName
                    && (contact.phone || '').trim() === phone
                    && Boolean(fullName || phone);
            });

            if (existing) {
                conflicts.push({
                    rowNumber: row.rowNumber,
                    companyName: row.companyName,
                    incomingContact: {
                        firstName: row.firstName,
                        lastName: row.lastName,
                        fullName: row.fullName,
                        email: row.email,
                        phone: row.phone,
                        street: row.street,
                        postalCode: row.postalCode,
                        city: row.city,
                        country: row.country,
                        notes: row.notes,
                        metadata: row.metadata
                    },
                    existingContact: existing
                });
            }
        }

        return { rows: validRows, conflicts, errors };
    },

    async commitCustomerImport(
        preview: CustomerImportPreview,
        resolutions: Record<number, 'import' | 'skip'>,
        onProgress?: (progress: { current: number; total: number }) => void
    ): Promise<CustomerImportResult> {
        let insertedCompanies = 0;
        let insertedContacts = 0;
        let updatedContacts = 0;
        let skipped = 0;
        const errors: CustomerImportResult['errors'] = [...preview.errors];

        const { data: existingCompaniesData, error: companiesError } = await supabase
            .from('busflow_customers')
            .select('id,name');
        if (companiesError) throw companiesError;

        const companyMap = new Map<string, { id: string; name: string }>();
        ((existingCompaniesData || []) as Array<{ id: string; name: string }>).forEach(company => {
            companyMap.set(company.name.trim().toLocaleLowerCase('de-DE'), company);
        });

        const conflictByRow = new Map<number, CustomerImportConflictCandidate>();
        preview.conflicts.forEach(conflict => conflictByRow.set(conflict.rowNumber, conflict));
        let processed = 0;
        const total = preview.rows.length;
        onProgress?.({ current: 0, total });

        for (const row of preview.rows) {
            const companyKey = row.companyName.trim().toLocaleLowerCase('de-DE');
            let company = companyMap.get(companyKey);
            if (!company) {
                const { data: createdCompany, error: createCompanyError } = await supabase
                    .from('busflow_customers')
                    .insert({ name: row.companyName.trim() })
                    .select('id,name')
                    .single();
                if (createCompanyError) {
                    errors.push({ rowNumber: row.rowNumber, name: row.companyName, reason: createCompanyError.message });
                    skipped += 1;
                    processed += 1;
                    onProgress?.({ current: processed, total });
                    continue;
                }
                company = createdCompany as { id: string; name: string };
                companyMap.set(companyKey, company);
                insertedCompanies += 1;
            }

            const conflict = conflictByRow.get(row.rowNumber);
            if (conflict) {
                const resolution = resolutions[row.rowNumber] || 'skip';
                if (resolution === 'skip') {
                    skipped += 1;
                    processed += 1;
                    onProgress?.({ current: processed, total });
                    continue;
                }
                try {
                    await this.upsertCustomerContact({
                        id: conflict.existingContact.id,
                        customerId: company.id,
                        firstName: row.firstName,
                        lastName: row.lastName,
                        fullName: row.fullName,
                        email: row.email,
                        phone: row.phone,
                        street: row.street,
                        postalCode: row.postalCode,
                        city: row.city,
                        country: row.country,
                        notes: row.notes,
                        metadata: row.metadata
                    });
                    updatedContacts += 1;
                } catch (e: any) {
                    errors.push({ rowNumber: row.rowNumber, name: row.companyName, reason: e?.message || 'Kontakt konnte nicht aktualisiert werden.' });
                    skipped += 1;
                }
                processed += 1;
                onProgress?.({ current: processed, total });
                continue;
            }

            try {
                await this.upsertCustomerContact({
                    customerId: company.id,
                    firstName: row.firstName,
                    lastName: row.lastName,
                    fullName: row.fullName,
                    email: row.email,
                    phone: row.phone,
                    street: row.street,
                    postalCode: row.postalCode,
                    city: row.city,
                    country: row.country,
                    notes: row.notes,
                    metadata: row.metadata
                });
                insertedContacts += 1;
            } catch (e: any) {
                errors.push({ rowNumber: row.rowNumber, name: row.companyName, reason: e?.message || 'Kontakt konnte nicht erstellt werden.' });
                skipped += 1;
            }
            processed += 1;
            onProgress?.({ current: processed, total });
        }

        return {
            insertedCompanies,
            insertedContacts,
            updatedContacts,
            skipped,
            conflicts: preview.conflicts.length,
            errors
        };
    },

    async deleteCustomer(id: string) {
        const { error } = await supabase
            .from('busflow_customers')
            .delete()
            .eq('id', id);

        if (!error) return;

        if ((error as any)?.code === '23503') {
            const inUseError: any = new Error('CUSTOMER_IN_USE');
            inUseError.code = 'CUSTOMER_IN_USE';
            throw inUseError;
        }

        throw error;
    },

    // --- Global Map Default ---
    async getMapDefaultView(): Promise<MapDefaultView | null> {
        const { data, error } = await supabase
            .from('busflow_app_settings')
            .select('value')
            .eq('key', 'map_default')
            .maybeSingle();

        if (error) throw error;
        if (!data?.value) return null;

        const value = data.value as Partial<MapDefaultView>;
        if (typeof value.lat !== 'number' || typeof value.lon !== 'number') return null;

        return {
            address: typeof value.address === 'string' ? value.address : '',
            lat: value.lat,
            lon: value.lon,
            zoom: typeof value.zoom === 'number' ? value.zoom : 6
        };
    },

    async upsertMapDefaultView(view: MapDefaultView) {
        const { error } = await supabase
            .from('busflow_app_settings')
            .upsert(
                {
                    key: 'map_default',
                    value: {
                        address: view.address,
                        lat: view.lat,
                        lon: view.lon,
                        zoom: view.zoom
                    }
                },
                { onConflict: 'key' }
            );

        if (error) throw error;
    }
};
