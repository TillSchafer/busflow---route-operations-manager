---
status: investigating
trigger: "Ne leider kommen auch zwei verschiedene Loader. In den Bildern sieht man einmal den alten \"Lade BusFlow Daten...\" Leaf-Screen und einmal den neuen Card-Loader."
created: 2026-02-27T11:24:00Z
updated: 2026-02-27T11:24:00Z
---

## Current Focus

hypothesis: BusFlow route still renders legacy page-local loader in parallel with global canonical loading system.
test: Trace BusFlow render branches and its data hook loading signal usage.
expecting: If true, BusFlow component will have an `if (loading)` branch rendering old full-page loader.
next_action: Capture root cause and missing migration work in UAT gap diagnostics.

## Symptoms

expected: Route transitions and app data loading should show one canonical full-page loader variant only.
actual: Two distinct loaders appear: legacy "Lade BusFlow Daten..." screen and new canonical card loader.
errors: None reported.
reproduction: Navigate to `/busflow` during loading and observe alternating loader variants.
started: Discovered during Phase 01 UAT Test 2 on 2026-02-27.

## Eliminated

- hypothesis: "Only Suspense fallback duplicates loader; BusFlow app itself has no local loader."
  evidence: `BusflowApp.tsx` contains explicit `if (loading)` branch with `Leaf` spinner and legacy copy.
  timestamp: 2026-02-27T11:24:00Z

## Evidence

- timestamp: 2026-02-27T11:24:00Z
  checked: src/apps/busflow/BusflowApp.tsx
  found: Legacy full-screen loader block renders `Leaf` icon and text "Lade BusFlow Daten...".
  implication: Canonical loader cannot be single source of truth for BusFlow transitions.

- timestamp: 2026-02-27T11:24:00Z
  checked: src/apps/busflow/hooks/useBusflowData.ts
  found: Hook manages local `loading` state and exposes it directly to BusFlow page.
  implication: Data bootstrapping bypasses shared loading lifecycle API.

- timestamp: 2026-02-27T11:24:00Z
  checked: src/app/router/AppRouter.tsx
  found: Router already emits canonical loading through `RouteLoadingFallback`.
  implication: Mixed loader experience comes from BusFlow local branch, not router fallback wiring alone.

## Resolution

root_cause: BusFlow retains legacy local loading UI and state path, resulting in mixed global/local loader rendering.
fix: Pending gap-closure migration to shared loading contract and removal of legacy loader branch.
verification: Pending execution and rerun of UAT tests 1 and 2.
files_changed: []
