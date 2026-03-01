
import React, { useState, useMemo, useRef, useEffect } from 'react';
import { Route, Stop, BusType, Worker, Customer, MapDefaultView } from '../types';
import { Save, Plus, Trash2, ChevronDown, Loader2 } from 'lucide-react';
import { useToast } from '../../../shared/components/ToastProvider';
import RouteMap from './RouteMap';
import CustomerContactSelector from './route-editor/CustomerContactSelector';

import ConfirmDialog from '../../../shared/components/ConfirmDialog';
import AppSelect, { AppSelectOption } from '../../../shared/components/form/AppSelect';
import { DROPDOWN_ITEM, DROPDOWN_MENU, DROPDOWN_TRIGGER } from '../../../shared/components/form/dropdownStyles';

interface Props {
  route: Route;
  onSave: (route: Route) => Promise<void>;
  onCancel: () => void;
  busTypes: BusType[];
  workers: Worker[];
  customers: Customer[];
  mapDefaultView?: MapDefaultView;
}

type NominatimResult = {
  display_name: string;
  lat: string;
  lon: string;
  address?: {
    house_number?: string;
  };
};

const isAbortError = (error: unknown): boolean =>
  error instanceof DOMException ? error.name === 'AbortError' : false;

const routeStatusOptions: Array<AppSelectOption<Route['status']>> = [
  { value: 'Entwurf', label: 'Entwurf' },
  { value: 'Geplant', label: 'Geplant' },
  { value: 'Aktiv', label: 'Aktiv' },
  { value: 'Archiviert', label: 'Archiviert' },
];

const dropdownTriggerButtonClass = `${DROPDOWN_TRIGGER} text-left flex items-center justify-between`;
const dropdownMenuClass = `${DROPDOWN_MENU} overflow-hidden`;

