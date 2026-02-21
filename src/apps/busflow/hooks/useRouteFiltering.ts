import { useMemo } from 'react';
import { BusType, Route } from '../types';

interface RouteFilteringResult {
  filteredRoutes: Route[];
  activeSection: Route[];
  otherSection: Route[];
  isSearching: boolean;
}

export function useRouteFiltering(routes: Route[], busTypes: BusType[], searchQuery: string): RouteFilteringResult {
  const isSearching = searchQuery.length > 0;

  const filteredRoutes = useMemo(() => {
    if (!searchQuery) return routes;
    const q = searchQuery.toLowerCase();
    return routes.filter(route => {
      const busTypeName = busTypes.find(b => b.id === route.busTypeId)?.name || '';
      return (
        route.name.toLowerCase().includes(q) ||
        (route.driverName || '').toLowerCase().includes(q) ||
        (route.customerName || '').toLowerCase().includes(q) ||
        (route.busNumber || '').toLowerCase().includes(q) ||
        (route.status || '').toLowerCase().includes(q) ||
        (route.date || '').includes(q) ||
        busTypeName.toLowerCase().includes(q)
      );
    });
  }, [routes, busTypes, searchQuery]);

  const activeSection = useMemo(
    () => filteredRoutes.filter(r => r.status === 'Aktiv').sort((a, b) => b.date.localeCompare(a.date)),
    [filteredRoutes]
  );

  const otherSection = useMemo(
    () => filteredRoutes.filter(r => r.status !== 'Aktiv').sort((a, b) => b.date.localeCompare(a.date)),
    [filteredRoutes]
  );

  return { filteredRoutes, activeSection, otherSection, isSearching };
}
