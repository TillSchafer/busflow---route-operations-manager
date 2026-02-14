import React, { useEffect, useRef } from 'react';
import { Stop } from '../types';

interface Props {
  stops: Stop[];
}

const RouteMap: React.FC<Props> = ({ stops }) => {
  const mapRef = useRef<HTMLDivElement | null>(null);
  const mapInstance = useRef<any>(null);
  const markersRef = useRef<any[]>([]);
  const routeRef = useRef<any>(null);
  const routeRequest = useRef<AbortController | null>(null);

  useEffect(() => {
    if (!mapRef.current || mapInstance.current) return;
    const L = (window as any).L;
    if (!L) return;

    mapInstance.current = L.map(mapRef.current, {
      center: [51.1657, 10.4515],
      zoom: 6
    });

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; OpenStreetMap contributors'
    }).addTo(mapInstance.current);
  }, []);

  useEffect(() => {
    const L = (window as any).L;
    if (!L || !mapInstance.current) return;

    markersRef.current.forEach(marker => marker.remove());
    markersRef.current = [];
    if (routeRef.current) {
      routeRef.current.remove();
      routeRef.current = null;
    }

    const validStops = stops.filter(
      stop => typeof stop.lat === 'number' && typeof stop.lon === 'number'
    );

    if (validStops.length === 0) return;

    validStops.forEach((stop, index) => {
      const marker = L.marker([stop.lat, stop.lon]).addTo(mapInstance.current);
      marker.bindPopup(`${index + 1}. ${stop.location}`);
      markersRef.current.push(marker);
    });

    const bounds = L.latLngBounds(validStops.map(stop => [stop.lat, stop.lon]));

    if (validStops.length === 1) {
      mapInstance.current.setView([validStops[0].lat, validStops[0].lon], 13);
      return;
    }

    mapInstance.current.fitBounds(bounds, { padding: [30, 30] });

    if (routeRequest.current) {
      routeRequest.current.abort();
    }

    const controller = new AbortController();
    routeRequest.current = controller;
    const coordinates = validStops.map(stop => `${stop.lon},${stop.lat}`).join(';');

    fetch(`https://router.project-osrm.org/route/v1/driving/${coordinates}?overview=full&geometries=geojson`, {
      signal: controller.signal
    })
      .then(response => response.json())
      .then(data => {
        if (!data?.routes?.length) return;
        const line = data.routes[0].geometry;
        routeRef.current = L.geoJSON(line, {
          style: { color: '#2563eb', weight: 4 }
        }).addTo(mapInstance.current);
      })
      .catch(error => {
        if (error?.name === 'AbortError') return;
      });
  }, [stops]);

  return <div ref={mapRef} className="h-80 w-full rounded-xl border border-slate-200 overflow-hidden" />;
};

export default RouteMap;
