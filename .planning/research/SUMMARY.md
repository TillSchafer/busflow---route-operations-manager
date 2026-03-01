# Project Research Summary

**Project:** BusPilot Route Operations Manager
**Domain:** Brownfield route-operations MVP hardening (React SPA + Supabase)
**Researched:** 2026-03-01
**Confidence:** HIGH

## Executive Summary

BusPilot is a brownfield operations product that already has working auth, account context, role-aware areas, and route CRUD, but it is not yet launch-ready for real user testing because reliability contracts are inconsistent across UI, API/functions, and database constraints. The research is clear that experts do not rebuild this class of product at this stage; they stabilize it by enforcing one permission contract, one validation contract, explicit data lifecycle states, and reproducible migration-first delivery.

The recommended approach is to keep the current stack (React 19, Router 6, TypeScript, Vite, Supabase) and harden it with targeted additions, especially shared capability resolution, shared validation modules, lifecycle-explicit APIs/RPCs, and DB integrity migrations. Performance work should be staged and measured in core paths (route list/detail/save/lifecycle actions), not done as broad caching changes.

Main risks are cross-layer drift: UI permissions diverging from RLS/functions, validation rules diverging from DB constraints, and archive/delete semantics remaining ambiguous. Mitigation is phase-based: lock a regression baseline first, define canonical role/lifecycle contracts early, ship additive migrations in controlled order, and enforce deployment consistency gates before release.

## Key Findings

### Recommended Stack

The stack research strongly supports staying on the existing platform and avoiding architecture rewrites. Current runtime versions are already suitable for v1.1 hardening, and the only explicit addition recommended is `zod` for shared validation contracts.

Core strategy is brownfield hardening: preserve React + Supabase boundaries, tighten contracts at validation/authorization/lifecycle boundaries, and instrument performance outcomes before claiming improvement.

**Core technologies:**
- **React 19.2.3 + React Router DOM 6.30.3:** route-boundary composition and guarded UI flows without rework.
- **TypeScript 5.8.3:** typed domain contracts for role visibility, validation, and lifecycle operations.
- **Vite 6.4.1:** existing bundler for measurable load-time tuning and stable deployment.
- **Supabase JS 2.95.3 (frontend):** unified auth/PostgREST/RPC/function invocation path in the current SPA.
- **Supabase Edge Functions (Deno std 0.224.0 + supabase-js 2.49.1):** audited backend boundary for privileged admin/security mutations.
- **Supabase Postgres migrations:** launch-readiness source of truth via `supabase/migrations`.
- **`zod` 3.24.x (add):** shared, typed validation rules across client and mutation boundaries.

### Expected Features

v1.1 is a launch-readiness milestone, not a feature-expansion milestone. Must-have scope is focused on core reliability and permission/data integrity.

**Must have (table stakes):**
- Measurably faster core workflows (route list/detail and key mutations).
- Final route validation rules with clear user-facing error feedback.
- Complete user settings flow for profile and security-sensitive actions.
- Explicit archive/delete lifecycle behavior with predictable outcomes.
- End-to-end role visibility and action enforcement (UI + backend).
- Launch-ready DB integrity (constraints, indexes, relation correctness).

**Should have (competitive):**
- Conflict-aware route writes with clear retry/error handling UX.
- Archive-first safety model with recoverability by default.
- Consistent async behavior across auth/admin/busflow/profile surfaces.

**Defer (v2+):**
- Tenant-customizable role builder.
- Broad realtime expansion across all surfaces.
- Advanced analytics/automation beyond MVP testability goals.

### Architecture Approach

Architecture research converges on four patterns: capability-driven gating, dual-layer validation, lifecycle-explicit mutations, and staged fetch/query shaping. This keeps existing concepts intact while closing reliability gaps.

**Major components:**
1. **Capability resolver (`shared/auth/capabilities.ts`)** — one role/scope contract for route visibility and action gating.
2. **Validation modules (`shared/validation` + `apps/busflow/validation`)** — shared rules and error taxonomy for UI/API consistency.
3. **BusFlow API facade + lifecycle API (`routes.api.ts`, `lifecycle.api.ts`)** — explicit archive/delete/restore behaviors and conflict-safe mutations.
4. **Migration/RPC layer (`supabase/migrations`)** — enforce lifecycle, constraints, and indexed read paths at DB boundary.

### Critical Pitfalls

1. **Core flow regression during hardening** — prevent with a non-negotiable regression suite before broad shared-layer changes.
2. **Permission drift across UI/RLS/edge functions** — prevent with one canonical role matrix and cross-layer scenario tests.
3. **Validation drift across forms, API, and DB** — prevent with shared rule contracts and same-payload tests across entrypoints.
4. **Archive/delete ambiguity and partial destructive outcomes** — prevent with explicit lifecycle states, idempotent workflows, and recovery runbooks.
5. **Migration/environment drift at release time** — prevent with migration-first governance and staging rehearsal from clean snapshots.

## Implications for Roadmap

Based on combined research, suggested phase structure:

### Phase 1: Core-Flow Safety Net + Baselines
**Rationale:** Stabilization work without regression and baseline metrics is high risk and unverifiable.
**Delivers:** Core regression suite (auth/account switch/route CRUD), flow-level performance baseline, release guardrails.
**Addresses:** Fast core UX and stable auth/session behavior.
**Avoids:** Core-flow regression and false optimization claims.

