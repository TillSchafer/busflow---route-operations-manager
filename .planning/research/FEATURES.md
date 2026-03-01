# Feature Research

**Domain:** Brownfield route operations manager (auth + role-aware areas + route CRUD)
**Researched:** 2026-03-01
**Confidence:** HIGH

## Feature Landscape

### Table Stakes (Users Expect These)

Features users assume exist. Missing these = product feels incomplete.

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| Fast core UX (route list/detail load, save/delete actions) | Operations users expect near-immediate feedback in daily workflows | MEDIUM | Needs query optimization, loading-state consistency, and less redundant fetch work |
| Final route validations (required fields + business rules) | Invalid routes create operational risk and user distrust | MEDIUM | Combine client guardrails with server/RPC validation parity and clear error mapping |
| Stable auth/session with role-aware routing | Role-based operations tooling must always show the right scope | MEDIUM | Existing auth flow is in place; hardening is mostly consistency and regression prevention |
| Complete user settings flow (profile + security-critical actions) | Users expect to manage account/profile/security without dead ends | MEDIUM | Edge functions exist; completion is mostly UX consistency and failure-state handling |
| Clear delete/archive lifecycle for routes/data | Users need safe cleanup without accidental permanent loss | HIGH | Requires schema support, UI states, permissions, and explicit restore policy decisions |
| Enforced role visibility and permissions in UI + backend | Teams expect least-privilege behavior across pages/actions/data | HIGH | Must align route guards, component visibility, and server-side checks/RLS |
| Launch-ready DB integrity for MVP tests | Real-user testing requires data consistency and predictable behavior | HIGH | Add/confirm constraints, uniqueness, FK relations, and migration rollout safety |

### Differentiators (Competitive Advantage)

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| Multi-account context with role-aware operational screens | One app can serve owner/admin/member workflows without duplicate tooling | HIGH | Already present as foundation; v1.1 can differentiate by reducing permission confusion and latency |
| Conflict-aware route write model (safe concurrent edits) | Prevents silent overwrites in collaborative route operations | MEDIUM | Existing RPC/domain error codes can be fully surfaced with better UX and retry guidance |
| Archive-first operational safety model | Supports recoverability and auditability while keeping active views clean | HIGH | Strong practical advantage over destructive-delete-first behavior in small ops tools |
| Consistent async behavior across auth/admin/busflow flows | Feels production-ready and trustworthy for real pilot users | MEDIUM | Builds on existing loading work and expands consistency platform-wide |

### Anti-Features (Commonly Requested, Often Problematic)

| Feature | Why Requested | Why Problematic | Alternative |
|---------|---------------|-----------------|-------------|
| Permanent hard-delete as default | Faster cleanup and less UI complexity | Increases irreversible data-loss risk during MVP testing | Archive as default, hard-delete only behind stricter role/action gates |
| Over-granular custom role builder in v1.1 | Seems flexible for each tenant | Explodes permission matrix and delays launch-readiness | Keep fixed role set with explicit visibility/action contracts |
| New major architecture rewrite (state lib/backend redesign) | Promises long-term elegance | High migration risk, slows MVP validation, threatens existing stable flows | Brownfield hardening inside current React/Supabase architecture |
| Real-time updates for every surface immediately | Feels modern and reactive | Unnecessary complexity and performance overhead for non-critical paths | Scope realtime to high-value paths; use targeted refresh elsewhere |

## Feature Dependencies

```
[Launch-Ready DB Integrity]
    └──requires──> [Final Route Validation Rules]
    └──requires──> [Archive/Delete Data Lifecycle]
    └──requires──> [Role Visibility Enforcement]

[Auth + Account Context]
    └──requires──> [Role Visibility Enforcement]
                       └──requires──> [UI Guard Consistency]
                       └──requires──> [Backend Permission/RLS Consistency]

[Performance Optimization]
    └──enhances──> [Route CRUD Usability]
    └──enhances──> [Settings Completion UX]

[Hard Delete Default] ──conflicts──> [Archive-First Recoverability]
[UI-Only Permission Checks] ──conflicts──> [Server-Enforced Authorization]
```

### Dependency Notes

- **Launch-ready DB integrity requires final validation rules:** constraints and validation semantics must match to prevent client/server drift.
- **Launch-ready DB integrity requires archive/delete lifecycle:** soft-delete/archive flags, indexes, and query filters need schema support before stable rollout.
- **Launch-ready DB integrity requires role visibility enforcement:** roles and account boundaries must be represented consistently at data level for reliable checks.
- **Role visibility enforcement requires auth/account context:** active account and role derivation are prerequisites for any page/action visibility decision.
- **Role visibility enforcement requires UI + backend parity:** UI hiding alone is insufficient; server/RLS must deny unauthorized operations.
- **Performance optimization enhances route CRUD and settings:** faster load/mutation paths improve perceived reliability and reduce support noise during pilot testing.
- **Hard delete default conflicts with archive-first recoverability:** the two lifecycle models produce contradictory operator expectations and error-recovery paths.
- **UI-only checks conflict with server enforcement:** relying on client logic alone breaks least-privilege guarantees.

