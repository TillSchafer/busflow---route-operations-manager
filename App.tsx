
import React, { useState, useEffect } from 'react';
import { Route, BusType, Worker } from './types';
import RouteEditor from './components/RouteEditor';
import RouteList from './components/RouteList';
import PrintPreview from './components/PrintPreview';
import Settings from './components/Settings';
import { Bus, Plus, List, ArrowLeft, Printer, Settings as SettingsIcon } from 'lucide-react';

const STORAGE_KEY = 'busflow_routes_v1';
const SETTINGS_KEY = 'busflow_settings_v1';

const App: React.FC = () => {
  const [routes, setRoutes] = useState<Route[]>([]);
  const [currentRoute, setCurrentRoute] = useState<Route | null>(null);
  const [view, setView] = useState<'LIST' | 'EDITOR' | 'PRINT' | 'SETTINGS'>('LIST');
  const [busTypes, setBusTypes] = useState<BusType[]>([]);
  const [workers, setWorkers] = useState<Worker[]>([]);

  const normalizeRoute = (route: Route): Route => {
    let current = 0;
    const stops = (route.stops || []).map(stop => {
      const boarding = Number(stop.boarding) || 0;
      const leaving = Number(stop.leaving) || 0;
      const hasCurrent = Number.isFinite(Number(stop.currentTotal));
      current = hasCurrent ? Number(stop.currentTotal) : current + boarding - leaving;
      return {
        ...stop,
        boarding,
        leaving,
        arrivalTime: stop.arrivalTime || '',
        departureTime: stop.departureTime || '',
        currentTotal: current
      };
    });

    return {
      ...route,
      capacity: Number(route.capacity) || 0,
      status: route.status === 'Published' ? 'Published' : 'Draft',
      stops,
      busTypeId: route.busTypeId || undefined,
      workerId: route.workerId || undefined,
      operationalNotes: route.operationalNotes || '',
      kmStartBetrieb: route.kmStartBetrieb || '',
      kmStartCustomer: route.kmStartCustomer || '',
      kmEndCustomer: route.kmEndCustomer || '',
      kmEndBetrieb: route.kmEndBetrieb || '',
      totalKm: route.totalKm || '',
      timeReturnBetrieb: route.timeReturnBetrieb || '',
      timeReturnCustomer: route.timeReturnCustomer || ''
    };
  };

  const buildInitialExample = (): Route => ({
    id: '1',
    name: 'Schulbus Tour Nord',
    date: '2026-01-09',
    busNumber: 'TÖN-TS 112',
    driverName: 'Mustermann',
    capacity: 55,
    status: 'Published',
    operationalNotes: [
      'Schülerausweise / Tickets an jeder Einstiegshaltestelle prüfen.',
      'Ankunftszeiten sind Zielzeiten; Sicherheit geht vor Geschwindigkeit.',
      'Verspätungen von mehr als 10 Minuten sofort an die Leitstelle melden.',
      'Dieses Dokument aufbewahren und am Schichtende abgeben.'
    ].join('\n'),
    kmStartBetrieb: '',
    kmStartCustomer: '',
    kmEndCustomer: '',
    kmEndBetrieb: '',
    totalKm: '',
    timeReturnBetrieb: '',
    timeReturnCustomer: '',
    stops: [
      { id: 's1', location: 'Garding', arrivalTime: '07:10', departureTime: '07:15', boarding: 18, leaving: 0, currentTotal: 18, notes: 'Zentraler Halt' },
      { id: 's2', location: 'Tönning ZOB', arrivalTime: '07:35', departureTime: '07:40', boarding: 22, leaving: 0, currentTotal: 40 },
      { id: 's3', location: 'Gymnasium', arrivalTime: '07:50', departureTime: '07:50', boarding: 0, leaving: 40, currentTotal: 0 }
    ]
  });

  // Load data
  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) {
          setRoutes(parsed.map(normalizeRoute));
        } else if (parsed) {
          setRoutes([normalizeRoute(parsed)]);
        }
      } catch (error) {
        console.warn('Gespeicherte Routen konnten nicht geladen werden, Standarddaten werden verwendet.', error);
        setRoutes([normalizeRoute(buildInitialExample())]);
      }
    } else {
      // Default example data
      setRoutes([normalizeRoute(buildInitialExample())]);
    }
  }, []);

  useEffect(() => {
    const saved = localStorage.getItem(SETTINGS_KEY);
    if (!saved) return;
    try {
      const parsed = JSON.parse(saved);
      if (parsed?.busTypes) {
        setBusTypes(parsed.busTypes);
      }
      if (parsed?.workers) {
        setWorkers(parsed.workers);
      }
    } catch (error) {
      console.warn('Gespeicherte Einstellungen konnten nicht geladen werden.', error);
    }
  }, []);

  // Save data
  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(routes));
  }, [routes]);

  useEffect(() => {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify({ busTypes, workers }));
  }, [busTypes, workers]);

  const handleCreateNew = () => {
    const newRoute: Route = {
      id: Date.now().toString(),
      name: '',
      date: new Date().toISOString().split('T')[0],
      busNumber: '',
      driverName: '',
      capacity: 50,
      status: 'Draft',
      stops: [],
      busTypeId: busTypes[0]?.id,
      workerId: workers[0]?.id,
      operationalNotes: '',
      kmStartBetrieb: '',
      kmStartCustomer: '',
      kmEndCustomer: '',
      kmEndBetrieb: '',
      totalKm: '',
      timeReturnBetrieb: '',
      timeReturnCustomer: ''
    };
    setCurrentRoute(newRoute);
    setView('EDITOR');
  };

  const handleEditRoute = (route: Route) => {
    setCurrentRoute(route);
    setView('EDITOR');
  };

  const handlePrintRoute = (route: Route) => {
    setCurrentRoute(route);
    setView('PRINT');
    setTimeout(() => window.print(), 300);
  };

  const handleSaveRoute = (updatedRoute: Route) => {
    setRoutes(prev => {
      const exists = prev.find(r => r.id === updatedRoute.id);
      if (exists) {
        return prev.map(r => r.id === updatedRoute.id ? updatedRoute : r);
      }
      return [...prev, updatedRoute];
    });
    setView('LIST');
  };

  const handleDeleteRoute = (id: string) => {
    if (confirm('Möchten Sie diese Route wirklich löschen?')) {
      setRoutes(prev => prev.filter(r => r.id !== id));
    }
  };

  const handleAddBusType = (busType: BusType) => {
    setBusTypes(prev => [...prev, busType]);
  };

  const handleRemoveBusType = (id: string) => {
    setBusTypes(prev => prev.filter(b => b.id !== id));
  };

  const handleAddWorker = (worker: Worker) => {
    setWorkers(prev => [...prev, worker]);
  };

  const handleRemoveWorker = (id: string) => {
    setWorkers(prev => prev.filter(w => w.id !== id));
  };

  return (
    <div className="min-h-screen flex flex-col">
      {/* Navbar - Hidden on print */}
      <nav className="bg-slate-900 text-white p-4 sticky top-0 z-50 no-print flex items-center justify-between shadow-lg">
        <div className="flex items-center space-x-2 cursor-pointer" onClick={() => setView('LIST')}>
          <Bus className="w-8 h-8 text-blue-400" />
          <h1 className="text-xl font-bold tracking-tight">Schäfer Tours Routenplanung</h1>
        </div>
        <div className="flex space-x-4">
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
        </div>
      </nav>

      {/* Main Content */}
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

      {/* Print Overlay - Hidden on screen, visible on print */}
      <div className="print-only">
        {currentRoute && <PrintPreview route={currentRoute} busTypes={busTypes} />}
      </div>
    </div>
  );
};

export default App;