### Phase 2: Role/Scope Contract Alignment
**Rationale:** Permission semantics must be finalized before expanding lifecycle/settings behavior.
**Delivers:** Capability resolver, router/action gating alignment, UI/API/RLS role matrix tests.
**Addresses:** Role visibility and least-privilege execution requirements.
**Uses:** AuthContext + Router + edge-function/RLS boundaries.
**Avoids:** Split permission logic and visibility/execution mismatch.

### Phase 3: Validation + Data Contract Hardening
**Rationale:** Route/settings correctness and DB integrity depend on shared validation semantics.
**Delivers:** Shared validation modules (`zod`-based), consistent error mapping, additive DB constraints and integrity checks.
**Addresses:** Final route validation and launch-ready data consistency.
**Implements:** Dual-layer validation contract pattern.
**Avoids:** Validation drift and late-stage integrity regressions.

### Phase 4: Archive/Delete Lifecycle Finalization
**Rationale:** Lifecycle policy is high-risk/high-coupling and should be explicit before further optimization.
**Delivers:** Lifecycle API + RPC (`archive/restore/hard_delete`), finalized UX copy and policy, recovery/idempotency procedures.
**Addresses:** Delete/archive concept finalization and data safety.
**Implements:** Lifecycle-explicit architecture pattern.
**Avoids:** Destructive ambiguity, orphaned references, and partial outcomes.

### Phase 5: Performance + Freshness Hardening
**Rationale:** Optimize only after contracts are stable so speed improvements do not break correctness.
**Delivers:** Staged fetch, query shaping, targeted invalidation, index-aligned access paths, before/after measurements.
**Addresses:** Loading-time reduction across highest-frequency workflows.
**Uses:** Vite/router boundaries, BusFlow hooks, DB index migrations.
**Avoids:** Stale-state regressions from naive caching/debouncing.

### Phase 6: Launch Consistency + Security Debt Closure
**Rationale:** MVP launch depends on reproducible deployment and closure of temporary security posture exceptions.
**Delivers:** Staging bootstrap rehearsal from canonical migrations, function slug/secret verification, explicit security exception closure evidence.
**Addresses:** Launch-readiness gate for DB/functions/config and security-critical operations.
**Avoids:** Environment drift and temporary security settings becoming permanent defaults.

### Phase Ordering Rationale

- Contracts before optimization: permission, validation, and lifecycle semantics must be stable before broad performance tuning.
- DB changes are additive and phased to avoid big-bang migration risk while keeping UI/API parity.
- High-risk destructive flows are isolated into a dedicated lifecycle phase for policy clarity and recoverability.
- Final launch gate is separate to ensure deployment reproducibility and security cleanup are not treated as “best effort.”

### Research Flags

Phases likely needing deeper research during planning:
- **Phase 4 (Lifecycle Finalization):** Needs explicit product-policy decisions (archive retention, hard-delete eligibility, restore windows) plus transactional safety design.
- **Phase 5 (Performance + Freshness):** Needs measured baseline/SLO targets and detailed realtime invalidation strategy under concurrent edits/account switching.
- **Phase 6 (Security Closure):** Needs exact inventory of temporary runtime/CORS/JWT exceptions and phased rollback validation.

Phases with standard patterns (skip research-phase):
- **Phase 1:** Regression harness and baseline instrumentation are established patterns.
- **Phase 2:** Capability matrix + route/action gating is straightforward given existing AuthContext and role model.
- **Phase 3:** Shared validation modules with client/server parity are well-documented implementation patterns.

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | Derived from lockfile/repo reality and constrained milestone scope; minimal new dependencies. |
| Features | HIGH | Requirement set is explicit in milestone docs and consistently echoed across research outputs. |
| Architecture | HIGH | Recommendations align tightly with existing boundaries and avoid disruptive re-architecture. |
| Pitfalls | HIGH | Risks are repository-grounded and mapped to concrete prevention/verification phases. |

**Overall confidence:** HIGH

### Gaps to Address

- **Lifecycle policy final decisions:** archive retention, hard-delete roles, and restore guarantees need explicit product sign-off before Phase 4 implementation.
- **Canonical permission matrix artifact:** role-by-action matrix must be authored and approved before cross-layer verification.
- **Performance targets:** concrete SLO thresholds for “loading-time reduced” are not yet quantified.
- **Supabase version alignment plan:** frontend vs edge-function `supabase-js` version divergence should be tracked and intentionally reconciled.
- **Security exception inventory:** temporary runtime posture deviations require dated owner/exit criteria before launch.

## Sources

### Primary (HIGH confidence)
- `.planning/research/STACK.md` — concrete stack/version recommendations and integration boundaries.
- `.planning/research/FEATURES.md` — table-stakes vs differentiators, dependency graph, and MVP scope.
- `.planning/research/ARCHITECTURE.md` — component responsibilities, patterns, and phased integration strategy.
- `.planning/research/PITFALLS.md` — critical failure modes, warning signs, and prevention-phase mapping.
- `.planning/PROJECT.md` — milestone goals, constraints, and out-of-scope boundaries.

### Secondary (MEDIUM confidence)
- `.planning/codebase/ARCHITECTURE.md`, `.planning/codebase/CONCERNS.md`, `.planning/codebase/STRUCTURE.md`, `.planning/codebase/INTEGRATIONS.md` — repository-grounded supporting context used by upstream research.
- `docs/ai/system-context.md` — operational context and known weak spots.

### Tertiary (LOW confidence)
- None.

---
*Research completed: 2026-03-01*
*Ready for roadmap: yes*
