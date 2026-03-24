import React, { useEffect, useRef, useState } from 'react';
import { X, Loader2 } from 'lucide-react';
import { MapDefaultView, MapPageSettings, DEFAULT_MAP_PAGE_SETTINGS } from '../../../apps/busflow/types';
import { DROPDOWN_HELPER_TEXT, DROPDOWN_ITEM, DROPDOWN_MENU } from '../../../shared/components/form/dropdownStyles';
import ModalShell from '../../../shared/ui/dialog/ModalShell';

export type { MapPageSettings };
export { DEFAULT_MAP_PAGE_SETTINGS };

const STORAGE_KEY = 'dizpo_map_settings';

export function loadMapPageSettings(): MapPageSettings {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_MAP_PAGE_SETTINGS;
    return { ...DEFAULT_MAP_PAGE_SETTINGS, ...JSON.parse(raw) };
  } catch {
    return DEFAULT_MAP_PAGE_SETTINGS;
  }
}

export function saveMapPageSettings(s: MapPageSettings) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(s)); } catch { /* ignore */ }
}

// ── Helpers (same as MapDefaultViewPanel) ─────────────────────────────────────
const zoomToPercent = (zoom: number) =>
  Math.round(((Math.min(16, Math.max(3, zoom)) - 3) / (16 - 3)) * 100);

const percentToZoom = (percent: number) =>
  Math.round(3 + ((16 - 3) * Math.min(100, Math.max(0, percent))) / 100);

// ── Component ──────────────────────────────────────────────────────────────────
interface Props {
  mapDefaultView: MapDefaultView;
  onSaveMapDefaultView: (view: MapDefaultView) => Promise<void>;
  settings: MapPageSettings;
  onSettingsChange: (s: MapPageSettings) => void;
  onClose: () => void;
  canManage: boolean;
}

const dropdownMenuScrollableClass = `${DROPDOWN_MENU} overflow-hidden max-h-64`;

