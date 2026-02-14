import { supabase } from '../../shared/lib/supabase';
import { Route as RouteType, Stop, BusType, Worker } from './types';

export const BusFlowApi = {
    // --- Routes ---
    async getRoutes() {
        const { data, error } = await supabase
            .from('busflow_routes')
            .select(`
        *,
        busflow_stops (*)
      `)
            .order('date', { ascending: true });

        if (error) throw error;

        // Map DB shape to App shape
        return data.map((r: any) => ({
            ...r,
            stops: r.busflow_stops?.sort((a: any, b: any) => a.sequence_order - b.sequence_order) || []
        })) as RouteType[];
    },

    async createRoute(route: Omit<RouteType, 'id'>) {
        const { data, error } = await supabase
            .from('busflow_routes')
            .insert({
                name: route.name,
                date: route.date,
                status: route.status,
                driver_name: route.driverName,
                operational_notes: route.operationalNotes
            })
            .select()
            .single();

        if (error) throw error;
        return data;
    },

    async updateRoute(id: string, updates: Partial<RouteType>) {
        const { error } = await supabase
            .from('busflow_routes')
            .update({
                name: updates.name,
                date: updates.date,
                status: updates.status,
                driver_name: updates.driverName,
                operational_notes: updates.operationalNotes
            })
            .eq('id', id);

        if (error) throw error;
    },

    async deleteRoute(id: string) {
        const { error } = await supabase
            .from('busflow_routes')
            .delete()
            .eq('id', id);

        if (error) throw error;
    },

    // --- Stops ---
    async updateStops(routeId: string, stops: Stop[]) {
        // 1. Delete existing stops for this route (simple replacement strategy)
        // In a real optimized app, we would upsert.
        const { error: deleteError } = await supabase
            .from('busflow_stops')
            .delete()
            .eq('route_id', routeId);

        if (deleteError) throw deleteError;

        if (stops.length === 0) return;

        // 2. Insert new stops
        const { error: insertError } = await supabase
            .from('busflow_stops')
            .insert(stops.map((stop, index) => ({
                route_id: routeId,
                location: stop.location,
                arrival_time: stop.arrivalTime,
                departure_time: stop.departureTime,
                boarding: stop.boarding,
                leaving: stop.leaving,
                current_total: stop.currentTotal,
                sequence_order: index,
                notes: stop.notes
            })));

        if (insertError) throw insertError;
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
    }
};
