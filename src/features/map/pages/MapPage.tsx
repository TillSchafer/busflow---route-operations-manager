import React, { useEffect, useRef, useState, useCallback } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { RefreshCw, Settings as SettingsIcon } from 'lucide-react';
import { useAuth } from '../../../shared/auth/AuthContext';
import { BusFlowApi } from '../../../apps/busflow/api';
import { supabase } from '../../../shared/lib/supabase';
import { MapDefaultView, Route } from '../../../apps/busflow/types';
import MapSettingsPanel, {
  MapPageSettings,
  DEFAULT_MAP_PAGE_SETTINGS,
  loadMapPageSettings,
  saveMapPageSettings,
} from './MapSettingsPanel';
import { useToast } from '../../../shared/components/ToastProvider';

// ── Types ──────────────────────────────────────────────────────────────────────
interface DriverLocation {
  user_id: string;
  lat: number;
  lon: number;
  heading: number | null;
  accuracy: number | null;
  updated_at: string;
  is_active: boolean;
  full_name: string | null;
}

// ── Constants ──────────────────────────────────────────────────────────────────
const STATUS_COLORS: Record<string, string> = {
  Aktiv: '#16a34a',
  Geplant: '#2563eb',
  Entwurf: '#94a3b8',
  Durchgeführt: '#7c3aed',
  Durchgefuehrt: '#7c3aed',
  Archiviert: '#64748b',
};
const DEFAULT_CENTER: [number, number] = [51.1657, 10.4515];
const DEFAULT_ZOOM = 6;
const MARKER_SIZE: Record<MapPageSettings['markerSize'], number> = {
  small: 24, medium: 32, large: 44,
};

// ── Marker HTML builders ───────────────────────────────────────────────────────
function buildDriverIcon(driver: DriverLocation, settings: MapPageSettings): string {
  const size = MARKER_SIZE[settings.markerSize];
  const rotate = driver.heading != null ? `transform:rotate(${driver.heading}deg);` : '';
  const base =
    `width:${size}px;height:${size}px;border-radius:50%;display:flex;align-items:center;` +
    `justify-content:center;box-shadow:0 2px 6px rgba(0,0,0,.5);${rotate}`;

  if (settings.markerStyle === 'dot') {
    return `<div style="${base}background:#0ea5e9;border:3px solid white;"></div>`;
  }

  if (settings.markerStyle === 'bus') {
    const fs = Math.round(size * 0.55);
    return `<div style="${base}background:#0f172a;border:3px solid #38bdf8;font-size:${fs}px;">🚌</div>`;
  }

  // initials (default)
  const initials = (driver.full_name ?? '?')
    .split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase();
  const fs = Math.round(size * 0.35);
  return (
    `<div style="${base}background:#0f172a;color:white;font-weight:700;font-size:${fs}px;` +
    `border:3px solid #38bdf8;">${initials}</div>`
  );
}

