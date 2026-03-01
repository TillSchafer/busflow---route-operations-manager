# Pitfalls Research

**Domain:** Brownfield MVP finalization for BusPilot route operations manager
**Researched:** 2026-03-01
**Confidence:** HIGH

## Critical Pitfalls

### Pitfall 1: Core Flow Regression While "Hardening"

**What goes wrong:**
Auth, account switching, or route CRUD behavior regresses while performance/validation/security changes are introduced.

**Why it happens:**
Brownfield MVP work often touches shared providers and API layers; teams optimize or refactor without locking baseline behavior first.

**How to avoid:**
Define and automate a non-negotiable regression suite for core flows (`/auth/*`, account switch, route create/edit/delete, role-based route access) before broad hardening changes.

**Warning signs:**
- New "small" infra changes break unrelated pages.
- Increased bug reports around login redirects, missing routes, or disappearing edits.
- PRs touch shared auth/router/api files without added regression tests.

**Phase to address:**
Phase 1 - Core-Flow Safety Net (Owner: Frontend + QA)

---

### Pitfall 2: Split Permission Logic (UI Guards vs RLS vs Edge Functions)

**What goes wrong:**
A user can see actions they cannot execute, or worse, execute actions outside intended scope due to policy drift between frontend checks and backend authorization.

**Why it happens:**
Permission rules are duplicated across UI, RLS policies, and function code (`platform`/`team` admin surfaces, role helpers, account filters) and evolve asynchronously.

**How to avoid:**
Create one permission matrix per role/scope and validate it end-to-end against UI visibility, API/edge behavior, and RLS policy expectations. Treat permission updates as cross-layer changes, never frontend-only.

**Warning signs:**
- "Button visible but fails" patterns become common.
- Platform admin vs tenant admin behavior differs by page for the same action.
- RLS or function changes merge without scenario-level role tests.

**Phase to address:**
Phase 2 - Role/Scope Contract Alignment (Owner: Backend + Frontend + QA)

---

### Pitfall 3: Validation Drift Across Forms, APIs, and DB Constraints

**What goes wrong:**
Route/settings forms accept values that fail later in mutations, or APIs accept states the UI would normally block, causing inconsistent data and support load.

**Why it happens:**
Validation is spread between local React form checks, edge-function input guards, and schema constraints; teams patch one layer and miss the others.

**How to avoid:**
Define canonical validation rules for critical entities (route, customer/contact, worker, account settings) and enforce them in both UI and mutation entrypoints. Add "same invalid payload" tests across layers.

**Warning signs:**
- Frequent `INVALID_INPUT`/constraint errors from real users.
- Different error messages for the same bad input by entry path.
- Hotfixes repeatedly add one-off form checks.

**Phase to address:**
Phase 3 - Validation Consolidation (Owner: Frontend + Edge Functions)

---

### Pitfall 4: Archive/Delete Lifecycle Ambiguity

**What goes wrong:**
Users and admins cannot predict whether data is archived, hard deleted, recoverable, or still referenced; destructive flows produce partial outcomes.

**Why it happens:**
The system contains both archive metadata and hard-delete flows, including multi-step admin delete processes that are not fully transactional.

**How to avoid:**
Publish explicit lifecycle states per entity (active/archived/deleted), enforce one primary path per context, and add idempotent recovery procedures for partially completed destructive operations.

**Warning signs:**
- Repeated confusion between archive and hard delete in UI copy/support tickets.
- Orphaned references or repeated manual cleanup in production data.
- Dry-run counts and actual deletion outcomes diverge.

**Phase to address:**
Phase 4 - Data Lifecycle Finalization (Owner: Backend + Product + QA)

---

### Pitfall 5: Migration Order and Environment Drift

**What goes wrong:**
Launch candidates pass locally but fail in staging/production due to migration ordering, stale docs usage (`docs/migrations`), or function/env mismatch.

**Why it happens:**
Brownfield repositories accumulate historical SQL and multiple function generations; teams apply changes outside migration-first governance or deploy inconsistent config.

**How to avoid:**
Enforce `supabase/migrations/` as single schema source, require forward-only migration rehearsal on staging snapshots, and verify frontend project ref + function secrets + active function slugs before release.

**Warning signs:**
- "Works local, fails staging" on policy/function behavior.
- Manual SQL patches not represented in canonical migrations.
- Runtime errors around missing redirect URLs, wrong function slug, or project-ref mismatch.

**Phase to address:**
Phase 5 - Deployment Consistency Gate (Owner: Backend + DevOps)

---

### Pitfall 6: Performance Fixes That Break Freshness/Consistency

**What goes wrong:**
Caching/debouncing/reduced fetches improve latency but show stale route or membership data during active operations and account context changes.

**Why it happens:**
Performance work is applied locally without validating realtime sync and async mutation lifecycle interactions.

