# Roadmap: BusFlow Unified Loading Experience

## Overview

This roadmap upgrades BusFlow’s loading behavior from inconsistent, page-local variants to one platform-level loading system with clear messaging, safe async lifecycle handling, and full coverage across routes and user actions. The phases are ordered to establish a stable foundation first, then roll out integrations, then harden quality before broad ongoing execution.

## Phases

**Phase Numbering:**
- Integer phases (1, 2, 3): Planned milestone work
- Decimal phases (2.1, 2.2): Urgent insertions (marked with INSERTED)

Decimal phases appear between their surrounding integers in numeric order.

- [x] **Phase 1: Loading Core Foundation** - Build shared loading engine, lifecycle contract, and delayed reveal behavior. (completed 2026-02-27)
- [x] **Phase 2: Messaging + Route/Auth Integration** - Integrate route/auth loading and scoped message system with fallback behavior. (completed 2026-02-28)
- [ ] **Phase 3: Platform Action Coverage Rollout** - Wire all async action flows to the unified loading orchestration.
- [ ] **Phase 4: Accessibility + Consistency Cleanup** - Complete accessibility semantics and remove all legacy divergent loading variants.
- [ ] **Phase 5: Hardening, Tests, and Release Readiness** - Add regression coverage and verify operational stability.

## Phase Details

### Phase 1: Loading Core Foundation
**Goal**: Introduce one global loading infrastructure that can safely coordinate async operations.
**Depends on**: Nothing (first phase)
**Requirements**: [LOAD-01, LOAD-02, LOAD-03, LOAD-04, FLOW-01, FLOW-02, QUAL-01]
**Success Criteria** (what must be TRUE):
  1. Platform renders one canonical full-page loading component from shared infrastructure.
  2. Loading overlay appears only after configured short delay for pending actions.
  3. Every loading start has guaranteed stop/cleanup behavior, including error paths.
**Plans**: 5 plans

Plans:
- [x] 01-01-PLAN.md — Build loading lifecycle engine + provider contract with cleanup/concurrency tests.
- [x] 01-02-PLAN.md — Build canonical full-page loading screen and spinner adapter behavior.
- [x] 01-03-PLAN.md — Integrate loading foundation into app root and replace baseline fallback wiring.
- [x] 01-04-PLAN.md — Align canonical loading visual contract (spinner/style/background variants) with UAT findings.
- [x] 01-05-PLAN.md — Remove BusFlow legacy loader path and route startup loading into shared lifecycle manager.

### Phase 2: Messaging + Route/Auth Integration
**Goal**: Standardize loading copy and ensure route/auth transitions use unified loading behavior.
**Depends on**: Phase 1
**Requirements**: [LOAD-03, FLOW-01, FLOW-02]
**Success Criteria** (what must be TRUE):
  1. Loading messages are scope-driven, and fallback `Lade...` is applied when no specific text exists.
  2. Route/lazy navigation uses unified loading behavior consistently.
  3. Initial auth/session/account hydration uses unified loading behavior consistently.
**Plans**: 3 plans

Plans:
- [x] 02-01: Add scoped loading message registry and fallback policy.
- [x] 02-02: Connect AppRouter lazy/route transitions to loading manager.
- [x] 02-03: Connect auth/session/account hydration flow to loading manager.

### Phase 3: Platform Action Coverage Rollout
**Goal**: Ensure all critical user-triggered async actions are covered by the shared loading system.
**Depends on**: Phase 2
**Requirements**: [FLOW-03, FLOW-04, QUAL-03]
**Success Criteria** (what must be TRUE):
  1. Save/delete/invite/import/profile-security operations trigger consistent loading feedback.
  2. Concurrent async actions keep loader visibility accurate until all operations complete.
  3. Async flow inventory exists and shows complete coverage of loading-prone user flows.
**Plans**: 3 plans

Plans:
- [ ] 03-01: Build reusable loading action wrapper/helper for async handlers.
- [ ] 03-02: Roll out integration across Profile/Admin/Owner/BusFlow action paths.
- [ ] 03-03: Create and maintain async coverage inventory document/checklist.

### Phase 4: Accessibility + Consistency Cleanup
**Goal**: Finalize accessible loading semantics and remove all divergent legacy loading variants.
**Depends on**: Phase 3
**Requirements**: [A11Y-01, A11Y-02, QUAL-01]
**Success Criteria** (what must be TRUE):
  1. Global loading state announces accessible status via screenreader semantics.
  2. Reduced-motion users receive loading behavior without excessive animation.
  3. Legacy loading texts/components are removed or migrated to the unified system.
**Plans**: 2 plans

Plans:
- [ ] 04-01: Implement and validate accessibility semantics (`aria-busy`, SR status, reduced motion).
- [ ] 04-02: Remove/migrate all legacy loading variants and verify visual consistency.

### Phase 5: Hardening, Tests, and Release Readiness
**Goal**: Add regression safety and confirm stable behavior before broad operational usage.
**Depends on**: Phase 4
**Requirements**: [QUAL-02]
**Success Criteria** (what must be TRUE):
  1. Automated tests verify delay behavior and cleanup reliability.
  2. Loading regressions in key route/action paths are covered by test suite.
  3. Quality gate (`npm run check` + tests) passes with unified loading changes.
**Plans**: 2 plans

Plans:
- [ ] 05-01: Add unit/component tests for loading manager, delay, and cleanup contracts.
- [ ] 05-02: Run hardening pass across key flows and finalize release checklist.

## Progress

**Execution Order:**
Phases execute in numeric order: 2 → 2.1 → 2.2 → 3 → 3.1 → 4

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Loading Core Foundation | 5/5 | Complete    | 2026-02-27 |
| 2. Messaging + Route/Auth Integration | 3/3 | Complete | 2026-02-28 |
| 3. Platform Action Coverage Rollout | 0/3 | Not started | - |
| 4. Accessibility + Consistency Cleanup | 0/2 | Not started | - |
| 5. Hardening, Tests, and Release Readiness | 0/2 | Not started | - |
