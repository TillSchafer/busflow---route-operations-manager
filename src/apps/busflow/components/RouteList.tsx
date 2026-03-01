
import React from 'react';
import { BusType, Route } from '../types';
import { Calendar, User, Bus as BusIcon, Printer, Edit, Trash2, Users, Download } from 'lucide-react';

interface Props {
  routes: Route[];
  busTypes: BusType[];
  onEdit: (route: Route) => void;
  onPrint: (route: Route) => void;
  onDelete: (id: string) => void;
  canManageRoutes?: boolean;
  label?: string;
}

const RouteList: React.FC<Props> = ({ routes, busTypes, onEdit, onPrint, onDelete, canManageRoutes = true, label }) => {
  const getBusTypeName = (busTypeId?: string) =>
    busTypes.find(busType => busType.id === busTypeId)?.name || '';

  const getBusTypeCapacity = (busTypeId?: string) =>
    busTypes.find(busType => busType.id === busTypeId)?.capacity || 0;

  const getMaxLoad = (route: Route) => {
    const directMax = Math.max(0, ...route.stops.map(s => Number(s.currentTotal) || 0));

    // Fallback for legacy/partial data where currentTotal may be missing:
    // derive running occupancy from boarding/leaving values.
    let running = 0;
    let derivedMax = 0;
    route.stops.forEach(stop => {
      running += (Number(stop.boarding) || 0) - (Number(stop.leaving) || 0);
      derivedMax = Math.max(derivedMax, running);
    });

    return Math.max(directMax, derivedMax, 0);
  };

  const getOccupiedSeats = (route: Route) => {
    const explicitOccupied = Number(route.capacity) || 0;
    if (explicitOccupied > 0) return explicitOccupied;
    return getMaxLoad(route);
  };

  const exportToCSV = (route: Route) => {
    const headers = ['Ort', 'Ankunft', 'Abfahrt', 'Personen', 'Notizen'];
    const rows = route.stops.map(s => [
      `"${s.location}"`,
      s.arrivalTime,
      s.departureTime,
      s.currentTotal,
      `"${s.notes || ''}"`
    ]);

    const csvContent = [
      [
        `"Route: ${route.name}"`,
        `"Datum: ${route.date}"`,
        `"Fahrer: ${route.driverName}"`,
        `"Bustyp: ${getBusTypeName(route.busTypeId)}"`
      ],
      [],
      headers,
      ...rows
    ].map(e => e.join(",")).join("\n");

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    const safeName = route.name.replace(/\s+/g, '_') || 'route';
    link.setAttribute("download", `${safeName}_${route.date}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  if (routes.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-slate-400">
        <BusIcon className="w-16 h-16 mb-4 opacity-20" />
        <p className="text-lg">Keine Routen gefunden. Erstellen Sie Ihre erste Route, um zu starten.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-end mb-4">
        <h2 className="text-2xl font-bold text-slate-800">Betriebsübersicht</h2>
        <span className="text-sm text-slate-500 font-medium">{routes.length} {label ?? 'Routen'}</span>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {routes.map(route => {
          const busCapacity = Math.max(1, getBusTypeCapacity(route.busTypeId) || Number(route.capacity) || 1);
          const occupiedSeats = getOccupiedSeats(route);
          const loadPercentage = Math.round((occupiedSeats / busCapacity) * 100);
          const remainingSeats = Math.max(0, busCapacity - occupiedSeats);

          return (
            <div key={route.id} className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden hover:shadow-md transition-shadow">
              <div className="p-5">
                <div className="flex justify-between items-start mb-4">
                  <div>
                    <h3 className="text-lg font-bold text-slate-900 line-clamp-1">{route.name || 'Unbenannte Route'}</h3>
                    <div className="flex items-center text-slate-500 text-sm mt-1">
                      <Calendar className="w-3.5 h-3.5 mr-1" />
                      {route.date}
                    </div>
                  </div>
                  <span className={`px-2 py-1 rounded text-xs font-semibold ${route.status === 'Aktiv' ? 'bg-green-100 text-green-700' :
                    route.status === 'Geplant' ? 'bg-blue-100 text-blue-700' :
                      route.status === 'Archiviert' ? 'bg-slate-100 text-slate-600' :
                        'bg-amber-100 text-amber-700'
                    }`}>
                    {route.status}
                  </span>
                </div>

                <div className="space-y-2 mb-6">
                  <div className="flex items-center text-sm text-slate-600">
                    <User className="w-4 h-4 mr-2 text-slate-400" />
                    <span className="font-medium">{route.driverName || 'Kein Fahrer zugewiesen'}</span>
                  </div>
                  <div className="flex items-center text-sm text-slate-600">
                    <BusIcon className="w-4 h-4 mr-2 text-slate-400" />
                    <span>{getBusTypeName(route.busTypeId) || 'Kein Bustyp zugewiesen'}</span>
                  </div>
                  <div className="flex items-center text-sm text-slate-600">
                    <Users className="w-4 h-4 mr-2 text-slate-400" />
                    <span>{route.stops.length} Halte</span>
                  </div>
                </div>

                <div className="mb-6">
                  <div className="flex justify-between text-xs font-semibold text-slate-500 mb-1">
                    <span>MAXIMALE AUSLASTUNG</span>
                    <span>{loadPercentage}% ({occupiedSeats}/{busCapacity}, {remainingSeats} frei)</span>
                  </div>
                  <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full ${loadPercentage > 90 ? 'bg-red-500' : 'bg-blue-500'}`}
                      style={{ width: `${Math.min(100, loadPercentage)}%` }}
                    />
                  </div>
                </div>

                <div className="flex flex-col space-y-2 border-t border-slate-100 pt-4">
                  <div className="flex items-center justify-between">
                    <div className="flex space-x-1">
                      <button
                        disabled={!canManageRoutes}
                        onClick={() => onEdit(route)}
                        className={`p-2 transition-colors rounded-lg ${canManageRoutes ? 'text-slate-600 hover:text-blue-600 hover:bg-blue-50' : 'text-slate-300 cursor-not-allowed'}`}
                        title="Route bearbeiten"
                      >
                        <Edit className="w-5 h-5" />
                      </button>
                      <button
                        disabled={!canManageRoutes}
                        onClick={() => onDelete(route.id)}
                        className={`p-2 transition-colors rounded-lg ${canManageRoutes ? 'text-slate-600 hover:text-red-600 hover:bg-red-50' : 'text-slate-300 cursor-not-allowed'}`}
                        title="Route löschen"
                      >
                        <Trash2 className="w-5 h-5" />
                      </button>
                    </div>
                    <div className="flex space-x-2">
                      <button
                        onClick={() => exportToCSV(route)}
                        className="p-2 text-slate-600 hover:text-indigo-600 hover:bg-indigo-50 transition-colors rounded-lg"
                        title="CSV exportieren"
                      >
                        <Download className="w-5 h-5" />
                      </button>
                      <button
                        onClick={() => onPrint(route)}
                        className="flex items-center space-x-2 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors bg-slate-900 hover:bg-slate-800 text-white"
                        title="Drucken"
                      >
                        <Printer className="w-4 h-4" />
                        <span>Drucken</span>
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default RouteList;