**How to avoid:**
Benchmark critical user flows first, then optimize with explicit freshness rules (refetch triggers, realtime invalidation, account-bound cache keys). Verify both speed and correctness.

**Warning signs:**
- Users report "saved but not visible" or delayed role/state updates.
- Fewer network requests but more manual refresh behavior.
- Realtime events fire, yet UI state does not reconcile predictably.

**Phase to address:**
Phase 6 - Performance + Consistency Hardening (Owner: Frontend + QA)

---

### Pitfall 7: Security Posture Debt Becomes MVP Default

**What goes wrong:**
Temporary mitigations (for example relaxed gateway/function posture) remain indefinitely and become production baseline without closure plan.

**Why it happens:**
MVP deadlines prioritize immediate operability; security cleanup items are tracked informally and miss explicit ownership.

**How to avoid:**
Treat temporary security exceptions as dated debt items with owner, exit criteria, and verification tests (for JWT mode, CORS restrictions, audited privileged mutations).

**Warning signs:**
- Security exceptions are documented but not phase-mapped.
- No target date/evidence for returning to stricter runtime posture.
- Privileged mutations remain partially split between direct table updates and function-audited paths.

**Phase to address:**
Phase 7 - Security Debt Closure (Owner: Backend + Security/Platform)

## Technical Debt Patterns

Shortcuts that seem reasonable but create long-term problems.

| Shortcut | Immediate Benefit | Long-term Cost | When Acceptable |
|----------|-------------------|----------------|-----------------|
| Patch validation only in one form/component | Fast bug fix | Recurring invalid-state bugs via other entry paths | Only as 24h emergency with follow-up ticket already scheduled |
| Duplicate role checks in page-level conditionals | Faster UI iteration | Authorization drift and inconsistent behavior across modules | Never for security-critical actions |
| Direct table mutations for privileged lifecycle changes | Lower implementation effort | Reduced auditability and harder incident forensics | Never when function-based audited path exists |
| One-off SQL hotfix outside canonical migration chain | Fast unblock | Environment drift and non-reproducible schema state | Never in shared environments |
| Performance micro-optimizations without baseline profiling | Quick perceived progress | Hidden data freshness regressions | Only for low-risk visual interactions |

## Integration Gotchas

Common mistakes when connecting to external services.

| Integration | Common Mistake | Correct Approach |
|-------------|----------------|------------------|
| Supabase Edge Functions | Calling legacy slugs or inconsistent versions by feature | Route all frontend calls through one canonical API mapping and keep slug inventory/version ownership explicit |
| Supabase Auth redirects | Deploying invite/reset/account-security changes without allowlist + secret verification | Validate `APP_*_REDIRECT_URL` secrets and Auth URL allowlist before release |
| Supabase Realtime | Assuming subscriptions alone guarantee UI freshness after mutations | Combine realtime events with deterministic local invalidation/refetch logic per account scope |
| RLS + frontend filters | Relying on UI filtering to enforce scope | Keep account/role constraints enforced in RLS/functions first, UI checks as secondary UX layer |

## Performance Traps

Patterns that work at small scale but fail as usage grows.

| Trap | Symptoms | Prevention | When It Breaks |
|------|----------|------------|----------------|
| Full list refetch on every small mutation | Jank and long spinners in route/settings views | Use targeted invalidation by entity/account and optimistic-local merge where safe | Usually visible once accounts have 100+ routes/customers |
| Over-subscribed realtime channels per page | CPU spikes and UI thrash during active edits | Share subscriptions by account scope and debounce refresh pipelines | Becomes painful with bursty writes and 10+ active editors |
| Blocking UI for all async actions with one global mode | Slower perceived UX and user hesitation | Keep critical blocking only for destructive/high-risk flows; use scoped pending states elsewhere | Appears quickly even at low pilot traffic |
| Premature memo/caching around role/account state | Wrong permissions shown after context switch | Tie caches to account/user keys and invalidate on auth/membership events | Breaks on frequent account switching users |

## Security Mistakes

Domain-specific security issues beyond general web security.

| Mistake | Risk | Prevention |
|---------|------|------------|
| Treating temporary `verify_jwt` fallback as permanent | Expanded attack surface if function checks drift or fail open | Create dated rollback plan to stricter posture with staged verification evidence |
| Leaving wildcard CORS in production without policy review | Easier abuse surface and weaker trust boundaries | Enforce environment-specific allowed origins and periodic config audits |
| Editing RLS policies without scenario matrix tests | Silent cross-tenant data exposure or accidental lockout | Require policy-change test matrix for platform admin, tenant admin, dispatch, viewer |
| Mixing privileged admin state changes between UI direct writes and functions | Incomplete audit trail during incidents | Centralize privileged mutations through audited functions only |

## UX Pitfalls

Common user experience mistakes in this domain.

