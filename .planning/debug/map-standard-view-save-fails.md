---
status: awaiting_human_verify
trigger: "Investigate issue: map-standard-view-save-fails\n\nSummary: User cannot save default map view in settings on the new Map Screen. User suspects relation to map view in schedule/flow planner creation where saving also fails."
created: 2026-03-03T00:00:00Z
updated: 2026-03-03T11:06:41Z
---

## Current Focus

hypothesis: Fix is implemented and verified locally; need user workflow confirmation in real app environment.
test: Human verification across both reproduction paths (Map Screen settings and planner creation).
expecting: Saving default map view in either context persists and reloads consistently in both.
next_action: request user to run original reproduction steps and confirm result

## Symptoms

expected: Saving default map view in settings persists and can be reloaded; saving during flow/schedule planner creation also persists.
actual: Save action does not persist in both contexts.
errors: Unknown yet; likely no explicit frontend error shown.
reproduction: Open new Map Screen settings, change default view, click save -> state is not saved. In flow planner creation map view saving also fails similarly.
started: Issue noticed after introducing new Map Screen; exact start unknown.

## Eliminated

- hypothesis: Map save fails because `toMapDefaultView` rejects persisted payload format.
  evidence: `toMapDefaultView` only requires numeric `lat/lon` and defaults `zoom`; save payload writes numeric values.
  timestamp: 2026-03-03T10:56:05Z

- hypothesis: `map_page_default` key is blocked by DB key constraint/policy.
  evidence: historical table/policy SQL shows no key-name constraint on `busflow_app_settings`; policies are role/account scoped, not key scoped.
  timestamp: 2026-03-03T10:57:45Z

## Evidence

- timestamp: 2026-03-03T10:47:37Z
  checked: repository-wide text search for map/default view persistence
  found: `BusflowApp.tsx` defines `handleSaveMapDefaultView` calling `BusFlowApi.upsertMapDefaultView`; map feature files and settings panel files exist in both legacy `apps/busflow` and new `features/map` paths.
  implication: a shared persistence path likely exists and may be used by both failing contexts.

- timestamp: 2026-03-03T10:48:58Z
  checked: `BusflowApp.tsx` and `src/apps/busflow/api/settings.api.ts`
  found: settings save handler calls `BusFlowApi.upsertMapDefaultView`, which writes key `map_default` in `busflow_app_settings` via update-then-insert helper (`writeAppSetting`).
  implication: legacy planner/settings persistence path appears structurally valid; failure may be in call path divergence, permissions, or key mismatch with new Map Screen.

- timestamp: 2026-03-03T10:50:45Z
  checked: `src/features/map/pages/MapPage.tsx`, `src/features/map/pages/MapSettingsPanel.tsx`, and `src/apps/busflow/hooks/useBusflowData.ts`
  found: new Map Screen loads/saves default view via `getMapPageDefaultView`/`upsertMapPageDefaultView` (`key='map_page_default'`), while planner/route editor data load uses `getMapDefaultView` (`key='map_default'`).
  implication: settings changed on new Map Screen are intentionally isolated from planner defaults, so users can perceive “save not working” cross-context even when writes succeed.

- timestamp: 2026-03-03T10:52:41Z
  checked: migration/schema references for `busflow_app_settings`
  found: active `supabase/migrations` folder does not contain table/policy definitions for `busflow_app_settings`; repository references exist mainly in `docs/migrations` historical SQL.
  implication: immediate code-level fix should avoid relying on uncertain historical DB migration assumptions; safest path is unifying key usage in app code.

- timestamp: 2026-03-03T10:54:34Z
  checked: `src/apps/busflow/api/index.ts`, `src/apps/busflow/components/settings/MapDefaultViewPanel.tsx`, and save/load handlers in map pages
  found: API exports are correct; legacy settings panel saves `map_default`, new Map Screen saves `map_page_default`, and planner/route editor consumes `map_default`.
  implication: one user-facing “default map view” concept is persisted in two independent keys, causing mismatch between map screen and planner behavior.

- timestamp: 2026-03-03T10:56:05Z
  checked: `src/apps/busflow/api/shared.ts` map normalization
  found: `toMapDefaultView` only validates numeric `lat/lon` and defaults zoom; no key-dependent behavior.
  implication: parsing/normalization is unlikely to be the save failure root cause.

- timestamp: 2026-03-03T10:57:45Z
  checked: historical DDL/policies in `docs/migrations/supabase_migration_phase13_map_default_settings.sql` and phase24 RLS docs
  found: no constraint limiting allowed key names in `busflow_app_settings`; policies are account/role based, not key-specific.
  implication: `map_page_default` is not obviously blocked by schema constraints; strongest evidence remains logical split between two default-view keys.

- timestamp: 2026-03-03T11:02:33Z
  checked: `src/apps/busflow/api/settings.api.ts`
  found: `getMapPageDefaultView` now reads shared `getMapDefaultView()` first and falls back to legacy `map_page_default`; `upsertMapPageDefaultView` now delegates to `upsertMapDefaultView` (shared `map_default` key).
  implication: both Map Screen and planner now converge on one persisted default-view setting while retaining backward-read compatibility.

- timestamp: 2026-03-03T11:06:41Z
  checked: local verification commands
  found: `npm run typecheck` passed; `npm run test -- src/apps/busflow` passed (14/14 tests in `useRouteFiltering.test.ts`).
  implication: fix compiles and no immediate regression surfaced in targeted busflow tests.

## Resolution

root_cause: New Map Screen persisted default view under `busflow_app_settings.key = 'map_page_default'`, while planner/settings logic reads and writes `key = 'map_default'`; users experienced non-persistence across contexts because the app treated one concept as two separate settings.
fix: Unified map default view persistence to shared `map_default` path by delegating `upsertMapPageDefaultView` to `upsertMapDefaultView` and reading shared value first in `getMapPageDefaultView` with fallback to legacy `map_page_default`.
verification: Static/type and targeted test verification passed locally; pending human verification of end-to-end save/reload behavior in Map Screen + planner workflows.
files_changed: [src/apps/busflow/api/settings.api.ts]
