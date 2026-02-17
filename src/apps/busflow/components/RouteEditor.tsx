
import React, { useState, useMemo, useRef } from 'react';
import { Route, Stop, BusType, Worker } from '../types';
import { Save, Plus, Trash2, AlertCircle, Download } from 'lucide-react';
import RouteMap from './RouteMap';

import ConfirmDialog from '../../../shared/components/ConfirmDialog';

interface Props {
  route: Route;
  onSave: (route: Route) => void;
  onCancel: () => void;
  busTypes: BusType[];
  workers: Worker[];
}

const RouteEditor: React.FC<Props> = ({ route, onSave, onCancel, busTypes, workers }) => {
  const [formData, setFormData] = useState<Route>({ ...route });
  const [errors, setErrors] = useState<string[]>([]);
  const [suggestions, setSuggestions] = useState<Record<string, Array<{ label: string; lat: number; lon: number }>>>({});
  const [activeStopId, setActiveStopId] = useState<string | null>(null);
  const searchTimeouts = useRef<Record<string, number>>({});
  const searchControllers = useRef<Record<string, AbortController>>({});

  // Unsaved Changes Dialog State
  const [initialJson] = useState(JSON.stringify(route));
  const [showConfirmCancel, setShowConfirmCancel] = useState(false);

  const handleCancelWrapper = () => {
    const currentJson = JSON.stringify(formData);
    if (currentJson !== initialJson) {
      setShowConfirmCancel(true);
    } else {
      onCancel();
    }
  };

  // ... (rest of component rendering)


  // Normalize passenger totals as numeric values
  const updatedStops = useMemo(
    () =>
      formData.stops.map(stop => ({
        ...stop,
        currentTotal: Number(stop.currentTotal) || 0,
        actualArrivalTime: stop.actualArrivalTime || '',
        actualDepartureTime: stop.actualDepartureTime || ''
      })),
    [formData.stops]
  );

  const validate = () => {
    const newErrors: string[] = [];
    if (!formData.name) newErrors.push('Der Routenname ist erforderlich.');
    if (formData.capacity <= 0) newErrors.push('Die Kapazität muss größer als 0 sein.');

    updatedStops.forEach((stop, idx) => {
      if (stop.currentTotal > formData.capacity) {
        newErrors.push(`Halt "${stop.location || idx + 1}" überschreitet die Buskapazität (${stop.currentTotal}/${formData.capacity}).`);
      }
      if (stop.currentTotal < 0) {
        newErrors.push(`Halt "${stop.location || idx + 1}" führt zu negativen Fahrgastzahlen.`);
      }
      if (stop.arrivalTime > stop.departureTime) {
        newErrors.push(`Halt "${stop.location || idx + 1}" hat eine Ankunftszeit nach der Abfahrtszeit.`);
      }
    });

    setErrors(newErrors);
    return newErrors.length === 0;
  };

  const handleAddStop = () => {
    const lastStop = formData.stops[formData.stops.length - 1];
    const newStop: Stop = {
      id: Date.now().toString(),
      location: '',
      arrivalTime: lastStop ? lastStop.departureTime : '08:00',
      departureTime: lastStop ? lastStop.departureTime : '08:05',
      boarding: 0,
      leaving: 0,
      currentTotal: 0
    };
    setFormData(prev => ({ ...prev, stops: [...prev.stops, newStop] }));
  };

  const handleUpdateStop = (id: string, updates: Partial<Stop>) => {
    setFormData(prev => ({
      ...prev,
      stops: prev.stops.map(s => s.id === id ? { ...s, ...updates } : s)
    }));
  };

  const searchStops = (stopId: string, query: string) => {
    const trimmed = query.trim();
    if (searchTimeouts.current[stopId]) {
      window.clearTimeout(searchTimeouts.current[stopId]);
    }

    if (!trimmed) {
      setSuggestions(prev => ({ ...prev, [stopId]: [] }));
      return;
    }

    searchTimeouts.current[stopId] = window.setTimeout(async () => {
      if (searchControllers.current[stopId]) {
        searchControllers.current[stopId].abort();
      }
      const controller = new AbortController();
      searchControllers.current[stopId] = controller;

      try {
        const response = await fetch(
          `https://nominatim.openstreetmap.org/search?format=json&limit=5&q=${encodeURIComponent(trimmed)}&accept-language=de`,
          { signal: controller.signal }
        );
        const results = await response.json();
        const mapped = (results || []).map((item: any) => ({
          label: item.display_name,
          lat: Number(item.lat),
          lon: Number(item.lon)
        }));
        setSuggestions(prev => ({ ...prev, [stopId]: mapped }));
        setActiveStopId(stopId);
      } catch (error) {
        if ((error as any)?.name === 'AbortError') return;
      }
    }, 250);
  };

  const handleRemoveStop = (id: string) => {
    setFormData(prev => ({
      ...prev,
      stops: prev.stops.filter(s => s.id !== id)
    }));
  };

  const handleSave = () => {
    if (validate()) {
      onSave({ ...formData, stops: updatedStops });
    }
  };

  const exportToCSV = () => {
    const routeToExport = { ...formData, stops: updatedStops };
    const headers = ['Ort', 'Ankunft', 'Abfahrt', 'Personen', 'Notizen'];
    const rows = routeToExport.stops.map(s => [
      `"${s.location}"`,
      s.arrivalTime,
      s.departureTime,
      s.currentTotal,
      `"${s.notes || ''}"`
    ]);

    const csvContent = [
      [`"Route: ${routeToExport.name}"`, `"Datum: ${routeToExport.date}"`, `"Fahrer: ${routeToExport.driverName}"`, `"Bus: ${routeToExport.busNumber}"`],
      [],
      headers,
      ...rows
    ].map(e => e.join(",")).join("\n");

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute("download", `${routeToExport.name.replace(/\s+/g, '_') || 'route'}_${routeToExport.date}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };



  return (
    <>
      <ConfirmDialog
        isOpen={showConfirmCancel}
        title="Ungespeicherte Änderungen"
        message="Möchtest du die Seite wirklich verlassen? Deine Änderungen gehen verloren."
        confirmText="Verwerfen & Verlassen"
        cancelText="Weiter bearbeiten"
        type="warning"
        onConfirm={() => {
          setShowConfirmCancel(false);
          onCancel();
        }}
        onCancel={() => setShowConfirmCancel(false)}
      />
      <div className="bg-white shadow-xl rounded-2xl overflow-hidden border border-slate-200">
        <div className="p-6 border-b border-slate-100 flex flex-col md:flex-row justify-between items-start md:items-center bg-slate-50 gap-4">
          <div>
            <h2 className="text-xl font-bold text-slate-800">Routendetails bearbeiten</h2>
            <p className="text-sm text-slate-500">Zeitplan, Halte und Fahrgastkapazität konfigurieren.</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <select
              value={formData.status}
              onChange={e => setFormData({ ...formData, status: e.target.value as any })}
              className="p-2 pr-8 border-slate-300 rounded-lg focus:ring-blue-500 focus:border-blue-500 bg-white border text-sm font-medium text-slate-700"
            >
              <option value="Entwurf">Entwurf</option>
              <option value="Geplant">Geplant</option>
              <option value="Aktiv">Aktiv</option>
              <option value="Archiviert">Archiviert</option>
            </select>
            <button
              onClick={handleCancelWrapper}
              className="px-4 py-2 text-slate-600 hover:text-slate-800 font-medium transition-colors"
            >
              Abbrechen
            </button>
            <button
              onClick={handleSave}
              className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded-lg font-bold shadow-md shadow-blue-200 flex items-center space-x-2 transition-all"
            >
              <Save className="w-4 h-4" />
              <span>Speichern</span>
            </button>
          </div>
        </div>

        <div className="p-6">
          {errors.length > 0 && (
            <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg space-y-1">
              <div className="flex items-center text-red-700 font-bold mb-1">
                <AlertCircle className="w-4 h-4 mr-2" />
                <span>Validierungsfehler</span>
              </div>
              {errors.map((err, i) => (
                <p key={i} className="text-red-600 text-sm">{err}</p>
              ))}
            </div>
          )}

          {/* Primary Meta Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
            <div className="col-span-1 md:col-span-2">
              <label className="block text-sm font-semibold text-slate-700 mb-1">Routenname</label>
              <input
                type="text"
                value={formData.name}
                onChange={e => setFormData({ ...formData, name: e.target.value })}
                className="w-full border-slate-300 rounded-lg focus:ring-blue-500 focus:border-blue-500 p-2.5 bg-white border transition-all"
                placeholder="z. B. Morgenlinie A"
              />
            </div>
            <div className="col-span-1 md:col-span-2">
              <label className="block text-sm font-semibold text-slate-700 mb-1">Kunde / Auftraggeber</label>
              <input
                type="text"
                value={formData.customerName || ''}
                onChange={e => setFormData({ ...formData, customerName: e.target.value })}
                className="w-full border-slate-300 rounded-lg focus:ring-blue-500 focus:border-blue-500 p-2.5 bg-white border transition-all"
                placeholder="z. B. Stadtwerke GmbH"
              />
            </div>
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-1">Datum</label>
              <input
                type="date"
                value={formData.date}
                onChange={e => setFormData({ ...formData, date: e.target.value })}
                className="w-full border-slate-300 rounded-lg focus:ring-blue-500 focus:border-blue-500 p-2.5 bg-white border transition-all"
              />
            </div>
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-1">Bustyp</label>
              <select
                value={formData.busTypeId || ''}
                onChange={e => {
                  const selected = busTypes.find(busType => busType.id === e.target.value);
                  setFormData({
                    ...formData,
                    busTypeId: e.target.value || undefined,
                    capacity: selected ? selected.capacity : formData.capacity
                  });
                }}
                className="w-full border-slate-300 rounded-lg focus:ring-blue-500 focus:border-blue-500 p-2.5 bg-white border transition-all"
              >
                <option value="">Bustyp auswählen</option>
                {busTypes.map(busType => (
                  <option key={busType.id} value={busType.id}>
                    {busType.name} ({busType.capacity})
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-1">Fahrer</label>
              <select
                value={formData.workerId || ''}
                onChange={e => {
                  const selected = workers.find(worker => worker.id === e.target.value);
                  setFormData({
                    ...formData,
                    workerId: e.target.value || undefined,
                    driverName: selected ? selected.name : formData.driverName
                  });
                }}
                className="w-full border-slate-300 rounded-lg focus:ring-blue-500 focus:border-blue-500 p-2.5 bg-white border transition-all"
              >
                <option value="">Fahrer auswählen</option>
                {workers.map(worker => (
                  <option key={worker.id} value={worker.id}>
                    {worker.name}{worker.role ? ` (${worker.role})` : ''}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-1">Kapazität (Sitze)</label>
              <input
                type="number"
                value={formData.capacity}
                onChange={e => setFormData({ ...formData, capacity: parseInt(e.target.value) || 0 })}
                className="w-full border-slate-300 rounded-lg focus:ring-blue-500 focus:border-blue-500 p-2.5 bg-white border transition-all"
              />
            </div>
            <div className="col-span-1 md:col-span-2 lg:col-span-4">
              <label className="block text-sm font-semibold text-slate-700 mb-1">Betriebliche Hinweise</label>
              <textarea
                value={formData.operationalNotes || ''}
                onChange={e => setFormData({ ...formData, operationalNotes: e.target.value })}
                className="w-full border-slate-300 rounded-lg focus:ring-blue-500 focus:border-blue-500 p-2.5 bg-white border transition-all min-h-[120px]"
                placeholder="Je Zeile ein Hinweis. Diese erscheinen im Ausdruck."
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-1">Km Anfang Betrieb</label>
              <input
                type="text"
                value={formData.kmStartBetrieb || ''}
                onChange={e => setFormData({ ...formData, kmStartBetrieb: e.target.value })}
                className="w-full border-slate-300 rounded-lg focus:ring-blue-500 focus:border-blue-500 p-2.5 bg-white border transition-all"
                placeholder="z. B. 124560"
              />
            </div>
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-1">Km Anfang Kunde</label>
              <input
                type="text"
                value={formData.kmStartCustomer || ''}
                onChange={e => setFormData({ ...formData, kmStartCustomer: e.target.value })}
                className="w-full border-slate-300 rounded-lg focus:ring-blue-500 focus:border-blue-500 p-2.5 bg-white border transition-all"
                placeholder="z. B. 124780"
              />
            </div>
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-1">Km Ende Kunde</label>
              <input
                type="text"
                value={formData.kmEndCustomer || ''}
                onChange={e => setFormData({ ...formData, kmEndCustomer: e.target.value })}
                className="w-full border-slate-300 rounded-lg focus:ring-blue-500 focus:border-blue-500 p-2.5 bg-white border transition-all"
                placeholder="z. B. 125120"
              />
            </div>
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-1">Km Ende Betrieb</label>
              <input
                type="text"
                value={formData.kmEndBetrieb || ''}
                onChange={e => setFormData({ ...formData, kmEndBetrieb: e.target.value })}
                className="w-full border-slate-300 rounded-lg focus:ring-blue-500 focus:border-blue-500 p-2.5 bg-white border transition-all"
                placeholder="z. B. 125340"
              />
            </div>
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-1">Gesamtkilometer</label>
              <input
                type="text"
                value={formData.totalKm || ''}
                onChange={e => setFormData({ ...formData, totalKm: e.target.value })}
                className="w-full border-slate-300 rounded-lg focus:ring-blue-500 focus:border-blue-500 p-2.5 bg-white border transition-all"
                placeholder="z. B. 560"
              />
            </div>
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-1">Uhr Rückkehr Kunde</label>
              <input
                type="time"
                value={formData.timeReturnCustomer || ''}
                onChange={e => setFormData({ ...formData, timeReturnCustomer: e.target.value })}
                className="w-full border-slate-300 rounded-lg focus:ring-blue-500 focus:border-blue-500 p-2.5 bg-white border transition-all"
              />
            </div>
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-1">Uhr Rückkehr Betrieb</label>
              <input
                type="time"
                value={formData.timeReturnBetrieb || ''}
                onChange={e => setFormData({ ...formData, timeReturnBetrieb: e.target.value })}
                className="w-full border-slate-300 rounded-lg focus:ring-blue-500 focus:border-blue-500 p-2.5 bg-white border transition-all"
              />
            </div>
          </div>

          {/* Routenkarte */}
          <div className="mb-8 p-6 bg-slate-50 rounded-xl border border-slate-100">
            <div className="flex items-center space-x-2 mb-2">
              <h3 className="text-md font-bold text-slate-800">Routenkarte</h3>
            </div>
            <p className="text-sm text-slate-500 mb-4">
              Wählen Sie eine Adresse aus den Vorschlägen, um die Route zu berechnen.
            </p>
            <RouteMap stops={updatedStops} />
          </div>

          {/* Stops Editor Table */}
          <div className="overflow-x-auto border rounded-xl border-slate-200">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 text-slate-600 font-semibold border-b">
                <tr>
                  <th className="px-4 py-3 min-w-[180px]">Halt / Ort</th>
                  <th className="px-4 py-3 w-28">Ank.</th>
                  <th className="px-4 py-3 w-28">Abf.</th>
                  <th className="px-4 py-3 w-28">Soll Ank.</th>
                  <th className="px-4 py-3 w-28">Soll Abf.</th>
                  <th className="px-4 py-3 w-24 text-center">Personen</th>
                  <th className="px-4 py-3">Notizen</th>
                  <th className="px-4 py-3 w-16"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {updatedStops.map((stop, index) => (
                  <tr key={stop.id} className="hover:bg-slate-50/50 transition-colors">
                    <td className="px-4 py-3">
                      <div className="relative">
                        <input
                          type="text"
                          value={stop.location}
                          onChange={e => {
                            const value = e.target.value;
                            handleUpdateStop(stop.id, { location: value, lat: undefined, lon: undefined });
                            searchStops(stop.id, value);
                          }}
                          onFocus={() => setActiveStopId(stop.id)}
                          onBlur={() => {
                            window.setTimeout(() => setActiveStopId(null), 150);
                          }}
                          placeholder="z. B. ZOB"
                          className="w-full border-transparent bg-transparent focus:ring-0 p-1 text-slate-800 font-medium placeholder:text-slate-300"
                        />
                        {activeStopId === stop.id && suggestions[stop.id]?.length ? (
                          <div className="absolute z-20 mt-1 w-full rounded-lg border border-slate-200 bg-white shadow-lg">
                            {suggestions[stop.id].map((option, idx) => (
                              <button
                                key={`${stop.id}-${idx}`}
                                type="button"
                                onMouseDown={e => e.preventDefault()}
                                onClick={() => {
                                  handleUpdateStop(stop.id, {
                                    location: option.label,
                                    lat: option.lat,
                                    lon: option.lon
                                  });
                                  setSuggestions(prev => ({ ...prev, [stop.id]: [] }));
                                  setActiveStopId(null);
                                }}
                                className="w-full text-left px-3 py-2 text-sm hover:bg-slate-50"
                              >
                                {option.label}
                              </button>
                            ))}
                          </div>
                        ) : null}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <input
                        type="time"
                        value={stop.arrivalTime}
                        onChange={e => handleUpdateStop(stop.id, { arrivalTime: e.target.value })}
                        className="w-full border-transparent bg-transparent focus:ring-0 p-1 text-slate-800"
                      />
                    </td>
                    <td className="px-4 py-3">
                      <input
                        type="time"
                        value={stop.departureTime}
                        onChange={e => handleUpdateStop(stop.id, { departureTime: e.target.value })}
                        className="w-full border-transparent bg-transparent focus:ring-0 p-1 text-slate-800 font-semibold"
                      />
                    </td>
                    <td className="px-4 py-3">
                      <input
                        type="time"
                        value={stop.actualArrivalTime || ''}
                        onChange={e => handleUpdateStop(stop.id, { actualArrivalTime: e.target.value })}
                        className="w-full border-transparent bg-transparent focus:ring-0 p-1 text-slate-800"
                      />
                    </td>
                    <td className="px-4 py-3">
                      <input
                        type="time"
                        value={stop.actualDepartureTime || ''}
                        onChange={e => handleUpdateStop(stop.id, { actualDepartureTime: e.target.value })}
                        className="w-full border-transparent bg-transparent focus:ring-0 p-1 text-slate-800"
                      />
                    </td>
                    <td className="px-4 py-3">
                      <input
                        type="number"
                        value={stop.currentTotal}
                        onChange={e => handleUpdateStop(stop.id, { currentTotal: parseInt(e.target.value) || 0 })}
                        className={`w-full border-transparent bg-transparent focus:ring-0 p-1 text-center font-bold ${stop.currentTotal > formData.capacity ? 'text-red-600' : 'text-slate-700'}`}
                      />
                    </td>
                    <td className="px-4 py-3">
                      <input
                        type="text"
                        value={stop.notes || ''}
                        onChange={e => handleUpdateStop(stop.id, { notes: e.target.value })}
                        placeholder="Notizen..."
                        className="w-full border-transparent bg-transparent focus:ring-0 p-1 text-slate-500 italic"
                      />
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button
                        onClick={() => handleRemoveStop(stop.id)}
                        className="text-slate-300 hover:text-red-500 transition-colors p-1"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))}
                {formData.stops.length === 0 && (
                  <tr>
                    <td colSpan={8} className="px-4 py-10 text-center text-slate-400 italic">
                      Noch keine Halte hinzugefügt. Klicken Sie auf „Halt hinzufügen“, um zu starten.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
            <button
              onClick={handleAddStop}
              className="w-full py-4 flex items-center justify-center space-x-2 text-blue-600 hover:bg-blue-50 transition-colors bg-white font-semibold border-t"
            >
              <Plus className="w-5 h-5" />
              <span>Halt hinzufügen</span>
            </button>
          </div>
        </div>
      </div>
    </>
  );
};

export default RouteEditor;
