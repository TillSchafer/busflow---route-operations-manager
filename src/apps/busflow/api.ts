import { supabase } from '../../shared/lib/supabase';
import { Route as RouteType, Stop, BusType, Worker, Customer } from './types';

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
};

type DbRoute = {
    id: string;
    updated_at?: string | null;
    name: string | null;
    date: string | null;
    bus_number?: string | null;
    driver_name?: string | null;
    customer_id?: string | null;
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

    return {
    id: route.id,
    updatedAt: route.updated_at || undefined,
    name: route.name || '',
    date: route.date || '',
    busNumber: route.bus_number || '',
    driverName: route.driver_name || '',
    customerId: route.customer_id || linkedCustomer?.id || undefined,
    customerName: linkedCustomer?.name || route.customer_name || '',
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

export const BusFlowApi = {
    // --- Routes ---
    async getRoutes() {
        const { data, error } = await supabase
            .from('busflow_routes')
            .select(`
        *,
        busflow_stops (*),
        busflow_customers!busflow_routes_customer_id_fkey (id, name, notes)
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
    async getCustomers() {
        const { data, error } = await supabase
            .from('busflow_customers')
            .select('*')
            .order('name');

        if (error) throw error;
        return data as Customer[];
    },

    async createCustomer(customer: Omit<Customer, 'id'>) {
        const { data, error } = await supabase
            .from('busflow_customers')
            .insert({
                name: customer.name,
                notes: customer.notes
            })
            .select()
            .single();

        if (error) throw error;
        return data as Customer;
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
    }
};
