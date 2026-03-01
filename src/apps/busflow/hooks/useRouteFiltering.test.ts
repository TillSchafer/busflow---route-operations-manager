import { describe, expect, it } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useRouteFiltering } from './useRouteFiltering';
import type { BusType, Route } from '../types';

const busTypes: BusType[] = [
  { id: 'b1', name: 'Mini Bus', capacity: 20 },
  { id: 'b2', name: 'Reisebus', capacity: 50 },
];

const routes: Route[] = [
  {
    id: 'r1',
    name: 'Morgenroute',
    date: '2026-02-20',
    busNumber: '10',
    driverName: 'Alex',
    customerId: 'c1',
    customerName: 'Acme',
    customerContactName: 'Frau Müller',
    capacity: 10,
    stops: [{ id: 's1', location: 'Hauptbahnhof', arrivalTime: '08:00', departureTime: '08:05', boarding: 0, leaving: 0, currentTotal: 0 }],
    status: 'Aktiv',
    busTypeId: 'b2',
    operationalNotes: 'Sonderfahrt Messegelände',
  },
  {
    id: 'r2',
    name: 'Abendroute',
    date: '2026-02-18',
    busNumber: '12',
    driverName: 'Chris',
    customerId: 'c2',
    customerName: 'Beta',
    capacity: 8,
    stops: [{ id: 's2', location: 'Flughafen Terminal 1', arrivalTime: '20:00', departureTime: '20:10', boarding: 0, leaving: 0, currentTotal: 0 }],
    status: 'Entwurf',
    busTypeId: 'b1',
  },
];

describe('useRouteFiltering', () => {
  it('returns all routes when query is empty', () => {
    const { result } = renderHook(() => useRouteFiltering(routes, busTypes, ''));
    expect(result.current.filteredRoutes).toHaveLength(2);
    expect(result.current.isSearching).toBe(false);
  });

  it('filters by bus type name', () => {
    const { result } = renderHook(() => useRouteFiltering(routes, busTypes, 'reisebus'));
    expect(result.current.filteredRoutes).toHaveLength(1);
    expect(result.current.filteredRoutes[0].id).toBe('r1');
    expect(result.current.activeSection).toHaveLength(1);
    expect(result.current.otherSection).toHaveLength(0);
  });

  it('filters by driver name', () => {
    const { result } = renderHook(() => useRouteFiltering(routes, busTypes, 'chris'));
    expect(result.current.filteredRoutes).toHaveLength(1);
    expect(result.current.filteredRoutes[0].id).toBe('r2');
  });

  it('filters by status', () => {
    const { result } = renderHook(() => useRouteFiltering(routes, busTypes, 'entwurf'));
    expect(result.current.filteredRoutes).toHaveLength(1);
    expect(result.current.filteredRoutes[0].id).toBe('r2');
  });

  it('filters by German date format DD.MM.YYYY', () => {
    const { result } = renderHook(() => useRouteFiltering(routes, busTypes, '20.02.2026'));
    expect(result.current.filteredRoutes).toHaveLength(1);
    expect(result.current.filteredRoutes[0].id).toBe('r1');
  });

  it('filters by German date format D.M.YYYY', () => {
    const { result } = renderHook(() => useRouteFiltering(routes, busTypes, '20.2.2026'));
    expect(result.current.filteredRoutes).toHaveLength(1);
    expect(result.current.filteredRoutes[0].id).toBe('r1');
  });

  it('filters by German month name', () => {
    const { result } = renderHook(() => useRouteFiltering(routes, busTypes, 'februar'));
    expect(result.current.filteredRoutes).toHaveLength(2);
  });

  it('filters by stop location', () => {
    const { result } = renderHook(() => useRouteFiltering(routes, busTypes, 'hauptbahnhof'));
    expect(result.current.filteredRoutes).toHaveLength(1);
    expect(result.current.filteredRoutes[0].id).toBe('r1');
  });

  it('filters by partial stop location', () => {
    const { result } = renderHook(() => useRouteFiltering(routes, busTypes, 'flughafen'));
    expect(result.current.filteredRoutes).toHaveLength(1);
    expect(result.current.filteredRoutes[0].id).toBe('r2');
  });

  it('filters by customerContactName', () => {
    const { result } = renderHook(() => useRouteFiltering(routes, busTypes, 'müller'));
    expect(result.current.filteredRoutes).toHaveLength(1);
    expect(result.current.filteredRoutes[0].id).toBe('r1');
  });

  it('filters by operationalNotes', () => {
    const { result } = renderHook(() => useRouteFiltering(routes, busTypes, 'messegelände'));
    expect(result.current.filteredRoutes).toHaveLength(1);
    expect(result.current.filteredRoutes[0].id).toBe('r1');
  });

  it('sorts active routes descending by date', () => {
    const withSecondActive: Route[] = [
      ...routes,
      {
        ...routes[1],
        id: 'r3',
        name: 'Spät',
        status: 'Aktiv',
        date: '2026-02-21',
      },
    ];

    const { result } = renderHook(() => useRouteFiltering(withSecondActive, busTypes, ''));
    expect(result.current.activeSection.map(route => route.id)).toEqual(['r3', 'r1']);
  });

  it('is case-insensitive', () => {
    const { result } = renderHook(() => useRouteFiltering(routes, busTypes, 'MORGENROUTE'));
    expect(result.current.filteredRoutes).toHaveLength(1);
    expect(result.current.filteredRoutes[0].id).toBe('r1');
  });
});