## Requirement Planning Notes

### Complexity Notes

- **Highest complexity cluster:** role visibility + archive model + DB launch hardening. These span frontend UX, API/RPC behavior, and migrations and should be planned as coordinated phases.
- **Medium complexity cluster:** route validations and settings finalization. These are broad but mostly incremental hardening on existing flows.
- **Cross-cutting complexity driver:** async consistency and latency reduction touch many modules (`auth`, `admin`, `busflow`, `profile`) and need systematic rollout checklists.
- **Migration risk driver:** schema changes for lifecycle/constraints can create backward-compatibility and rollout ordering risk if UI/API updates are not synchronized.

### Dependency Notes for Phase Ordering

- **DB contracts before strict validation/UI lock-down:** finalize schema constraints first, then enforce final client/server validation behavior.
- **Role matrix before visibility refactors:** define canonical permission matrix before touching route guards/components broadly.
- **Archive semantics before delete UX finalization:** decide restore/permanence policy first to avoid reworking deletion flows twice.
- **Performance baseline instrumentation before optimization claims:** capture baseline timings so “reduced loading time” is measurable and verifiable.

## MVP Definition

### Launch With (v1)

- [ ] Measurable loading-time reductions in critical flows (route list/detail, save, delete/archive, key settings actions).
- [ ] Route creation/edit validations finalized with clear field-level and domain-level feedback.
- [ ] User settings flow complete and consistent for profile/security-critical actions.
- [ ] Archive/delete model finalized and enforced consistently in UI/API/DB.
- [ ] Role visibility and action permissions finalized across route screens and admin areas.
- [ ] Launch-ready DB migrations applied for integrity, uniqueness, and relation consistency.

### Add After Validation (v1.x)

- [ ] Performance telemetry dashboard and alerting for slow workflows.
- [ ] Bulk archive/restore tooling for operational cleanup at scale.
- [ ] More granular settings options once baseline flow reliability is confirmed.

### Future Consideration (v2+)

- [ ] Tenant-configurable role templates beyond core fixed roles.
- [ ] Expanded operational automation (advanced rules, broader realtime propagation).
- [ ] Deeper analytics and optimization tooling for large-team deployments.

## Feature Prioritization Matrix

| Feature | User Value | Implementation Cost | Priority |
|---------|------------|---------------------|----------|
| Loading-time reduction in core workflows | HIGH | MEDIUM | P1 |
| Final route validation model | HIGH | MEDIUM | P1 |
| Settings finalization (profile/security UX) | HIGH | MEDIUM | P1 |
| Archive/delete lifecycle finalization | HIGH | HIGH | P1 |
| Role visibility/action enforcement parity | HIGH | HIGH | P1 |
| Launch-ready DB integrity migrations | HIGH | HIGH | P1 |
| Telemetry and advanced ops tooling | MEDIUM | MEDIUM | P2 |

**Priority key:**
- P1: Must have for launch
- P2: Should have, add when possible
- P3: Nice to have, future consideration

## Competitor Feature Analysis

| Feature | Competitor A | Competitor B | Our Approach |
|---------|--------------|--------------|--------------|
| Role-based operational visibility | Typical fleet ops SaaS: fixed role tiers and scoped modules | Generic FSM tooling: broader but less opinionated role controls | Keep fixed role model but tighten clarity and enforcement consistency |
| Data lifecycle (delete vs archive) | Commonly archive-first in mature operations tools | Often mixed patterns with inconsistent restore semantics | Explicit archive-first default + strict hard-delete controls |
| Validation + data integrity coupling | Mature tools enforce backend-first constraints | Lighter tools rely heavily on UI checks | Align client validations with server/RPC + DB constraints for launch reliability |
| Workflow performance in core CRUD | Mature tools optimize high-frequency flows first | Smaller tools often degrade under edge cases | Prioritize measurable latency reductions in top user journeys |

## Sources

- `.planning/PROJECT.md` (v1.1 milestone goals, active requirements, scope constraints)
- `.planning/codebase/ARCHITECTURE.md` (existing architecture, data flow, and abstractions)
- `.planning/codebase/CONCERNS.md` (known risks, scaling limits, missing critical features)
- Existing repository structure and domain context (`src/features`, `src/apps/busflow`, `supabase/functions`, `supabase/migrations`)

---
*Feature research for: BusPilot v1.1 MVP finalization*
*Researched: 2026-03-01*
