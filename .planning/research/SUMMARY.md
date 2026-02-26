# Project Research Summary

**Project:** BusFlow Unified Loading Experience
**Domain:** Unified loading orchestration for brownfield React operations platform
**Researched:** 2026-02-26
**Confidence:** HIGH

## Executive Summary

The current platform has inconsistent loading behavior across modules, which directly harms user trust and creates uncertainty during async operations. Research indicates the right approach is not adding more local loaders, but introducing a single global loading orchestration layer with typed scopes, centralized messages, and guaranteed lifecycle cleanup.

For this project, the recommended path is to keep the current stack and add a shared loading foundation in `src/shared`, then progressively integrate all async routes and actions. This should include delayed reveal behavior, fallback text (`Lade...`), and accessibility semantics from day one.

Main risks are stuck loaders, over-blocking flicker, and incomplete rollout coverage. These are mitigated by token/ref-count lifecycle design, delayed display policy, and a strict integration checklist for all async actions.

## Key Findings

### Recommended Stack

Use the existing React + React Router + TypeScript + Tailwind + Supabase setup with no mandatory new dependencies. The critical upgrade is architectural: a centralized loading manager and full-page overlay component, not a tooling rewrite.

**Core technologies:**
- **React 19**: provider/hook patterns for global loading state
- **React Router 6**: route transition + lazy loading integration
- **TypeScript**: typed loading scopes/messages/contracts
- **Tailwind**: consistent full-page visual implementation
- **Supabase JS**: wrapped async data/function/auth calls

### Expected Features

**Must have (table stakes):**
- One platform-wide full-page loader
- Action-specific messages with fallback `Lade...`
- Delay threshold to avoid flicker
- Safe cleanup on all success/error/cancel paths
- A11y support (`aria-busy`, SR text, reduced motion)
- Coverage across all async actions

**Should have (competitive):**
- Scoped loading taxonomy and message registry
- Central wrapper helpers to prevent regressions

**Defer (v2+):**
- Rich progress staging for long operations
- Advanced telemetry dashboards

### Architecture Approach

Build a shared loading orchestration layer (`LoadingProvider`, `FullPageLoadingScreen`, `useLoadingAction`) and integrate it at app-root provider level. Route, admin, profile, and busflow async handlers should all use the same orchestration API so loader behavior is deterministic and consistent.

**Major components:**
1. **Loading provider/service** — source of truth for active loading scopes
2. **Full-page loading UI** — single canonical overlay with a11y semantics
3. **Integration wrappers/hooks** — safe wiring to route and async action calls

### Critical Pitfalls

1. **Loader deadlocks** — avoided via token + `finally` lifecycle enforcement
2. **Over-blocking flicker** — avoided via delayed reveal threshold
3. **Message drift** — avoided via centralized scoped message registry
4. **Coverage holes** — avoided via complete async inventory checklist
5. **A11y regressions** — avoided via explicit accessibility contract and verification

## Implications for Roadmap

Based on research, suggested phase structure:

### Phase 1: Loading Foundation
**Rationale:** Core infrastructure must exist before broad rollout.
**Delivers:** Loading provider, full-page component, message registry, delay logic, a11y contract.
**Addresses:** global consistency requirement.
**Avoids:** deadlock and message drift pitfalls.

### Phase 2: Platform-Wide Integration
**Rationale:** Apply foundation across all async flows systematically.
**Delivers:** Route/auth/admin/profile/busflow async actions wired to loading manager.
**Uses:** existing app router and API layers.
**Implements:** full coverage requirement.

### Phase 3: Hardening and Verification
**Rationale:** Ensure reliability and remove all legacy divergence.
**Delivers:** tests, edge-case cleanup validation, legacy loader removal, UX polish.
**Avoids:** regression and incomplete rollout risk.

### Phase Ordering Rationale

- Foundation first prevents duplicated integration work.
- Integration second ensures requested “all actions” coverage.
- Hardening third ensures stable launch quality and consistency verification.

### Research Flags

Phases likely needing deeper research during planning:
- **Phase 2:** Complete async flow inventory and mapping strategy by module.

Phases with standard patterns (skip deep research):
- **Phase 1:** Common React architecture patterns.
- **Phase 3:** Standard test/hardening process.

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | Existing stack already supports solution |
| Features | HIGH | User intent and platform gap are explicit |
| Architecture | HIGH | Established pattern fits current app design |
| Pitfalls | HIGH | Risks are directly observable in current state |

**Overall confidence:** HIGH

### Gaps to Address

- Exact async action inventory per module must be finalized during phase planning.
- Final copy tone for all scoped messages should be reviewed once integration map is complete.

## Sources

### Primary (HIGH confidence)
- Repository analysis (`src/app`, `src/shared`, `src/apps/busflow`, `src/pages`)
- Existing `.planning/codebase/*` map artifacts
- User-defined scope and acceptance criteria

### Secondary (MEDIUM confidence)
- React/Router architectural conventions for loading orchestration
- Web accessibility loading-state conventions

### Tertiary (LOW confidence)
- Competitive UX pattern inference from common SaaS behavior

---
*Research completed: 2026-02-26*
*Ready for roadmap: yes*
