BusFlow Route Operations Manager - Context

Overview
- React + Vite single-page app for managing bus routes, stops, and passenger load.
- Main features: route list, route editor, print preview, CSV export, passenger load chart.
- State stored in localStorage under key `busflow_routes_v1`.

Entry Points
- `index.html`: loads Tailwind CDN + Google Inter font, importmap for React, Recharts, lucide-react, and mounts `index.tsx`.
- `index.tsx`: React root mounting `App`.
- `App.tsx`: top-level state, route list/editor/print view, localStorage persistence.

Core Data Types (`types.ts`)
- `Route`: id, name, date, busNumber, driverName, capacity, status ('Draft' | 'Published'), stops.
- `Stop`: id, location, arrivalTime, departureTime, boarding, leaving, currentTotal, notes?.

App Flow (`App.tsx`)
- Manages `routes`, `currentRoute`, and `view` ('LIST' | 'EDITOR' | 'PRINT').
- On load: reads localStorage; normalizes routes/stops; falls back to default example data if missing or invalid.
- On save: persists routes to localStorage.
- `normalizeRoute` recalculates stop `currentTotal` sequentially and sanitizes numbers.
- Printing: switches to PRINT view then calls `window.print()`. Print overlay uses `PrintPreview`.

Key Components
- `components/RouteList.tsx`:
  - Displays route cards, capacity load bar, actions for edit/print/delete/export.
  - CSV export creates a file from route/stops data (safe filename fallback).
  - Capacity load uses safe capacity guard to avoid divide-by-zero.
- `components/RouteEditor.tsx`:
  - Form for route metadata + editable stop table.
  - `updatedStops` recomputes `currentTotal` via useMemo.
  - Validations: required name, capacity > 0, capacity overflow, negative totals, arrival after departure.
  - CSV export for the currently edited route.
- `components/PassengerChart.tsx`:
  - Recharts area chart of passenger totals with capacity reference line.
- `components/PrintPreview.tsx`:
  - Printable layout with route metadata, stop table, and driver instructions.

Storage
- Local storage key: `busflow_routes_v1`.
- Content: array of `Route`. Normalization is applied on load to ensure `currentTotal` and numeric fields are consistent.

UI / Styling
- Tailwind via CDN in `index.html`. Global print styles hide `.no-print` and show `.print-only`.
- Print view uses `PrintPreview` rendered inside a `.print-only` container in `App.tsx`.

Known Behaviors / Notes
- Print is triggered after setting view to PRINT (via setTimeout).
- CSV download uses Blob + object URL, then programmatic click.
- Default sample route in `App.tsx` if no data exists or parse fails.

Suggested Next Maintenance
- If adding fields to `Route` or `Stop`, update normalization in `App.tsx` and CSV export in `RouteEditor.tsx` and `RouteList.tsx`.
- If adding new views, extend `view` union in `App.tsx`.