const RouteEditor: React.FC<Props> = ({ route, onSave, onCancel, busTypes, workers, customers, mapDefaultView }) => {
  const { pushToast } = useToast();
  const [formData, setFormData] = useState<Route>({ ...route });
  const [invalidFields, setInvalidFields] = useState<Set<string>>(new Set());
  const [suggestions, setSuggestions] = useState<Record<string, Array<{ label: string; lat: number; lon: number }>>>({});
  const [activeStopId, setActiveStopId] = useState<string | null>(null);
  const [isBusTypeDropdownOpen, setIsBusTypeDropdownOpen] = useState(false);
  const [isWorkerDropdownOpen, setIsWorkerDropdownOpen] = useState(false);
  const searchTimeouts = useRef<Record<string, number>>({});
  const searchControllers = useRef<Record<string, AbortController>>({});

  const [isSaving, setIsSaving] = useState(false);

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

  const selectedBusTypeCapacity = useMemo(
    () => busTypes.find(busType => busType.id === formData.busTypeId)?.capacity || 0,
    [busTypes, formData.busTypeId]
  );

  const customerRequiredForStatus = formData.status !== 'Entwurf';

  const selectedBusType = useMemo(
    () => busTypes.find(busType => busType.id === formData.busTypeId),
    [busTypes, formData.busTypeId]
  );

  const selectedWorker = useMemo(
    () => workers.find(worker => worker.id === formData.workerId),
    [workers, formData.workerId]
  );

  const validate = (): { errors: string[]; invalid: Set<string> } => {
    const errors: string[] = [];
    const invalid = new Set<string>();
    if (!formData.name) {
      errors.push('Der Routenname ist erforderlich.');
      invalid.add('name');
    }
    if (customerRequiredForStatus && !formData.customerId) {
      errors.push('Bitte wählen Sie einen Kunden aus der Liste aus (für Geplant/Aktiv/Archiviert).');
      invalid.add('customer');
    }
    if (formData.capacity < 0) {
      errors.push('Die belegten Plätze dürfen nicht negativ sein.');
      invalid.add('capacity');
    }
    if (selectedBusTypeCapacity > 0 && formData.capacity > selectedBusTypeCapacity) {
      errors.push(`Belegte Plätze (${formData.capacity}) überschreiten die Buskapazität (${selectedBusTypeCapacity}).`);
      invalid.add('capacity');
    }

    updatedStops.forEach((stop, idx) => {
      if (selectedBusTypeCapacity > 0 && stop.currentTotal > selectedBusTypeCapacity) {
        errors.push(`Halt "${stop.location || idx + 1}" überschreitet die Buskapazität (${stop.currentTotal}/${selectedBusTypeCapacity}).`);
        invalid.add(`stop-${stop.id}-total`);
      }
      if (stop.currentTotal < 0) {
        errors.push(`Halt "${stop.location || idx + 1}" führt zu negativen Fahrgastzahlen.`);
        invalid.add(`stop-${stop.id}-total`);
      }
      if (stop.arrivalTime > stop.departureTime) {
        errors.push(`Halt "${stop.location || idx + 1}" hat eine Ankunftszeit nach der Abfahrtszeit.`);
        invalid.add(`stop-${stop.id}-times`);
      }
    });

    return { errors, invalid };
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
        const hasHouseNumber = /\d/.test(trimmed);
        const response = await fetch(
          `https://nominatim.openstreetmap.org/search?format=jsonv2&addressdetails=1&dedupe=1&countrycodes=de&limit=8&q=${encodeURIComponent(trimmed)}&accept-language=de`,
          { signal: controller.signal }
        );
        const results = (await response.json()) as NominatimResult[];
        const mapped = (results || [])
          .map(item => ({
            label: item.display_name,
            lat: Number(item.lat),
            lon: Number(item.lon),
            score: (() => {
              // Prioritize precise street/house matches when user typed a house number.
              if (!hasHouseNumber) return 0;
              const hasExactHouseNumber = item?.address?.house_number || /\d/.test(item.display_name || '');
              return hasExactHouseNumber ? 1 : 0;
            })()
          }))
          .sort((a, b) => b.score - a.score)
          .map(({ label, lat, lon }) => ({ label, lat, lon }));
        setSuggestions(prev => ({ ...prev, [stopId]: mapped }));
        setActiveStopId(stopId);
      } catch (error) {
        if (isAbortError(error)) return;
      }
    }, 250);
  };

  const handleRemoveStop = (id: string) => {
    setFormData(prev => ({
      ...prev,
      stops: prev.stops.filter(s => s.id !== id)
    }));
  };

  const handleSave = async () => {
    const { errors, invalid } = validate();
    setInvalidFields(invalid);
    if (errors.length > 0) {
      pushToast({
        type: 'error',
        title: 'Speichern fehlgeschlagen',
        message: errors.length === 1
          ? errors[0]
          : <ul className="list-disc pl-4 space-y-0.5 mt-1">{errors.map((e, i) => <li key={i}>{e}</li>)}</ul>,
        durationMs: 6000,
      });
      return;
    }
    setIsSaving(true);
    try {
      await onSave({ ...formData, stops: updatedStops });
      setInvalidFields(new Set());
    } finally {
      setIsSaving(false);
    }
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
            <AppSelect<Route['status']>
              value={formData.status}
              onChange={nextStatus => setFormData({ ...formData, status: nextStatus })}
              options={routeStatusOptions}
              className="min-w-[11rem] font-medium"
              ariaLabel="Routenstatus waehlen"
            />
            <button
              onClick={handleCancelWrapper}
              disabled={isSaving}
              className="px-4 py-2 text-slate-600 hover:text-slate-800 font-medium transition-colors disabled:opacity-50"
            >
              Abbrechen
            </button>
            <button
              onClick={handleSave}
              disabled={isSaving}
              className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded-lg font-bold shadow-md shadow-blue-200 flex items-center space-x-2 transition-all disabled:opacity-70"
            >
              {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              <span>{isSaving ? 'Speichern...' : 'Speichern'}</span>
            </button>
          </div>
        </div>

        <div className="p-6">
          {/* Primary Meta Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
            <div className="col-span-1 md:col-span-2">
              <label className="block text-sm font-semibold text-slate-700 mb-1">Routenname</label>
              <input
                type="text"
                value={formData.name}
                onChange={e => {
                  setFormData({ ...formData, name: e.target.value });
                  setInvalidFields(prev => { const s = new Set(prev); s.delete('name'); return s; });
                }}
                className={`w-full rounded-lg focus:ring-blue-500 focus:border-blue-500 p-2.5 bg-white border transition-all ${invalidFields.has('name') ? 'border-red-400 ring-1 ring-red-300' : 'border-slate-300'}`}
                placeholder="Neue Route"
              />
            </div>
            <CustomerContactSelector
              customerName={formData.customerName || ''}
              customerId={formData.customerId || ''}
              customerContactId={formData.customerContactId}
              customerContactName={formData.customerContactName}
              customers={customers}
              customerRequiredForStatus={customerRequiredForStatus}
              hasError={invalidFields.has('customer')}
              onChange={patch => {
                setFormData(prev => ({ ...prev, ...patch }));
                if (patch.customerId) {
                  setInvalidFields(prev => { const s = new Set(prev); s.delete('customer'); return s; });
                }
              }}
            />
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
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setIsBusTypeDropdownOpen(prev => !prev)}
                  onBlur={() => window.setTimeout(() => setIsBusTypeDropdownOpen(false), 150)}
                  className={dropdownTriggerButtonClass}
                >
                  <span className={selectedBusType ? 'text-slate-800' : 'text-slate-400'}>
                    {selectedBusType ? `${selectedBusType.name} (${selectedBusType.capacity})` : 'Bustyp auswählen'}
                  </span>
                  <ChevronDown className={`h-4 w-4 text-slate-400 transition-transform ${isBusTypeDropdownOpen ? 'rotate-180' : ''}`} />
                </button>
                {isBusTypeDropdownOpen && (
                  <div className={dropdownMenuClass}>
                    <button
                      type="button"
                      onMouseDown={e => e.preventDefault()}
                      onClick={() => {
                        setFormData({ ...formData, busTypeId: undefined });
                        setIsBusTypeDropdownOpen(false);
                      }}
                      className={DROPDOWN_ITEM}
                    >
                      Bustyp auswählen
                    </button>
                    {busTypes.map(busType => (
                      <button
                        key={busType.id}
                        type="button"
                        onMouseDown={e => e.preventDefault()}
                        onClick={() => {
                          setFormData({ ...formData, busTypeId: busType.id });
                          setIsBusTypeDropdownOpen(false);
                        }}
                        className={DROPDOWN_ITEM}
                      >
                        {busType.name} ({busType.capacity})
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-1">Fahrer</label>
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setIsWorkerDropdownOpen(prev => !prev)}
                  onBlur={() => window.setTimeout(() => setIsWorkerDropdownOpen(false), 150)}
                  className={dropdownTriggerButtonClass}
                >
                  <span className={selectedWorker ? 'text-slate-800' : 'text-slate-400'}>
                    {selectedWorker ? `${selectedWorker.name}${selectedWorker.role ? ` (${selectedWorker.role})` : ''}` : 'Fahrer auswählen'}
                  </span>
                  <ChevronDown className={`h-4 w-4 text-slate-400 transition-transform ${isWorkerDropdownOpen ? 'rotate-180' : ''}`} />
                </button>
                {isWorkerDropdownOpen && (
                  <div className={dropdownMenuClass}>
                    <button
                      type="button"
                      onMouseDown={e => e.preventDefault()}
                      onClick={() => {
                        setFormData({
                          ...formData,
                          workerId: undefined,
                          driverName: ''
                        });
                        setIsWorkerDropdownOpen(false);
                      }}
                      className={DROPDOWN_ITEM}
                    >
                      Fahrer auswählen
                    </button>
                    {workers.map(worker => (
                      <button
                        key={worker.id}
                        type="button"
                        onMouseDown={e => e.preventDefault()}
                        onClick={() => {
                          setFormData({
                            ...formData,
                            workerId: worker.id,
                            driverName: worker.name
                          });
                          setIsWorkerDropdownOpen(false);
                        }}
                        className={DROPDOWN_ITEM}
                      >
                        {worker.name}{worker.role ? ` (${worker.role})` : ''}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-1">Kapazität (belegte Plätze)</label>
              <input
                type="number"
                value={formData.capacity}
                onChange={e => {
                  setFormData({ ...formData, capacity: parseInt(e.target.value) || 0 });
                  setInvalidFields(prev => { const s = new Set(prev); s.delete('capacity'); return s; });
                }}
                className={`w-full rounded-lg focus:ring-blue-500 focus:border-blue-500 p-2.5 bg-white border transition-all ${invalidFields.has('capacity') ? 'border-red-400 ring-1 ring-red-300' : 'border-slate-300'}`}
              />
              {selectedBusTypeCapacity > 0 && (
                <p className="text-xs text-slate-500 mt-1">
                  Buskapazität aus Bustyp: {selectedBusTypeCapacity} Sitze
                </p>
              )}
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
            <RouteMap
              stops={updatedStops}
              defaultCenter={mapDefaultView ? { lat: mapDefaultView.lat, lon: mapDefaultView.lon } : undefined}
              defaultZoom={mapDefaultView?.zoom}
            />
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
                          <div className={DROPDOWN_MENU}>
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
                                className={DROPDOWN_ITEM}
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
                        onChange={e => {
                          handleUpdateStop(stop.id, { arrivalTime: e.target.value });
                          setInvalidFields(prev => { const s = new Set(prev); s.delete(`stop-${stop.id}-times`); return s; });
                        }}
                        className={`w-full focus:ring-0 p-1 text-slate-800 ${invalidFields.has(`stop-${stop.id}-times`) ? 'border border-red-400 rounded bg-transparent' : 'border-transparent bg-transparent'}`}
                      />
                    </td>
                    <td className="px-4 py-3">
                      <input
                        type="time"
                        value={stop.departureTime}
                        onChange={e => {
                          handleUpdateStop(stop.id, { departureTime: e.target.value });
                          setInvalidFields(prev => { const s = new Set(prev); s.delete(`stop-${stop.id}-times`); return s; });
                        }}
                        className={`w-full focus:ring-0 p-1 text-slate-800 font-semibold ${invalidFields.has(`stop-${stop.id}-times`) ? 'border border-red-400 rounded bg-transparent' : 'border-transparent bg-transparent'}`}
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
                        onChange={e => {
                          handleUpdateStop(stop.id, { currentTotal: parseInt(e.target.value) || 0 });
                          setInvalidFields(prev => { const s = new Set(prev); s.delete(`stop-${stop.id}-total`); return s; });
                        }}
                        className={`w-full focus:ring-0 p-1 text-center font-bold ${invalidFields.has(`stop-${stop.id}-total`) ? 'border border-red-400 rounded bg-transparent' : 'border-transparent bg-transparent'} ${selectedBusTypeCapacity > 0 && stop.currentTotal > selectedBusTypeCapacity ? 'text-red-600' : 'text-slate-700'}`}
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
