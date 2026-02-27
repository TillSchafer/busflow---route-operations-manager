---
status: diagnosed
phase: 01-loading-core-foundation
source: [01-01-SUMMARY.md, 01-02-SUMMARY.md, 01-03-SUMMARY.md]
started: 2026-02-27T08:25:11Z
updated: 2026-02-27T11:24:00Z
---

## Current Test

[testing complete]

## Tests

### 1. Initial App Hydration Loader
expected: On a hard refresh while auth/session state is still loading, a full-page loading overlay appears with fallback text "Lade..." and not the legacy "Lade Ansicht ..." copy.
result: issue
reported: "Also die Ladeanimation ist nicht die, die ich dir gegeben habe. Zweitens der Text bzw generell wie die Animation aussieht ist nicht so wie besprochen. ... Warum nutzen wir nicht einen komplett weißen Hintergrund ... Sonst können wir doch einen Transparent hintergrund benutzen."
severity: major

### 2. Route Transition Uses Canonical Loader
expected: During lazy route transitions, the same full-page canonical loading overlay is used (not a different local fallback component/style).
result: issue
reported: "Ne leider kommen auch zwei verschiedene Loader. In den Bildern sieht man einmal den alten \"Lade BusFlow Daten...\" Leaf-Screen und einmal den neuen Card-Loader."
severity: major

### 3. Delay Behavior (No Flicker)
expected: For very fast transitions/actions, loading should not flash briefly; overlay should appear only when loading lasts long enough.
result: pass

### 4. Blocking Interaction While Visible
expected: While the full-page loader is visible, background UI is non-interactive (no accidental clicks), but the previous screen remains faintly visible.
result: pass

### 5. Error Path Cleanup
expected: If an auth/route load path errors or is canceled, the loading overlay should dismiss normally and the app should not remain stuck behind a perpetual loader.
result: pass

### 6. Back-to-Back Loading Clarity
expected: During consecutive loading events, users still get clear loading feedback without ending up in an unclear blank/stuck state.
result: pass

## Summary

total: 6
passed: 4
issues: 2
pending: 0
skipped: 0

## Gaps

- truth: "Hydration and route-transition loader must use the agreed spinner and agreed visual treatment."
  status: failed
  reason: "User reported: Ladeanimation/Style/Text not as discussed; requests white background on hard screen changes or transparent background as alternative."
  severity: major
  test: 1
  root_cause: "Canonical loader UI diverged from agreed design: `FullPageLoadingScreen` hardcodes card + secondary helper copy ('Bitte einen Moment...') and dark-tinted backdrop, while spinner adapter currently renders a locally stubbed `components/ui/loader-15.tsx` instead of the provided loader package output."
  artifacts:
    - path: "src/shared/loading/FullPageLoadingScreen.tsx"
      issue: "Hardcoded card shell and secondary text diverge from agreed minimal style/background behavior."
    - path: "src/shared/loading/LoadingSpinner.tsx"
      issue: "Wrapper always consumes local `@/components/ui/loader-15` module, masking mismatch with requested spinner implementation."
    - path: "components/ui/loader-15.tsx"
      issue: "Local fallback spinner implementation does not match user-provided loader visual."
  missing:
    - "Align global loading surface with agreed visuals: no extra helper line, cleaner minimal typography, lighter overlay variant, optional transparent/white treatment by transition context."
    - "Replace local spinner stub with the actual provided loader-15 component implementation and keep a safe fallback path."
    - "Add regression test assertions for agreed text/background/spinner render contract."
  debug_session: ".planning/debug/loader-style-drift-and-spinner-mismatch.md"

- truth: "Route transitions must render exactly one canonical loader variant, not mixed legacy and new loader screens."
  status: failed
  reason: "User reported: two different loaders appear (legacy 'Lade BusFlow Daten...' and new card loader)."
  severity: major
  test: 2
  root_cause: "BusFlow page keeps an internal blocking loading branch (`if (loading)`) with `Leaf` spinner and 'Lade BusFlow Daten...' copy, so route/auth canonical overlay and app-local loader both exist in navigation flow."
  artifacts:
    - path: "src/apps/busflow/BusflowApp.tsx"
      issue: "Legacy full-page loading branch renders independent loader variant."
    - path: "src/apps/busflow/hooks/useBusflowData.ts"
      issue: "Hook exposes local `loading` boolean consumed directly by legacy branch instead of shared loading manager."
  missing:
    - "Remove/replace BusFlow-local full-page loader so route transitions rely on canonical global loading screen only."
    - "Bridge BusFlow data bootstrapping into shared loading lifecycle (`runWithLoading` or scoped token start/stop) instead of local blocking screen."
    - "Add integration test coverage ensuring legacy 'Lade BusFlow Daten...' screen never renders during transition/loading paths."
  debug_session: ".planning/debug/mixed-legacy-and-canonical-route-loader.md"
