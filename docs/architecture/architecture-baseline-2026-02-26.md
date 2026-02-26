# Architecture Baseline (2026-02-26)

## Scope
Baseline snapshot captured before modular refactor rollout.

## App footprint
- Total tracked source files (repo): `198`
- Total lines in `src/` (`.ts/.tsx/.css`): `10813`

## Largest frontend hotspots
- `src/pages/PlatformAdmin.tsx` — 932 LOC
- `src/apps/busflow/components/RouteEditor.tsx` — 776 LOC
- `src/apps/busflow/components/settings/CustomerManagementPanel.tsx` — 636 LOC
- `src/apps/busflow/BusflowApp.tsx` — 619 LOC
- `src/pages/TeamAdmin.tsx` — 575 LOC
- `src/App.tsx` — 491 LOC

## Duplication indicators
- Canonical input utility class occurrences: `30`
- Canonical primary button utility class occurrences: `8`
- Modal overlay base class occurrences: `3`
- Auth callback parsing duplicated across:
  - `src/pages/AcceptInvite.tsx`
  - `src/pages/AccountSecurity.tsx`

## Dead/Orphan candidates (pre-refactor)
- `components/ui/background-shader.tsx`
- `lib/utils.ts`
- `src/apps/busflow/components/route-editor/CustomerContactSelector.tsx` (not wired yet at baseline)
- `src/shared/api/admin/support.api.ts` (no runtime caller)

## Quality-gate baseline
Command: `npm run check`
- `typecheck`: pass
- `lint`: fail (Node globals/fetch not configured for `scripts/supabase/*.mjs`)
- `build`: not reached in full check run (baseline failure in lint)

## Bundle baseline
Command: `npm run build`
- Main JS chunk: `dist/assets/index-fl8RHRuo.js` — `632.38 kB` (gzip `173.00 kB`)
- Warning present: chunk larger than 500kB threshold.

## Supabase function baseline
- Local edge functions present: `12` + `_shared`
- Local config: `supabase/config.toml` with `verify_jwt=false` on all active functions