const MapSettingsPanel: React.FC<Props> = ({
  mapDefaultView,
  onSaveMapDefaultView,
  settings,
  onSettingsChange,
  onClose,
  canManage,
}) => {
  // ── Default view state ────────────────────────────────────────────────────
  const [mapAddress, setMapAddress] = useState(mapDefaultView.address || '');
  const [mapLat, setMapLat] = useState(mapDefaultView.lat);
  const [mapLon, setMapLon] = useState(mapDefaultView.lon);
  const [mapZoomPercent, setMapZoomPercent] = useState(zoomToPercent(mapDefaultView.zoom || 6));
  const [suggestions, setSuggestions] = useState<Array<{ label: string; lat: number; lon: number }>>([]);
  const [suggestionsOpen, setSuggestionsOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const searchTimeoutRef = useRef<number | null>(null);
  const searchAbortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    setMapAddress(mapDefaultView.address || '');
    setMapLat(mapDefaultView.lat);
    setMapLon(mapDefaultView.lon);
    setMapZoomPercent(zoomToPercent(mapDefaultView.zoom || 6));
  }, [mapDefaultView]);

  const searchAddress = (query: string) => {
    if (searchTimeoutRef.current) window.clearTimeout(searchTimeoutRef.current);
    if (!query.trim()) { setSuggestions([]); return; }
    searchTimeoutRef.current = window.setTimeout(async () => {
      searchAbortRef.current?.abort();
      const controller = new AbortController();
      searchAbortRef.current = controller;
      try {
        const res = await fetch(
          `https://nominatim.openstreetmap.org/search?format=jsonv2&addressdetails=1&dedupe=1&countrycodes=de&limit=8&q=${encodeURIComponent(query.trim())}&accept-language=de`,
          { signal: controller.signal },
        );
        const data = await res.json();
        setSuggestions((data || []).map((item: { display_name: string; lat: string; lon: string }) => ({
          label: item.display_name,
          lat: Number(item.lat),
          lon: Number(item.lon),
        })));
        setSuggestionsOpen(true);
      } catch (err) {
        if ((err as Error)?.name === 'AbortError') return;
      }
    }, 250);
  };

  const handleSaveDefaultView = async () => {
    if (!canManage || isSaving || !Number.isFinite(mapLat) || !Number.isFinite(mapLon)) return;
    setIsSaving(true);
    try {
      await onSaveMapDefaultView({ address: mapAddress.trim(), lat: mapLat, lon: mapLon, zoom: percentToZoom(mapZoomPercent) });
    } finally {
      setIsSaving(false);
    }
  };

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <ModalShell isOpen onBackdropClick={onClose} className="max-w-xl animate-in fade-in zoom-in duration-200 no-print">
      {/* Header */}
      <div className="bg-slate-900 text-white px-5 py-4 flex items-center justify-between rounded-t-xl">
        <h2 className="font-bold text-base">Karten-Einstellungen</h2>
        <button
          onClick={onClose}
          className="text-slate-400 hover:text-white transition-colors p-1 rounded-md hover:bg-slate-800"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Scrollable body */}
      <div className="max-h-[75vh] overflow-y-auto p-5 space-y-8">

          {/* ── Section 1: Standardansicht ──────────────────────────────── */}
          <section>
            <h3 className="text-sm font-bold text-slate-500 uppercase tracking-wider mb-4">
              Standardansicht
            </h3>
            <p className="text-xs text-slate-400 mb-4">
              Diese Position wird beim Öffnen der Karte als Startansicht verwendet, solange keine Fahrer aktiv sind.
            </p>

            <div className="space-y-4">
              <div className="relative">
                <label className="block text-sm font-semibold text-slate-700 mb-1">Adresse</label>
                <input
                  type="text"
                  value={mapAddress}
                  onChange={e => { setMapAddress(e.target.value); searchAddress(e.target.value); }}
                  onFocus={() => setSuggestionsOpen(true)}
                  onBlur={() => window.setTimeout(() => setSuggestionsOpen(false), 150)}
                  disabled={!canManage}
                  className="w-full border border-slate-300 rounded-lg p-2.5 text-sm focus:ring-blue-500 focus:border-blue-500 disabled:bg-slate-50"
                  placeholder="z. B. München, Bayern"
                />
                {suggestionsOpen && suggestions.length > 0 && (
                  <div className={dropdownMenuScrollableClass}>
                    {suggestions.map((s, i) => (
                      <button
                        key={i}
                        type="button"
                        onMouseDown={e => e.preventDefault()}
                        onClick={() => { setMapAddress(s.label); setMapLat(s.lat); setMapLon(s.lon); setSuggestionsOpen(false); }}
                        className={DROPDOWN_ITEM}
                      >
                        {s.label}
                      </button>
                    ))}
                  </div>
                )}
                <p className={DROPDOWN_HELPER_TEXT}>
                  Koordinaten: {mapLat.toFixed(5)}, {mapLon.toFixed(5)}
                </p>
              </div>

              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-2">
                  Zoom / Radius
                  <span className="ml-2 text-slate-400 font-normal">({mapZoomPercent}%)</span>
                </label>
                <input
                  type="range"
                  min={0}
                  max={100}
                  value={mapZoomPercent}
                  onChange={e => setMapZoomPercent(Number(e.target.value))}
                  disabled={!canManage}
                  className="w-full accent-blue-600"
                />
                <div className="flex justify-between text-xs text-slate-400 mt-1">
                  <span>weit heraus</span>
                  <span>stark herein</span>
                </div>
              </div>

              <button
                onClick={handleSaveDefaultView}
                disabled={!canManage || isSaving}
                className="w-full bg-blue-600 hover:bg-blue-500 text-white px-4 py-2.5 rounded-lg font-semibold text-sm transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {isSaving && <Loader2 className="w-4 h-4 animate-spin" />}
                {isSaving ? 'Speichern...' : 'Standardansicht speichern'}
              </button>
            </div>
          </section>

          {/* ── Section 2: Fahrer-Marker ─────────────────────────────────── */}
          <section>
            <h3 className="text-sm font-bold text-slate-500 uppercase tracking-wider mb-4">
              Fahrer-Marker
            </h3>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-2">Stil</label>
                <div className="flex gap-3">
                  {(
                    [
                      { value: 'initials', label: 'Initialen', preview: 'JS' },
                      { value: 'bus',      label: 'Bus',       preview: '🚌' },
                      { value: 'dot',      label: 'Punkt',     preview: '●' },
                    ] as const
                  ).map(opt => (
                    <button
                      key={opt.value}
                      onClick={() => onSettingsChange({ ...settings, markerStyle: opt.value })}
                      className={`flex-1 flex flex-col items-center gap-1.5 py-3 rounded-xl border-2 transition-colors ${
                        settings.markerStyle === opt.value
                          ? 'border-blue-500 bg-blue-50'
                          : 'border-slate-200 hover:border-slate-300'
                      }`}
                    >
                      <span className="text-lg leading-none">{opt.preview}</span>
                      <span className="text-xs font-semibold text-slate-600">{opt.label}</span>
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-2">Größe</label>
                <div className="flex gap-2">
                  {(
                    [
                      { value: 'small',  label: 'Klein' },
                      { value: 'medium', label: 'Mittel' },
                      { value: 'large',  label: 'Groß' },
                    ] as const
                  ).map(opt => (
                    <button
                      key={opt.value}
                      onClick={() => onSettingsChange({ ...settings, markerSize: opt.value })}
                      className={`flex-1 py-2 rounded-lg border-2 text-sm font-semibold transition-colors ${
                        settings.markerSize === opt.value
                          ? 'border-blue-500 bg-blue-50 text-blue-700'
                          : 'border-slate-200 text-slate-600 hover:border-slate-300'
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </section>

          {/* ── Section 3: Anzeige-Optionen ──────────────────────────────── */}
          <section>
            <h3 className="text-sm font-bold text-slate-500 uppercase tracking-wider mb-4">
              Anzeige
            </h3>
            <div className="space-y-3">
              <Toggle
                label="Haltestellen anzeigen"
                description="Zeigt die Haltepunkte aktiver und geplanter Routen als kleine Punkte."
                checked={settings.showStopMarkers}
                onChange={v => onSettingsChange({ ...settings, showStopMarkers: v })}
              />
              <Toggle
                label="Auto-Zoom auf Fahrer"
                description="Zoomt die Karte automatisch auf die aktiven Fahrer, sobald sie einloggen."
                checked={settings.autoZoomToDrivers}
                onChange={v => onSettingsChange({ ...settings, autoZoomToDrivers: v })}
              />
            </div>
          </section>
        </div>
    </ModalShell>
  );
};

// ── Small reusable toggle ──────────────────────────────────────────────────────
const Toggle: React.FC<{
  label: string;
  description: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}> = ({ label, description, checked, onChange }) => (
  <label className="flex items-start gap-3 cursor-pointer group">
    <div className="relative mt-0.5 shrink-0">
      <input
        type="checkbox"
        className="sr-only"
        checked={checked}
        onChange={e => onChange(e.target.checked)}
      />
      <div
        className={`w-10 h-6 rounded-full transition-colors ${checked ? 'bg-blue-600' : 'bg-slate-300'}`}
      />
      <div
        className={`absolute top-1 left-1 w-4 h-4 bg-white rounded-full shadow transition-transform ${checked ? 'translate-x-4' : ''}`}
      />
    </div>
    <div>
      <p className="text-sm font-semibold text-slate-700 group-hover:text-slate-900">{label}</p>
      <p className="text-xs text-slate-400 mt-0.5">{description}</p>
    </div>
  </label>
);

export default MapSettingsPanel;
