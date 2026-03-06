import React, { useEffect, useRef } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { Stop } from '../types';

// Fix default marker icons broken by Webpack/Vite asset hashing
import markerIcon2x from 'leaflet/dist/images/marker-icon-2x.png';
import markerIcon from 'leaflet/dist/images/marker-icon.png';
import markerShadow from 'leaflet/dist/images/marker-shadow.png';

delete (L.Icon.Default.prototype as unknown as Record<string, unknown>)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconUrl: markerIcon,
  iconRetinaUrl: markerIcon2x,
  shadowUrl: markerShadow,
});

type LatLng = [number, number];

interface Props {
  stops: Stop[];
  defaultCenter?: { lat: number; lon: number };
  defaultZoom?: number;
}

const RouteMap: React.FC<Props> = ({ stops, defaultCenter, defaultZoom = 6 }) => {
  const mapRef = useRef<HTMLDivElement | null>(null);
  const mapInstance = useRef<L.Map | null>(null);
  const markersRef = useRef<L.Marker[]>([]);
  const routeRef = useRef<L.Layer | null>(null);
  const routeRequest = useRef<AbortController | null>(null);

  useEffect(() => {
    if (!mapRef.current || mapInstance.current) return;

    mapInstance.current = L.map(mapRef.current, {
      center: [defaultCenter?.lat ?? 51.1657, defaultCenter?.lon ?? 10.4515],
      zoom: defaultZoom,
    });

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; OpenStreetMap contributors',
    }).addTo(mapInstance.current);

    return () => {
      mapInstance.current?.remove();
      mapInstance.current = null;
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // run once on mount

  useEffect(() => {
    if (!mapInstance.current) return;

    markersRef.current.forEach(marker => marker.remove());
    markersRef.current = [];

    if (routeRef.current) {
      routeRef.current.remove();
      routeRef.current = null;
    }

    const validStops = stops.filter(
      stop => typeof stop.lat === 'number' && typeof stop.lon === 'number'
    );

    if (validStops.length === 0) {
      if (defaultCenter) {
        mapInstance.current.setView([defaultCenter.lat, defaultCenter.lon], defaultZoom);
      }
      return;
    }

    validStops.forEach((stop, index) => {
      const marker = L.marker([stop.lat as number, stop.lon as number]);
      marker.addTo(mapInstance.current!);
      marker.bindPopup(`${index + 1}. ${stop.location}`);
      markersRef.current.push(marker);
    });

    const positions: LatLng[] = validStops.map(stop => [stop.lat as number, stop.lon as number]);
    const bounds = L.latLngBounds(positions);

    if (validStops.length === 1) {
      mapInstance.current.setView(positions[0], 13);
      return;
    }

    mapInstance.current.fitBounds(bounds, { padding: [30, 30] });

    if (routeRequest.current) {
      routeRequest.current.abort();
    }

    const controller = new AbortController();
    routeRequest.current = controller;
    const coordinates = validStops.map(stop => `${stop.lon},${stop.lat}`).join(';');
    const fallbackPolyline = () => {
      if (routeRef.current) routeRef.current.remove();
      routeRef.current = L.polyline(positions, { color: '#2563eb', weight: 4 }).addTo(
        mapInstance.current!
      );
    };

    fetch(
      `https://router.project-osrm.org/route/v1/driving/${coordinates}?overview=full&geometries=geojson`,
      { signal: controller.signal }
    )
      .then(response => response.json())
      .then(data => {
        if (!data?.routes?.length) { fallbackPolyline(); return; }
        const line = data.routes[0].geometry;
        routeRef.current = L.geoJSON(line, {
          style: { color: '#2563eb', weight: 4 },
        }).addTo(mapInstance.current!);
      })
      .catch(error => {
        if (error?.name === 'AbortError') return;
        fallbackPolyline();
      });
  }, [stops, defaultCenter, defaultZoom]);

  return <div ref={mapRef} className="h-80 w-full rounded-xl border border-slate-200 overflow-hidden" />;
};

export default RouteMap;
