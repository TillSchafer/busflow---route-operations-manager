import React, { useEffect, useRef, useState } from 'react';
import { MapDefaultView } from '../../types';
import { Loader2 } from 'lucide-react';
import { useToast } from '../../../../shared/components/ToastProvider';
import { DROPDOWN_HELPER_TEXT, DROPDOWN_ITEM, DROPDOWN_MENU } from '../../../../shared/components/form/dropdownStyles';

interface Props {
  mapDefaultView: MapDefaultView;
  onSaveMapDefaultView: (view: MapDefaultView) => Promise<void>;
  canManage?: boolean;
}

const dropdownMenuScrollableClass = `${DROPDOWN_MENU} overflow-hidden max-h-64`;

const zoomToPercent = (zoom: number) => {
  const clamped = Math.min(16, Math.max(3, zoom));
  return Math.round(((clamped - 3) / (16 - 3)) * 100);
};

const percentToZoom = (percent: number) => {
  const clamped = Math.min(100, Math.max(0, percent));
  return Math.round(3 + ((16 - 3) * clamped) / 100);
};

const MapDefaultViewPanel: React.FC<Props> = ({ mapDefaultView, onSaveMapDefaultView, canManage = true }) => {
  const { pushToast } = useToast();
  const [mapAddress, setMapAddress] = useState(mapDefaultView.address || '');
  const [mapLat, setMapLat] = useState<number>(mapDefaultView.lat);
  const [mapLon, setMapLon] = useState<number>(mapDefaultView.lon);
  const [mapZoomPercent, setMapZoomPercent] = useState<number>(zoomToPercent(mapDefaultView.zoom || 6));
  const [mapSuggestions, setMapSuggestions] = useState<Array<{ label: string; lat: number; lon: number }>>([]);
  const [mapSuggestionsOpen, setMapSuggestionsOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const searchTimeoutRef = useRef<number | null>(null);
  const searchAbortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    setMapAddress(mapDefaultView.address || '');
    setMapLat(mapDefaultView.lat);
    setMapLon(mapDefaultView.lon);
    setMapZoomPercent(zoomToPercent(mapDefaultView.zoom || 6));
  }, [mapDefaultView]);

  const searchMapAddress = (query: string) => {
    const trimmed = query.trim();
    if (searchTimeoutRef.current) {
      window.clearTimeout(searchTimeoutRef.current);
    }
    if (!trimmed) {
      setMapSuggestions([]);
      return;
    }

    searchTimeoutRef.current = window.setTimeout(async () => {
      if (searchAbortRef.current) {
        searchAbortRef.current.abort();
      }
      const controller = new AbortController();
      searchAbortRef.current = controller;

      try {
        const response = await fetch(
          `https://nominatim.openstreetmap.org/search?format=jsonv2&addressdetails=1&dedupe=1&countrycodes=de&limit=8&q=${encodeURIComponent(trimmed)}&accept-language=de`,
          { signal: controller.signal }
        );
        const result = await response.json();
        const items = (result || []).map((item: any) => ({
          label: item.display_name as string,
          lat: Number(item.lat),
          lon: Number(item.lon)
        }));
        setMapSuggestions(items);
        setMapSuggestionsOpen(true);
      } catch (error) {
        if ((error as any)?.name === 'AbortError') return;
      }
    }, 250);
  };

  const handleSaveMapDefault = async () => {
    if (!canManage || isSaving) return;
    if (!Number.isFinite(mapLat) || !Number.isFinite(mapLon)) {
      pushToast({
        type: 'error',
        title: 'Ungültige Adresse',
        message: 'Bitte wählen Sie eine Adresse aus den Vorschlägen.'
      });
      return;
    }
    setIsSaving(true);
    try {
      await onSaveMapDefaultView({
        address: mapAddress.trim(),
        lat: mapLat,
        lon: mapLon,
        zoom: percentToZoom(mapZoomPercent)
      });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="bg-white border border-slate-200 rounded-2xl shadow-sm p-6">
      <h2 className="text-xl font-bold text-slate-800 mb-1">Karten-Standard</h2>
      <p className="text-sm text-slate-500 mb-6">Diese Position wird beim Erstellen neuer Routen als Startansicht verwendet.</p>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <div className="md:col-span-3">
          <label className="block text-sm font-semibold text-slate-700 mb-1">Standardadresse</label>
          <div className="relative">
            <input
              type="text"
              value={mapAddress}
              onChange={(e) => {
                const value = e.target.value;
                setMapAddress(value);
                searchMapAddress(value);
              }}
              onFocus={() => setMapSuggestionsOpen(true)}
              onBlur={() => window.setTimeout(() => setMapSuggestionsOpen(false), 150)}
              disabled={!canManage}
              className="w-full border-slate-300 rounded-lg focus:ring-blue-500 focus:border-blue-500 p-2.5 bg-white border transition-all"
              placeholder="z. B. Bövergeest 85b, 25826, Sankt.Peter-Ording"
            />
            {mapSuggestionsOpen && mapSuggestions.length > 0 && (
              <div className={dropdownMenuScrollableClass}>
                {mapSuggestions.map((option, idx) => (
                  <button
                    key={`${option.label}-${idx}`}
                    type="button"
                    onMouseDown={e => e.preventDefault()}
                    onClick={() => {
                      setMapAddress(option.label);
                      setMapLat(option.lat);
                      setMapLon(option.lon);
                      setMapSuggestionsOpen(false);
                    }}
                    className={DROPDOWN_ITEM}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            )}
          </div>
          <p className={DROPDOWN_HELPER_TEXT}>Aktuelle Koordinaten: {mapLat.toFixed(5)}, {mapLon.toFixed(5)}</p>
        </div>
        <div>
          <label className="block text-sm font-semibold text-slate-700 mb-1">Zoom / Radius</label>
          <input
            type="range"
            min={0}
            max={100}
            step={1}
            value={mapZoomPercent}
            onChange={e => setMapZoomPercent(parseInt(e.target.value, 10) || 0)}
            disabled={!canManage}
            className="w-full accent-[#2663EB]"
          />
          <p className="text-xs text-slate-600 mt-1 font-medium">{mapZoomPercent}%</p>
          <p className="text-xs text-slate-500 mt-1">0% = weit herausgezoomt, 100% = stark hineingezoomt</p>
        </div>
        <div className="md:col-span-4">
          <button
            onClick={handleSaveMapDefault}
            disabled={!canManage || isSaving}
            className="bg-[#2663EB] hover:bg-[#1f54c7] text-white px-4 py-2.5 rounded-lg font-semibold transition-colors disabled:opacity-70 flex items-center gap-2"
          >
            {isSaving && <Loader2 className="w-4 h-4 animate-spin" />}
            {isSaving ? 'Speichern...' : 'Karten-Standard speichern'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default MapDefaultViewPanel;
