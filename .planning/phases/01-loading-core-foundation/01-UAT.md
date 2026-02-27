---
status: complete
phase: 01-loading-core-foundation
source: [01-01-SUMMARY.md, 01-02-SUMMARY.md, 01-03-SUMMARY.md]
started: 2026-02-27T08:25:11Z
updated: 2026-02-27T11:15:00Z
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
  root_cause: ""
  artifacts: []
  missing: []
  debug_session: ""

- truth: "Route transitions must render exactly one canonical loader variant, not mixed legacy and new loader screens."
  status: failed
  reason: "User reported: two different loaders appear (legacy 'Lade BusFlow Daten...' and new card loader)."
  severity: major
  test: 2
  root_cause: ""
  artifacts: []
  missing: []
  debug_session: ""