| Pitfall | User Impact | Better Approach |
|---------|-------------|-----------------|
| Ambiguous destructive copy (archive vs delete) | Fear, mistakes, and support tickets | Explicit lifecycle copy with confirmation text tied to exact outcome |
| Inconsistent error language for same validation failure | Users do not know how to correct input | Shared error taxonomy and reusable form feedback components |
| Role-driven hiding without explanation | Users think features are broken/missing | Show clear "no permission" states with next-step guidance |
| Loading/feedback inconsistency in critical flows | Duplicate clicks and low trust in result state | Standardized pending/success/error states across route and admin actions |

## "Looks Done But Isn't" Checklist

Things that appear complete but are missing critical pieces.

- [ ] **Route CRUD hardening:** preserve create/edit/delete behavior across role permutations and account switching.
- [ ] **Validation finalization:** same invalid payload rejected consistently in UI, API/functions, and DB constraints.
- [ ] **Delete/archive concept:** each entity has documented lifecycle state, UI copy, and recovery expectation.
- [ ] **Role management:** visibility and execution rights match end-to-end (UI + function + RLS).
- [ ] **Schema launch-readiness:** all schema/policy/function changes reproducible from `supabase/migrations` only.
- [ ] **Performance claims:** flow-level before/after measurements prove latency improvement without stale-state regressions.
- [ ] **Security exceptions:** temporary runtime/security deviations are phase-owned with closure evidence.

## Recovery Strategies

When pitfalls occur despite prevention, how to recover.

| Pitfall | Recovery Cost | Recovery Steps |
|---------|---------------|----------------|
| Core flow regression in auth/route CRUD | HIGH | Freeze release, run core regression suite, revert offending shared-layer changes, patch with targeted tests before re-release |
| Permission drift across layers | HIGH | Build failing role-scenario matrix from reported case, align RLS + function + UI behavior in one patch, run cross-role verification |
| Partial hard-delete/archive outcomes | HIGH | Execute defined compensating cleanup script/runbook, reconcile affected entities via audit tables, add idempotency guard before reopening flow |
| Validation mismatch | MEDIUM | Normalize rules into shared contract, backfill user-facing error mapping, add cross-entry regression tests |
| Migration/environment drift | HIGH | Recreate staging from canonical migrations, diff live schema/functions, redeploy consistent config and rerun smoke/UAT gates |
| Performance fix caused stale UI | MEDIUM | Disable problematic caching path, restore deterministic refetch/realtime invalidation, reintroduce optimization with profiling evidence |
| Security exception lingered | MEDIUM | Move exception to dated remediation phase, implement rollback checklist, verify via targeted security test scenarios |

## Pitfall-to-Phase Mapping

How roadmap phases should address these pitfalls.

| Pitfall | Prevention Phase | Verification |
|---------|------------------|--------------|
| Core flow regression while hardening | Phase 1 - Core-Flow Safety Net (Owner: Frontend + QA) | Core regression suite green for auth, account switch, route CRUD before/after every hardening batch |
| Split permission logic | Phase 2 - Role/Scope Contract Alignment (Owner: Backend + Frontend + QA) | Role matrix passes for UI visibility + API outcome + RLS behavior |
| Validation drift | Phase 3 - Validation Consolidation (Owner: Frontend + Edge Functions) | Same invalid/edge payloads fail consistently across UI/function/DB paths |
| Archive/delete lifecycle ambiguity | Phase 4 - Data Lifecycle Finalization (Owner: Backend + Product + QA) | Destructive flow tests + lifecycle copy review + recovery drill completed |
| Migration/environment drift | Phase 5 - Deployment Consistency Gate (Owner: Backend + DevOps) | Fresh staging bootstrap from canonical migrations matches target release behavior |
| Performance fix breaks consistency | Phase 6 - Performance + Consistency Hardening (Owner: Frontend + QA) | Flow latency improves and freshness tests remain green under realtime + account switches |
| Security posture debt persists | Phase 7 - Security Debt Closure (Owner: Backend + Security/Platform) | Temporary exceptions have closure PRs, config evidence, and verification logs |

## Sources

- `.planning/PROJECT.md` (Milestone v1.1 scope, constraints, and MVP target)
- `docs/ai/system-context.md` (current architecture, known weak spots, operational invariants)
- `src/shared/auth/AuthContext.tsx` and `src/app/router/AppRouter.tsx` (core auth/account/routing behavior)
- `src/apps/busflow/api/*` and `src/apps/busflow/hooks/useRealtimeSync.ts` (route operations and realtime update patterns)
- `src/features/admin/platform/pages/PlatformAdminPage.tsx` and `src/features/admin/team/pages/TeamAdminPage.tsx` (archive/delete and role-admin UX flows)
- `supabase/functions/*` and `supabase/migrations/*` (validation guards, lifecycle flows, policy/schema governance)

---
*Pitfalls research for: Brownfield MVP finalization for BusPilot*
*Researched: 2026-03-01*
