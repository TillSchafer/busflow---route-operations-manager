import React, { useState, useEffect } from 'react';
import { Plus, List, ArrowLeft, Printer, Settings as SettingsIcon, Leaf } from 'lucide-react';
import RouteEditor from './components/RouteEditor';
import RouteList from './components/RouteList';
import PrintPreview from './components/PrintPreview';
import Settings from './components/Settings';
import AppHeader from '../../shared/components/AppHeader';
import { BusType, Route, Worker } from './types';
import { BusFlowApi } from './api';

const WORKERS_KEY = 'busflow_workers_v1';

interface User {
  name: string;
  role: 'ADMIN' | 'DISPATCH' | 'VIEWER';
  avatarUrl?: string;
}

interface Props {
  authUser: User | null;
  onProfile: () => void;
  onLogout: () => void;
  onGoHome: () => void;
  onAdmin: () => void;
}

const BusflowApp: React.FC<Props> = ({ authUser, onProfile, onLogout, onGoHome, onAdmin }) => {
  const [routes, setRoutes] = useState<Route[]>([]);
  const [currentRoute, setCurrentRoute] = useState<Route | null>(null);
  const [view, setView] = useState<'LIST' | 'EDITOR' | 'PRINT' | 'SETTINGS'>('LIST');
  const [busTypes, setBusTypes] = useState<BusType[]>([]);
  const [workers, setWorkers] = useState<Worker[]>([]);
  const [loading, setLoading] = useState(true);

  // Load Initial Data
  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      try {
        const [fetchedRoutes, fetchedBusTypes] = await Promise.all([
          BusFlowApi.getRoutes(),
          BusFlowApi.getBusTypes()
        ]);
        setRoutes(fetchedRoutes);
        setBusTypes(fetchedBusTypes);
      } catch (error) {
        console.error('Fehler beim Laden der Daten:', error);
      } finally {
        setLoading(false);
      }
    };
    loadData();

    // Load local workers (pending DB migration)
    const savedWorkers = localStorage.getItem(WORKERS_KEY);
    if (savedWorkers) {
      try {
        setWorkers(JSON.parse(savedWorkers));
      } catch (e) {
        // ignore
      }
    }
  }, []);

  // Save workers locally
  useEffect(() => {
    localStorage.setItem(WORKERS_KEY, JSON.stringify(workers));
  }, [workers]);

  const refreshRoutes = async () => {
    const fetched = await BusFlowApi.getRoutes();
    setRoutes(fetched);
  };

  const handleCreateNew = async () => {
    const newRouteData = {
      name: 'Neue Route',
      date: new Date().toISOString().split('T')[0],
      busNumber: '',
      driverName: '', // Default empty, user selects
      capacity: 50,
      status: 'Draft' as const,
      operationalNotes: ''
    };

    try {
      const created = await BusFlowApi.createRoute(newRouteData as any);
      // Transform DB result if needed or just use it. 
      // Our API returns the DB row. we need to match Route type.
      // API createRoute returns 'data' which matches the DB columns.
      // We might need to map it if column names differ from Route type.
      // api.ts createRoute maps input to DB columns.
      // Let's assume api.ts returns compatible object or we re-fetch.
      await refreshRoutes();

      const newRoute: Route = {
        ...created,
        // Ensure defaults for missing fields
        stops: [],
        busTypeId: busTypes[0]?.id,
        workerId: workers[0]?.id
      } as any; // Cast for now due to camelCase vs snake_case potential mismatch if Supabase returns snake_case

      // Wait! Supabase returns exactly what's in DB (snake_case generally unless typed).
      // My API `getRoutes` maps props. `createRoute` returns raw DB response.
      // I should fix `createRoute` in API to map response OR just re-fetch all routes (easier).

      // We refreshed routes above. Now find the new one? 
      // Sorting by date/created_at might be needed.
      // Simpler: Just set view to editor with a placeholder that we know will be updated.
      // Actually `createRoute` return value is useful. 
      // Let's just find the latest route or use `created` id.

      const routeToEdit: Route = {
        id: created.id,
        name: created.name,
        date: created.date,
        status: created.status,
        busNumber: '',
        driverName: created.driver_name || '',
        capacity: 0,
        stops: [],
        operationalNotes: created.operational_notes || ''
      };

      setCurrentRoute(routeToEdit);
      setView('EDITOR');
    } catch (e) {
      console.error(e);
      alert('Fehler beim Erstellen der Route.');
    }
  };

  const handleEditRoute = (route: Route) => {
    setCurrentRoute(route);
    setView('EDITOR');
  };

  const handlePrintRoute = (route: Route) => {
    if (route.status !== 'Published') return;
    setCurrentRoute(route);
    setView('PRINT');
    setTimeout(() => window.print(), 300);
  };

  const handleSaveRoute = async (updatedRoute: Route) => {
    try {
      // 1. Update Route details
      await BusFlowApi.updateRoute(updatedRoute.id, {
        name: updatedRoute.name,
        date: updatedRoute.date,
        status: updatedRoute.status,
        driverName: updatedRoute.driverName,
        operationalNotes: updatedRoute.operationalNotes
        // TODO: bus_type_id etc.
      });

      // 2. Update Stops
      await BusFlowApi.updateStops(updatedRoute.id, updatedRoute.stops);

      await refreshRoutes();
      setView('LIST');
    } catch (e) {
      console.error(e);
      alert('Fehler beim Speichern.');
    }
  };

  const handleDeleteRoute = async (id: string) => {
    if (confirm('Möchten Sie diese Route wirklich löschen?')) {
      try {
        await BusFlowApi.deleteRoute(id);
        setRoutes(prev => prev.filter(r => r.id !== id));
      } catch (e) {
        console.error(e);
        alert('Fehler beim Löschen.');
      }
    }
  };

  const handleAddBusType = async (busType: BusType) => {
    try {
      await BusFlowApi.createBusType(busType);
      const fetched = await BusFlowApi.getBusTypes();
      setBusTypes(fetched);
    } catch (e) {
      alert('Fehler beim Speichern des Bustyps.');
    }
  };

  const handleRemoveBusType = async (id: string) => {
    try {
      await BusFlowApi.deleteBusType(id);
      setBusTypes(prev => prev.filter(b => b.id !== id));
    } catch (e) {
      alert('Fehler beim Löschen.');
    }
  };

  // Local Workers for now
  const handleAddWorker = (worker: Worker) => {
    setWorkers(prev => [...prev, worker]);
  };

  const handleRemoveWorker = (id: string) => {
    setWorkers(prev => prev.filter(w => w.id !== id));
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="flex flex-col items-center space-y-4">
          <Leaf className="w-8 h-8 animate-spin text-emerald-600" />
          <p className="text-slate-500">Lade BusFlow Daten...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col">
      <AppHeader
        title="Schäfer Tours Routenplanung"
        user={authUser}
        onHome={onGoHome}
        onProfile={onProfile}
        onAdmin={onAdmin}
        onLogout={onLogout}
        actions={(
          <>
            <button
              onClick={() => setView('LIST')}
              className={`flex items-center space-x-1 px-3 py-1.5 rounded-md transition-colors ${view === 'LIST' ? 'bg-slate-800' : 'hover:bg-slate-800'}`}
            >
              <List className="w-4 h-4" />
              <span>Meine Routen</span>
            </button>
            <button
              onClick={() => setView('SETTINGS')}
              className={`flex items-center space-x-1 px-3 py-1.5 rounded-md transition-colors ${view === 'SETTINGS' ? 'bg-slate-800' : 'hover:bg-slate-800'}`}
            >
              <SettingsIcon className="w-4 h-4" />
              <span>Einstellungen</span>
            </button>
            <button
              onClick={handleCreateNew}
              className="flex items-center space-x-1 bg-blue-600 hover:bg-blue-500 px-4 py-1.5 rounded-md transition-colors"
            >
              <Plus className="w-4 h-4" />
              <span>Route erstellen</span>
            </button>
          </>
        )}
      />

      <main className="flex-1 p-4 md:p-8 no-print max-w-7xl mx-auto w-full">
        {view === 'LIST' && (
          <RouteList
            routes={routes}
            busTypes={busTypes}
            onEdit={handleEditRoute}
            onPrint={handlePrintRoute}
            onDelete={handleDeleteRoute}
          />
        )}
        {view === 'EDITOR' && currentRoute && (
          <div className="space-y-6">
            <button
              onClick={() => setView('LIST')}
              className="flex items-center space-x-2 text-slate-500 hover:text-slate-800 transition-colors"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Zur Übersicht</span>
            </button>
            <RouteEditor
              route={currentRoute}
              onSave={handleSaveRoute}
              onCancel={() => setView('LIST')}
              busTypes={busTypes}
              workers={workers}
            />
          </div>
        )}
        {view === 'SETTINGS' && (
          <Settings
            busTypes={busTypes}
            workers={workers}
            onAddBusType={handleAddBusType}
            onRemoveBusType={handleRemoveBusType}
            onAddWorker={handleAddWorker}
            onRemoveWorker={handleRemoveWorker}
          />
        )}
        {view === 'PRINT' && currentRoute && (
          <div className="flex flex-col items-center space-y-4">
            <div className="bg-white p-8 border rounded-lg shadow-sm w-full max-w-4xl opacity-50 select-none">
              <p className="text-center italic">Die Druckvorschau wird erstellt. Falls sie nicht automatisch geöffnet wurde, klicken Sie unten.</p>
            </div>
            <button
              onClick={() => window.print()}
              className="bg-slate-900 text-white px-6 py-2 rounded-lg flex items-center space-x-2"
            >
              <Printer className="w-5 h-5" />
              <span>Druckdialog öffnen</span>
            </button>
            <button onClick={() => setView('LIST')} className="text-blue-600">Zurück zur App</button>
          </div>
        )}
      </main>

      <div className="print-only">
        {currentRoute && <PrintPreview route={currentRoute} busTypes={busTypes} />}
      </div>
    </div>
  );
};

export default BusflowApp;
