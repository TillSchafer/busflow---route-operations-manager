# Roadmap: BusPilot Fertigstellung (v1.1)

## Overview

This roadmap covers milestone v1.1 only and continues phase numbering from the previous roadmap (max phase 8). Scope is brownfield hardening for MVP 1.0 launch-readiness: preserve existing auth/registration and route CRUD concepts while finalizing permissions, validation, settings, lifecycle behavior, database integrity, and performance.

## Phases

- [ ] **Phase 9: Role Visibility and Enforcement Finalization** - Finalize role-based visibility and authorization behavior across core flows.
- [ ] **Phase 10: Route Validation Contract Finalization** - Finalize client/server validation parity for route creation and editing.
- [ ] **Phase 11: User Settings Completion** - Complete profile and security-relevant settings with clear permission boundaries.
- [ ] **Phase 12: Launch-Ready Data Model Hardening** - Enforce schema integrity, reproducible migrations, and index-ready access paths.
- [ ] **Phase 13: Route Lifecycle Finalization** - Finalize archive, restore, and hard-delete behavior with role-aware safety.
- [ ] **Phase 14: Performance Hardening and Measurement Closure** - Deliver measured performance improvements and stable loading behavior in key flows.

## Phase Details

### Phase 9: Role Visibility and Enforcement Finalization
**Goal**: Users can only see and execute actions allowed by their role, with matching frontend and backend enforcement.
**Depends on**: Phase 8
**Requirements**: ROLE-01, ROLE-02, ROLE-03
**Success Criteria** (what must be TRUE):
  1. Users only see pages, route data, and action controls permitted for their role in core flows.
  2. Direct navigation or client manipulation cannot expose unauthorized pages, data, or actions.
  3. Unauthorized requests are blocked server-side and return clear permission errors.
  4. A role-to-action matrix for core flows exists and is verified against real role scenarios.
**Plans**: TBD

### Phase 10: Route Validation Contract Finalization
**Goal**: Route create/edit operations are blocked on invalid input with consistent, understandable feedback from client and server.
**Depends on**: Phase 9
**Requirements**: RVAL-01, RVAL-02, RVAL-03
**Success Criteria** (what must be TRUE):
  1. Users cannot save a route with missing required fields and see field-specific errors.
  2. Users cannot save a route that violates domain rules and receive understandable corrective feedback.
  3. Server responses enforce the same validation contract as the client, including manipulated payload attempts.
  4. Valid route payloads save successfully and remain consistent after reload.
**Plans**: TBD

### Phase 11: User Settings Completion
**Goal**: Users can manage allowed profile and security settings reliably, with clear confirmations and error handling.
**Depends on**: Phase 9, Phase 10
**Requirements**: SETT-01, SETT-02, SETT-03
**Success Criteria** (what must be TRUE):
  1. Profile setting changes are persisted and correctly visible after page reload.
  2. Security-relevant settings actions provide explicit confirmation and clear success/error outcomes.
  3. Users cannot change settings outside their permission scope in either UI or backend calls.
  4. Failed settings operations do not leave partially applied or unclear account state.
**Plans**: TBD

### Phase 12: Launch-Ready Data Model Hardening
**Goal**: Core data integrity rules are enforced by schema and migrations, with query performance support for MVP usage patterns.
**Depends on**: Phase 10
**Requirements**: DATA-01, DATA-02, DATA-03, DATA-04
**Success Criteria** (what must be TRUE):
  1. A clean database can apply migrations reproducibly and boot a working staging environment.
  2. Invalid or duplicate core records are rejected by enforced constraints rather than silently accepted.
  3. Core list/detail/filter/sort flows use index-backed query paths that remain responsive under expected load.
  4. Archive-lifecycle relations maintain referential integrity without orphaned core references.
**Plans**: TBD

### Phase 13: Route Lifecycle Finalization
**Goal**: Archive, restore, and hard-delete operations follow one explicit, role-aware lifecycle policy.
**Depends on**: Phase 9, Phase 12
**Requirements**: LIFE-01, LIFE-02, LIFE-03, LIFE-04
**Success Criteria** (what must be TRUE):
  1. Authorized users can archive routes and archived records are removed from active default views.
  2. Authorized users can restore archived routes per policy and see them reappear in active views.
  3. Hard-delete is restricted to permitted roles and repeated delete requests remain idempotent.
  4. Archived routes only appear when explicitly requested via archive-aware views/filters.
**Plans**: TBD

### Phase 14: Performance Hardening and Measurement Closure
**Goal**: Core user flows are measurably faster and loading behavior is consistent and reliable.
**Depends on**: Phase 9, Phase 10, Phase 11, Phase 12, Phase 13
**Requirements**: PERF-01, PERF-02, PERF-03
**Success Criteria** (what must be TRUE):
  1. Baseline and post-hardening measurements for route list, route detail, and core mutations are documented with one consistent method.
  2. Users can navigate route list/detail flows without unnecessary duplicate requests.
  3. Critical mutation flows present consistent loading states and never leave stuck loaders.
  4. Post-hardening measurements show clear improvement versus baseline in prioritized core flows.
**Plans**: TBD

## Progress

**Execution Order:**
9 -> 10 -> 11 -> 12 -> 13 -> 14

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 9. Role Visibility and Enforcement Finalization | 0/TBD | Not started | - |
| 10. Route Validation Contract Finalization | 0/TBD | Not started | - |
| 11. User Settings Completion | 0/TBD | Not started | - |
| 12. Launch-Ready Data Model Hardening | 0/TBD | Not started | - |
| 13. Route Lifecycle Finalization | 0/TBD | Not started | - |
| 14. Performance Hardening and Measurement Closure | 0/TBD | Not started | - |
