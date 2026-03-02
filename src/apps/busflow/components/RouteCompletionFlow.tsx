import React, { useState } from 'react';
import { ChevronLeft, ChevronRight, CheckCircle2 } from 'lucide-react';
import { Route, Stop } from '../types';

export interface CompletionData {
  kmEndBetrieb: string;
  stopActualArrivals: Record<string, string>; // stopId → actualArrivalTime
  timeReturnCustomer: string;
  timeReturnBetrieb: string;
  operationalNotes: string;
}

interface Props {
  route: Route;
  onComplete: (data: CompletionData) => Promise<void>;
  onCancel: () => void;
}

const STEPS = ['KM & Ankunftszeiten', 'Rückkehrzeiten', 'Notizen'] as const;

const RouteCompletionFlow: React.FC<Props> = ({ route, onComplete, onCancel }) => {
  const [step, setStep] = useState(0);
  const [isSaving, setIsSaving] = useState(false);

  const [kmEndBetrieb, setKmEndBetrieb] = useState(route.kmEndBetrieb || '');
  const [stopActualArrivals, setStopActualArrivals] = useState<Record<string, string>>(() => {
    const init: Record<string, string> = {};
    route.stops.forEach(s => {
      init[s.id] = s.actualArrivalTime || '';
    });
    return init;
  });
  const [timeReturnCustomer, setTimeReturnCustomer] = useState(route.timeReturnCustomer || '');
  const [timeReturnBetrieb, setTimeReturnBetrieb] = useState(route.timeReturnBetrieb || '');
  const [operationalNotes, setOperationalNotes] = useState(route.operationalNotes || '');

  const handleComplete = async () => {
    setIsSaving(true);
    try {
      await onComplete({
        kmEndBetrieb,
        stopActualArrivals,
        timeReturnCustomer,
        timeReturnBetrieb,
        operationalNotes,
      });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[3000] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-xl overflow-hidden flex flex-col">
        {/* Header */}
        <div className="bg-slate-900 text-white px-6 py-4">
          <h2 className="text-lg font-bold">Fahrt beenden – {route.name || 'Route'}</h2>
          <div className="flex items-center space-x-2 mt-3">
            {STEPS.map((label, i) => (
              <React.Fragment key={i}>
                <div className="flex items-center space-x-1.5">
                  <div
                    className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold transition-colors ${
                      i < step
                        ? 'bg-emerald-500 text-white'
                        : i === step
                        ? 'bg-blue-500 text-white'
                        : 'bg-slate-700 text-slate-400'
                    }`}
                  >
                    {i < step ? <CheckCircle2 className="w-4 h-4" /> : i + 1}
                  </div>
                  <span className={`text-xs font-medium ${i === step ? 'text-white' : 'text-slate-400'}`}>
                    {label}
                  </span>
                </div>
                {i < STEPS.length - 1 && <div className="flex-1 h-px bg-slate-700" />}
              </React.Fragment>
            ))}
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 px-6 py-5 overflow-y-auto max-h-[60vh]">
          {step === 0 && (
            <div className="space-y-5">
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1">
                  KM-Stand Ende (Betrieb)
                </label>
                <input
                  type="text"
                  value={kmEndBetrieb}
                  onChange={e => setKmEndBetrieb(e.target.value)}
                  placeholder="z.B. 123456"
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              {route.stops.length > 0 && (
                <div>
                  <h3 className="text-sm font-semibold text-slate-700 mb-3">
                    Tatsächliche Ankunftszeiten pro Haltestelle
                  </h3>
                  <div className="space-y-3">
                    {route.stops.map((stop: Stop, idx: number) => (
                      <div key={stop.id} className="flex items-center gap-3 p-3 bg-slate-50 rounded-lg border border-slate-200">
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-slate-800 truncate">
                            {idx + 1}. {stop.location || 'Unbekannter Ort'}
                          </p>
                          <p className="text-xs text-slate-500">Geplant: {stop.arrivalTime || '–'}</p>
                        </div>
                        <input
                          type="time"
                          value={stopActualArrivals[stop.id] || ''}
                          onChange={e =>
                            setStopActualArrivals(prev => ({ ...prev, [stop.id]: e.target.value }))
                          }
                          className="border border-slate-300 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 w-32"
                        />
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {step === 1 && (
            <div className="space-y-5">
              <p className="text-sm text-slate-500">
                Wann ist der Bus beim Kunden bzw. zurück im Betrieb angekommen?
              </p>
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1">
                  Rückkehr Uhrzeit Kunde
                </label>
                <input
                  type="time"
                  value={timeReturnCustomer}
                  onChange={e => setTimeReturnCustomer(e.target.value)}
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1">
                  Rückkehr Uhrzeit Betrieb
                </label>
                <input
                  type="time"
                  value={timeReturnBetrieb}
                  onChange={e => setTimeReturnBetrieb(e.target.value)}
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-4">
              <p className="text-sm text-slate-500">
                Optionale Notizen zur Fahrt (Besonderheiten, Probleme, Hinweise).
              </p>
              <textarea
                value={operationalNotes}
                onChange={e => setOperationalNotes(e.target.value)}
                placeholder="Notizen zur Fahrt..."
                rows={6}
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
              />
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-slate-100 flex items-center justify-between">
          <button
            type="button"
            onClick={onCancel}
            className="text-sm text-slate-500 hover:text-slate-700 font-medium"
            disabled={isSaving}
          >
            Abbrechen
          </button>

          <div className="flex items-center space-x-3">
            {step > 0 && (
              <button
                type="button"
                onClick={() => setStep(s => s - 1)}
                disabled={isSaving}
                className="flex items-center space-x-1 px-4 py-2 rounded-lg border border-slate-300 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
              >
                <ChevronLeft className="w-4 h-4" />
                <span>Zurück</span>
              </button>
            )}

            {step < STEPS.length - 1 ? (
              <button
                type="button"
                onClick={() => setStep(s => s + 1)}
                className="flex items-center space-x-1 px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-sm font-semibold"
              >
                <span>Weiter</span>
                <ChevronRight className="w-4 h-4" />
              </button>
            ) : (
              <button
                type="button"
                onClick={handleComplete}
                disabled={isSaving}
                className="flex items-center space-x-2 px-5 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-semibold disabled:opacity-50"
              >
                <CheckCircle2 className="w-4 h-4" />
                <span>{isSaving ? 'Wird gespeichert...' : 'Fahrt beenden'}</span>
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default RouteCompletionFlow;
