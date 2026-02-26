# Requirements: BusFlow Unified Loading Experience

**Defined:** 2026-02-26
**Core Value:** Every waiting state feels predictable and trustworthy because users always see a clear, consistent loading experience.

## v1 Requirements

Requirements for initial release. Each maps to roadmap phases.

### Loading Foundation

- [x] **LOAD-01**: Platform uses one shared full-page loading screen component as the canonical loading UI.
- [x] **LOAD-02**: Loading screen appears only after a short delay threshold to avoid flicker on fast actions.
- [ ] **LOAD-03**: Loading system supports action-specific messages and uses `Lade...` as fallback text.
- [x] **LOAD-04**: Loading lifecycle is managed through a centralized start/stop contract that guarantees cleanup on success, error, and cancellation.

### Flow Coverage

- [ ] **FLOW-01**: Route-based/lazy view transitions show the shared loading screen consistently.
- [ ] **FLOW-02**: Initial auth/session/account hydration shows the shared loading screen consistently.
- [ ] **FLOW-03**: Critical mutation actions (save, delete, invite, import, profile security actions) trigger the shared loading screen consistently.
- [ ] **FLOW-04**: Concurrent async actions are handled correctly so loading visibility remains accurate until all active operations are complete.

### Accessibility

- [ ] **A11Y-01**: Loading state exposes accessibility semantics (`aria-busy` and screenreader-readable status text).
- [ ] **A11Y-02**: Loading UI supports reduced-motion behavior via `prefers-reduced-motion`.

### Quality & Consistency

- [ ] **QUAL-01**: Legacy divergent loading variants/texts (e.g., `Lade Ansicht`, `Lade BusFlow`) are removed or fully mapped into the unified system.
- [ ] **QUAL-02**: Loading orchestration logic has automated tests for delay behavior and cleanup behavior.
- [ ] **QUAL-03**: A documented async flow inventory confirms no loading-prone user flow is left uncovered.

## v2 Requirements

Deferred to future release. Tracked but not in current roadmap.

### Enhanced Feedback

- **ENH-01**: Long-running operations show progressive stages (e.g., preparing/importing/finalizing).
- **ENH-02**: Loading telemetry events are tracked by scope for performance analysis.
- **ENH-03**: Configurable timeout/escalation UX for unusually long waits.

## Out of Scope

Explicitly excluded. Documented to prevent scope creep.

| Feature | Reason |
|---------|--------|
| Full visual redesign of unrelated app areas | Not required to solve loading consistency problem |
| Business workflow changes (routing/auth/tenant semantics) beyond loading orchestration | This initiative is UX/system consistency hardening, not product logic redesign |
| Replacing the existing frontend stack/framework | Current stack already supports required solution |

## Traceability

Which phases cover which requirements. Updated during roadmap creation.

| Requirement | Phase | Status |
|-------------|-------|--------|
| LOAD-01 | Phase 1 | Complete |
| LOAD-02 | Phase 1 | Complete |
| LOAD-03 | Phase 2 | Pending |
| LOAD-04 | Phase 1 | Complete |
| FLOW-01 | Phase 2 | Pending |
| FLOW-02 | Phase 2 | Pending |
| FLOW-03 | Phase 3 | Pending |
| FLOW-04 | Phase 3 | Pending |
| A11Y-01 | Phase 4 | Pending |
| A11Y-02 | Phase 4 | Pending |
| QUAL-01 | Phase 4 | Pending |
| QUAL-02 | Phase 5 | Pending |
| QUAL-03 | Phase 3 | Pending |

**Coverage:**
- v1 requirements: 13 total
- Mapped to phases: 13
- Unmapped: 0 ✓

---
*Requirements defined: 2026-02-26*
*Last updated: 2026-02-26 after roadmap traceability mapping*