// ── Component ──────────────────────────────────────────────────────────────────
export default function MapPage() {
  const { activeAccountId, user } = useAuth();
  const { pushToast } = useToast();

  const mapRef             = useRef<HTMLDivElement | null>(null);
  const mapInstance        = useRef<L.Map | null>(null);
  const stopMarkersRef     = useRef<L.Marker[]>([]);
  const driverMarkersRef   = useRef<Map<string, L.Marker>>(new Map());
  const initialViewApplied = useRef(false);
  const suppressInitialDriverAutoZoom = useRef(true);
  const [isLocating, setIsLocating] = useState(false);

  const [routes,             setRoutes]             = useState<Route[]>([]);
  const [drivers,            setDrivers]            = useState<Map<string, DriverLocation>>(new Map());
  const [isLoading,          setIsLoading]          = useState(false);
  const [refreshIntervalSec, setRefreshIntervalSec] = useState(30);
  const [countdown,          setCountdown]          = useState(30);
  const [settingsOpen,       setSettingsOpen]       = useState(false);
  const [mapSettings,        setMapSettings]        = useState<MapPageSettings>(loadMapPageSettings);
  const [mapDefaultView,     setMapDefaultView]     = useState<MapDefaultView>({
    address: 'Deutschland', lat: DEFAULT_CENTER[0], lon: DEFAULT_CENTER[1], zoom: DEFAULT_ZOOM,
  });

  const canManage = user?.role === 'ADMIN' || user?.role === 'DISPATCH';

  // ── Load initial data ─────────────────────────────────────────────────────
  const loadRoutes = useCallback(async () => {
    if (!activeAccountId) return;
    BusFlowApi.setActiveAccountId(activeAccountId);
    try {
      const fetched = await BusFlowApi.getRoutes();
      setRoutes(fetched);
    } catch { /* ignore */ }
  }, [activeAccountId]);

  const loadDrivers = useCallback(async () => {
    if (!activeAccountId) return;
    const { data } = await supabase
      .from('driver_locations')
      .select('user_id,lat,lon,heading,accuracy,updated_at,is_active,full_name')
      .eq('account_id', activeAccountId)
      .eq('is_active', true);
    if (data) {
      const map = new Map<string, DriverLocation>();
      for (const row of data as DriverLocation[]) map.set(row.user_id, row);
      setDrivers(map);
    }
  }, [activeAccountId]);

  const loadDefaultView = useCallback(async () => {
    if (!activeAccountId) return;
    BusFlowApi.setActiveAccountId(activeAccountId);
    try {
      const view = await BusFlowApi.getMapPageDefaultView();
      if (view) {
        setMapDefaultView(view);
        if (mapInstance.current && !initialViewApplied.current) {
          mapInstance.current.setView([view.lat, view.lon], view.zoom ?? DEFAULT_ZOOM);
          initialViewApplied.current = true;
        }
      }
    } catch { /* ignore */ }
  }, [activeAccountId]);

  const loadMapSettings = useCallback(async () => {
    if (!activeAccountId) return;
    BusFlowApi.setActiveAccountId(activeAccountId);
    try {
      const saved = await BusFlowApi.getMapPageSettings();
      if (saved) setMapSettings({ ...DEFAULT_MAP_PAGE_SETTINGS, ...saved });
    } catch { /* fallback to localStorage/defaults already set */ }
  }, [activeAccountId]);

  useEffect(() => {
    setIsLoading(true);
    suppressInitialDriverAutoZoom.current = true;
    Promise.all([loadRoutes(), loadDrivers(), loadDefaultView(), loadMapSettings()]).finally(() => {
      setIsLoading(false);
      suppressInitialDriverAutoZoom.current = false;
    });
  }, [loadRoutes, loadDrivers, loadDefaultView, loadMapSettings]);

  // ── Auto-refresh ──────────────────────────────────────────────────────────
  useEffect(() => {
    setCountdown(refreshIntervalSec);
    const id = window.setInterval(() => {
      setCountdown(prev => {
        if (prev <= 1) { loadDrivers(); return refreshIntervalSec; }
        return prev - 1;
      });
    }, 1000);
    return () => window.clearInterval(id);
  }, [refreshIntervalSec, loadDrivers]);

  // ── Realtime for driver_locations ─────────────────────────────────────────
  useEffect(() => {
    if (!activeAccountId) return;
    const channel = supabase
      .channel(`driver-locations-${activeAccountId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'driver_locations', filter: `account_id=eq.${activeAccountId}` },
        payload => {
          const row = (payload.new ?? payload.old) as DriverLocation | undefined;
          if (!row?.user_id) return;
          const newRow = payload.new as DriverLocation | undefined;
          setDrivers(prev => {
            const next = new Map(prev);
            if (payload.eventType === 'DELETE' || !newRow?.is_active) {
              next.delete(row.user_id);
            } else if (newRow) {
              next.set(row.user_id, newRow);
            }
            return next;
          });
        },
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [activeAccountId]);

  // ── My location ───────────────────────────────────────────────────────────
  const handleMyLocation = useCallback(() => {
    setIsLocating(true);

    const zoomToPosition = (lat: number, lon: number) => {
      setIsLocating(false);
      mapInstance.current?.setView([lat, lon], 9);
    };

    const fallbackToIp = () => {
      fetch('https://ipapi.co/json/')
        .then(r => r.json())
        .then((data: { latitude?: number; longitude?: number }) => {
          if (data.latitude && data.longitude) {
            zoomToPosition(data.latitude, data.longitude);
          } else {
            setIsLocating(false);
            pushToast({ type: 'error', title: 'Standort nicht verfügbar', message: 'Standort konnte nicht ermittelt werden.' });
          }
        })
        .catch(() => {
          setIsLocating(false);
          pushToast({ type: 'error', title: 'Standort nicht verfügbar', message: 'Standort konnte nicht ermittelt werden.' });
        });
    };

    if (!navigator.geolocation) {
      fallbackToIp();
      return;
    }

    let resolved = false;

    const watchId = navigator.geolocation.watchPosition(
      pos => {
        if (resolved) return;
        resolved = true;
        clearTimeout(giveUpTimer);
        navigator.geolocation.clearWatch(watchId);
        zoomToPosition(pos.coords.latitude, pos.coords.longitude);
      },
      err => {
        // kCLErrorLocationUnknown (code 2) is transient — keep watching, don't give up yet
        if (err.code === err.PERMISSION_DENIED) {
          resolved = true;
          clearTimeout(giveUpTimer);
          navigator.geolocation.clearWatch(watchId);
          setIsLocating(false);
          pushToast({ type: 'error', title: 'Standort verweigert', message: 'Bitte Standortzugriff im Browser erlauben.' });
        }
        // for POSITION_UNAVAILABLE / TIMEOUT: just wait, giveUpTimer will handle it
      },
      { enableHighAccuracy: true, timeout: 20000, maximumAge: 0 },
    );

    const giveUpTimer = setTimeout(() => {
      if (resolved) return;
      resolved = true;
      navigator.geolocation.clearWatch(watchId);
      fallbackToIp();
    }, 12000);
  }, [pushToast]);

  // ── Init map ──────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!mapRef.current || mapInstance.current) return;

    mapInstance.current = L.map(mapRef.current, {
      center: [mapDefaultView.lat, mapDefaultView.lon],
      zoom: mapDefaultView.zoom ?? DEFAULT_ZOOM,
    });

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; OpenStreetMap contributors',
    }).addTo(mapInstance.current);

    return () => { mapInstance.current?.remove(); mapInstance.current = null; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // run once on mount

  // ── Stop markers ──────────────────────────────────────────────────────────
  useEffect(() => {
    if (!mapInstance.current) return;

    stopMarkersRef.current.forEach(m => m.remove());
    stopMarkersRef.current = [];

    if (!mapSettings.showStopMarkers) return;

    routes
      .filter(r => r.status === 'Aktiv' || r.status === 'Geplant')
      .forEach(route => {
        const color = STATUS_COLORS[route.status] ?? '#94a3b8';
        route.stops
          .filter(s => typeof s.lat === 'number' && typeof s.lon === 'number')
          .forEach((stop, idx) => {
            const icon = L.divIcon({
              html: `<div style="background:${color};width:10px;height:10px;border-radius:50%;border:2px solid white;box-shadow:0 1px 3px rgba(0,0,0,.4)"></div>`,
              className: '',
              iconSize: [10, 10],
              iconAnchor: [5, 5],
            });
            const marker = L.marker([stop.lat!, stop.lon!], { icon });
            marker.addTo(mapInstance.current!);
            marker.bindPopup(
              `<strong>${route.name || '(kein Name)'}</strong><br/>` +
              `${idx + 1}. ${stop.location}<br/>` +
              `<span style="color:${color};font-weight:600">${route.status}</span>` +
              (stop.arrivalTime ? `<br/>${stop.arrivalTime}` : ''),
            );
            stopMarkersRef.current.push(marker);
          });
      });
  }, [routes, mapSettings.showStopMarkers]);

  // ── Driver markers ────────────────────────────────────────────────────────
  useEffect(() => {
    if (!mapInstance.current) return;

    // Remove stale markers
    for (const [userId, marker] of driverMarkersRef.current) {
      if (!drivers.has(userId)) { marker.remove(); driverMarkersRef.current.delete(userId); }
    }

    const positions: [number, number][] = [];

    for (const [userId, driver] of drivers) {
      const pos: [number, number] = [driver.lat, driver.lon];
      positions.push(pos);

      const size = MARKER_SIZE[mapSettings.markerSize];
      const icon = L.divIcon({
        html: buildDriverIcon(driver, mapSettings),
        className: '',
        iconSize: [size, size],
        iconAnchor: [size / 2, size / 2],
      });

      driverMarkersRef.current.get(userId)?.remove();
      const marker = L.marker(pos, { icon });
      marker.addTo(mapInstance.current!);

      const ago = Math.round((Date.now() - new Date(driver.updated_at).getTime()) / 1000);
      const agoLabel = ago < 60 ? `vor ${ago} Sek.` : `vor ${Math.round(ago / 60)} Min.`;
      marker.bindPopup(
        `<strong>${driver.full_name ?? 'Fahrer'}</strong><br/>` +
        `<span style="color:#0ea5e9">● Aktiv</span><br/>` +
        `Zuletzt: ${agoLabel}`,
      );
      driverMarkersRef.current.set(userId, marker);
    }

    if (!mapSettings.autoZoomToDrivers || positions.length === 0 || !mapInstance.current) return;
    if (suppressInitialDriverAutoZoom.current) return;
    if (positions.length === 1) {
      mapInstance.current.setView(positions[0], 13);
    } else {
      mapInstance.current.fitBounds(L.latLngBounds(positions), { padding: [60, 60] });
    }
  }, [drivers, mapSettings]);

  // ── Settings helpers ──────────────────────────────────────────────────────
  const handleSettingsChange = (s: MapPageSettings) => {
    setMapSettings(s);
    saveMapPageSettings(s);
    if (activeAccountId) {
      BusFlowApi.setActiveAccountId(activeAccountId);
      BusFlowApi.upsertMapPageSettings(s).catch(() => { /* fire-and-forget */ });
    }
  };

  const handleSaveDefaultView = async (view: MapDefaultView) => {
    if (!activeAccountId) return;
    BusFlowApi.setActiveAccountId(activeAccountId);
    try {
      await BusFlowApi.upsertMapPageDefaultView(view);
      setMapDefaultView(view);
      mapInstance.current?.setView([view.lat, view.lon], view.zoom ?? DEFAULT_ZOOM);
      pushToast({ type: 'success', title: 'Gespeichert', message: 'Standardansicht wurde gespeichert.' });
    } catch {
      pushToast({ type: 'error', title: 'Fehler', message: 'Standardansicht konnte nicht gespeichert werden.' });
    }
  };

  const handleRefreshNow = () => {
    setIsLoading(true);
    Promise.all([loadRoutes(), loadDrivers()]).finally(() => {
      setIsLoading(false);
      setCountdown(refreshIntervalSec);
    });
  };

  const intervalOptions = [
    { value: 5,   label: 'alle 5 Sek.' },
    { value: 30,  label: 'alle 30 Sek.' },
    { value: 120, label: 'alle 2 Min.' },
  ];

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="flex flex-col h-screen">
      {/* Header — same dark color as sidebar */}
      <div className="bg-slate-900 text-white px-4 py-3 no-print flex items-center gap-3">
        <h1 className="text-base font-bold tracking-tight shrink-0">Karte</h1>

        <button
          onClick={handleRefreshNow}
          disabled={isLoading}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-md border border-slate-700 text-sm text-slate-300 hover:bg-slate-800 hover:text-white transition-colors disabled:opacity-50"
        >
          <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
          <span>Aktualisieren</span>
        </button>

        <select
          value={refreshIntervalSec}
          onChange={e => {
            const val = Number(e.target.value);
            setRefreshIntervalSec(val);
            setCountdown(val);
          }}
          className="border border-slate-700 rounded-md px-3 py-1.5 text-sm bg-slate-800 text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          {intervalOptions.map(opt => (
            <option key={opt.value} value={opt.value}>{opt.label}</option>
          ))}
        </select>

        <span className="text-xs text-slate-500 tabular-nums">
          nächstes Update in {countdown}s
        </span>

        {/* Driver count badge */}
        {drivers.size > 0 && (
          <span className="flex items-center gap-1.5 text-sm font-medium text-sky-300 bg-sky-900/40 border border-sky-700 rounded-full px-3 py-1">
            <span className="w-2 h-2 rounded-full bg-sky-400 animate-pulse inline-block" />
            {drivers.size} Fahrer online
          </span>
        )}

        {/* Einstellungen — pinned right */}
        <button
          onClick={() => setSettingsOpen(true)}
          className="ml-auto flex items-center gap-1.5 px-3 py-1.5 rounded-md border border-slate-700 text-sm text-slate-300 hover:bg-slate-800 hover:text-white transition-colors"
        >
          <SettingsIcon className="w-4 h-4" />
          <span>Einstellungen</span>
        </button>
      </div>

      {/* Map */}
      <div className="flex-1 w-full relative">
        <div ref={mapRef} className="absolute inset-0" />
        {/* My location button — positioned below Leaflet zoom controls */}
        <button
          onClick={handleMyLocation}
          disabled={isLocating}
          title="Mein Standort"
          className="absolute z-[1000] top-[84px] left-[10px] w-[30px] h-[30px] flex items-center justify-center bg-white border border-[rgba(0,0,0,0.2)] rounded-sm shadow-sm hover:bg-gray-100 disabled:opacity-50 transition-colors"
          style={{ lineHeight: 1 }}
        >
          {isLocating ? (
            <svg className="w-4 h-4 text-blue-500 animate-spin" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
            </svg>
          ) : (
            <svg className="w-4 h-4 text-gray-700" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="3" />
              <path d="M12 2v3M12 19v3M2 12h3M19 12h3" />
              <circle cx="12" cy="12" r="8" strokeDasharray="2 4" />
            </svg>
          )}
        </button>
      </div>

      {/* Settings overlay */}
      {settingsOpen && (
        <MapSettingsPanel
          mapDefaultView={mapDefaultView}
          onSaveMapDefaultView={handleSaveDefaultView}
          settings={mapSettings}
          onSettingsChange={handleSettingsChange}
          onClose={() => setSettingsOpen(false)}
          canManage={canManage}
        />
      )}
    </div>
  );
}
