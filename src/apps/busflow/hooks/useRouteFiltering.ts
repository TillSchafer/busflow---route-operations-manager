import { useMemo } from 'react';
import { BusType, Route } from '../types';

interface RouteFilteringResult {
  filteredRoutes: Route[];
  activeSection: Route[];
  otherSection: Route[];
  isSearching: boolean;
}

const GERMAN_MONTHS = [
  'januar', 'februar', 'märz', 'april', 'mai', 'juni',
  'juli', 'august', 'september', 'oktober', 'november', 'dezember',
];

/**
 * Builds a lowercased search string with multiple date formats from an ISO date string.
 * e.g. "2026-03-01" → "2026-03-01 1.3.2026 01.03.2026 märz 2026"
 */
function buildDateSearchString(isoDate: string): string {
  const parts = isoDate.split('-');
  if (parts.length !== 3) return isoDate.toLowerCase();
  const [year, month, day] = parts;
  const monthIdx = parseInt(month, 10) - 1;
  const monthName = GERMAN_MONTHS[monthIdx] ?? '';
  const dayNum = parseInt(day, 10);
  const monthNum = parseInt(month, 10);
  return `${isoDate} ${dayNum}.${monthNum}.${year} ${String(dayNum).padStart(2, '0')}.${String(monthNum).padStart(2, '0')}.${year} ${monthName} ${year}`;
}

export function useRouteFiltering(routes: Route[], busTypes: BusType[], searchQuery: string): RouteFilteringResult {
  const isSearching = searchQuery.length > 0;

  const filteredRoutes = useMemo(() => {
    if (!searchQuery) return routes;
    const q = searchQuery.toLowerCase().trim();
    if (!q) return routes;

    return routes.filter(route => {
      const busTypeName = busTypes.find(b => b.id === route.busTypeId)?.name ?? '';
      const dateSearch = buildDateSearchString(route.date ?? '');
      const stopLocations = route.stops.map(s => s.location).join(' ');

      return (
        route.name.toLowerCase().includes(q) ||
        (route.driverName ?? '').toLowerCase().includes(q) ||
        (route.customerName ?? '').toLowerCase().includes(q) ||
        (route.customerContactName ?? '').toLowerCase().includes(q) ||
        (route.busNumber ?? '').toLowerCase().includes(q) ||
        (route.status ?? '').toLowerCase().includes(q) ||
        dateSearch.toLowerCase().includes(q) ||
        busTypeName.toLowerCase().includes(q) ||
        (route.operationalNotes ?? '').toLowerCase().includes(q) ||
        stopLocations.toLowerCase().includes(q)
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
