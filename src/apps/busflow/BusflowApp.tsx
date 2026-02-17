import React, { useState, useEffect } from 'react';
import { Plus, List, ArrowLeft, Printer, Settings as SettingsIcon, Leaf, Search, History, Calendar } from 'lucide-react';
import RouteEditor from './components/RouteEditor';
import RouteList from './components/RouteList';
import PrintPreview from './components/PrintPreview';
import Settings from './components/Settings';
import AppHeader from '../../shared/components/AppHeader';
import { BusType, Route, Worker } from './types';
import { BusFlowApi } from './api';

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
  const [searchQuery, setSearchQuery] = useState('');

  // Load Initial Data
  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      try {
        const [fetchedRoutes, fetchedBusTypes, fetchedWorkers] = await Promise.all([
          BusFlowApi.getRoutes(),
          BusFlowApi.getBusTypes(),
          BusFlowApi.getWorkers()
        ]);
        setRoutes(fetchedRoutes);
        setBusTypes(fetchedBusTypes);
        setWorkers(fetchedWorkers);
      } catch (error) {
        console.error('Fehler beim Laden der Daten:', error);
      } finally {
        setLoading(false);
      }
    };
    loadData();
  }, []);

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
      capacity: 0,
      status: 'Entwurf' as const,
      operationalNotes: ''
    };

    try {
      const created = await BusFlowApi.createRoute(newRouteData as any);
      await refreshRoutes();
      setCurrentRoute(created);
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
    // if (route.status !== 'Aktiv' && route.status !== 'Geplant') return;
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
        customerName: updatedRoute.customerName,
        operationalNotes: updatedRoute.operationalNotes,
        capacity: updatedRoute.capacity,
        busTypeId: updatedRoute.busTypeId,
        workerId: updatedRoute.workerId,
        kmStartBetrieb: updatedRoute.kmStartBetrieb,
        kmStartCustomer: updatedRoute.kmStartCustomer,
        kmEndCustomer: updatedRoute.kmEndCustomer,
        kmEndBetrieb: updatedRoute.kmEndBetrieb,
        totalKm: updatedRoute.totalKm,
        timeReturnBetrieb: updatedRoute.timeReturnBetrieb,
        timeReturnCustomer: updatedRoute.timeReturnCustomer
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

  const handleAddWorker = async (worker: Worker) => {
    try {
      await BusFlowApi.createWorker({ name: worker.name, role: worker.role });
      const fetched = await BusFlowApi.getWorkers();
      setWorkers(fetched);
    } catch (e) {
      alert('Fehler beim Speichern des Mitarbeiters.');
    }
  };

  const handleRemoveWorker = async (id: string) => {
    try {
      await BusFlowApi.deleteWorker(id);
      setWorkers(prev => prev.filter(w => w.id !== id));
    } catch (e) {
      alert('Fehler beim Löschen des Mitarbeiters.');
    }
  };

  // Filter & Split Logic
  const filteredRoutes = routes.filter(route => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();

    // Helper to find bus type name
    const busTypeName = busTypes.find(b => b.id === route.busTypeId)?.name || '';

    return (
      route.name.toLowerCase().includes(q) ||
      (route.driverName || '').toLowerCase().includes(q) ||
      (route.customerName || '').toLowerCase().includes(q) ||
      (route.busNumber || '').toLowerCase().includes(q) ||
      (route.status || '').toLowerCase().includes(q) ||
      (route.date || '').includes(q) ||
      busTypeName.toLowerCase().includes(q)
    );
  });

  // Split Logic: Aktiv vs Others
  // We sort both by date descending (newest first)
  const activeSection = filteredRoutes.filter(r => r.status === 'Aktiv').sort((a, b) => b.date.localeCompare(a.date));
  const otherSection = filteredRoutes.filter(r => r.status !== 'Aktiv').sort((a, b) => b.date.localeCompare(a.date));

  const isSearching = searchQuery.length > 0;

  // Shared Search Input Component
  const SearchInput = (
    <div className="relative w-full max-w-md">
      <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
        <Search className="h-4 w-4 text-slate-400" />
      </div>
      <input
        type="text"
        placeholder="Suche (Name, Kunde, Datum, Status...)"
        value={searchQuery}
        onChange={(e) => setSearchQuery(e.target.value)}
        className="block w-full pl-10 pr-3 py-1.5 border border-slate-600 rounded-md leading-5 bg-slate-800 text-slate-100 placeholder-slate-400 focus:outline-none focus:bg-slate-700 focus:border-slate-500 sm:text-sm transition-colors"
      />
    </div>
  );

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
        user={view === 'EDITOR' ? null : authUser}
        onHome={onGoHome}
        onProfile={onProfile}
        onAdmin={onAdmin}
        onLogout={onLogout}
        searchBar={view === 'LIST' ? SearchInput : undefined}
        actions={view === 'LIST' ? (
          <>

            <button
              onClick={() => setView('SETTINGS')}
              className={`flex items-center space-x-1 px-3 py-1.5 rounded-md transition-colors ${view === 'SETTINGS' ? 'bg-slate-800' : 'hover:bg-slate-800'}`}
            >
              <SettingsIcon className="w-4 h-4" />
              <span>Einstellungen</span>
            </button>

          </>
        ) : undefined}
      />

      <main className="flex-1 p-4 md:p-8 no-print max-w-7xl mx-auto w-full">
        {view === 'LIST' && (
          <div className="space-y-12">

            {/* SEARCH RESULTS VIEW */}
            {isSearching ? (
              <div className="space-y-4">
                <div className="flex items-center space-x-2 border-b border-slate-200 pb-2">
                  <Search className="w-5 h-5 text-blue-600" />
                  <h2 className="text-xl font-bold text-slate-800">Suchergebnisse</h2>
                  <span className="bg-blue-100 text-blue-700 text-xs font-semibold px-2 py-0.5 rounded-full">
                    {filteredRoutes.length}
                  </span>
                </div>
                {filteredRoutes.length > 0 ? (
                  <RouteList
                    routes={filteredRoutes}
                    busTypes={busTypes}
                    onEdit={handleEditRoute}
                    onPrint={handlePrintRoute}
                    onDelete={handleDeleteRoute}
                  />
                ) : (
                  <div className="text-center py-10 bg-slate-50 rounded-lg border border-dashed border-slate-300">
                    <p className="text-slate-500">Keine Routen gefunden für "{searchQuery}".</p>
                  </div>
                )}
              </div>
            ) : (
              /* SPLIT VIEW (Default) */
              <>
                {/* Active Section */}
                <div className="space-y-4">
                  <div className="flex items-center justify-between border-b border-slate-200 pb-2">
                    <div className="flex items-center space-x-2">
                      <Calendar className="w-5 h-5 text-emerald-600" />
                      <h2 className="text-xl font-bold text-slate-800">Aktive Routen</h2>
                      <span className="bg-emerald-100 text-emerald-700 text-xs font-semibold px-2 py-0.5 rounded-full">
                        {activeSection.length}
                      </span>
                    </div>
                    <button
                      onClick={handleCreateNew}
                      className="flex items-center space-x-1 bg-blue-600 hover:bg-blue-500 text-white px-4 py-1.5 rounded-md transition-colors whitespace-nowrap shadow-sm"
                    >
                      <Plus className="w-4 h-4" />
                      <span>Route erstellen</span>
                    </button>
                  </div>

                  {activeSection.length > 0 ? (
                    <RouteList
                      routes={activeSection}
                      busTypes={busTypes}
                      onEdit={handleEditRoute}
                      onPrint={handlePrintRoute}
                      onDelete={handleDeleteRoute}
                    />
                  ) : (
                    <div className="text-center py-10 bg-slate-50 rounded-lg border border-dashed border-slate-300">
                      <p className="text-slate-500">Keine aktiven Routen.</p>
                    </div>
                  )}
                </div>

                {/* Others Section */}
                <div className="space-y-4 opacity-75 hover:opacity-100 transition-opacity">
                  <div className="flex items-center space-x-2 border-b border-slate-200 pb-2">
                    <History className="w-5 h-5 text-slate-500" />
                    <h2 className="text-xl font-bold text-slate-700">Andere (Geplant, Entwurf, Archiv)</h2>
                    <span className="bg-slate-100 text-slate-600 text-xs font-semibold px-2 py-0.5 rounded-full">
                      {otherSection.length}
                    </span>
                  </div>

                  {otherSection.length > 0 ? (
                    <RouteList
                      routes={otherSection}
                      busTypes={busTypes}
                      onEdit={handleEditRoute}
                      onPrint={handlePrintRoute}
                      onDelete={handleDeleteRoute}
                    />
                  ) : (
                    <div className="text-center py-6">
                      <p className="text-slate-400 text-sm">Keine weiteren Routen.</p>
                    </div>
                  )}
                </div>
              </>
            )}

          </div>
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
