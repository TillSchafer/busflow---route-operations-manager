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
    capacity: 10,
    stops: [],
    status: 'Aktiv',
    busTypeId: 'b2',
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
    stops: [],
    status: 'Entwurf',
    busTypeId: 'b1',
  },
];

describe('useRouteFiltering', () => {
  it('filters by query and keeps section split', () => {
    const { result } = renderHook(() => useRouteFiltering(routes, busTypes, 'reisebus'));

    expect(result.current.filteredRoutes).toHaveLength(1);
    expect(result.current.filteredRoutes[0].id).toBe('r1');
    expect(result.current.activeSection).toHaveLength(1);
    expect(result.current.otherSection).toHaveLength(0);
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
});
