# Pitfalls Research

**Domain:** Unified loading system rollout in existing operations platform
**Researched:** 2026-02-26
**Confidence:** HIGH

## Critical Pitfalls

### Pitfall 1: Loader Deadlocks (Never Hides)

**What goes wrong:**
Global loader stays visible after errors, aborted requests, or navigation changes.

**Why it happens:**
Manual `setLoading(true/false)` logic with missing error/cancel cleanup paths.

**How to avoid:**
Use token-based API with mandatory `finally` cleanup in one abstraction.

**Warning signs:**
- UI remains blocked after failed request
- Support reports “app hängt” even though backend responds

**Phase to address:**
Phase 1 (foundation) + Phase 2 (integration rollout)

---

### Pitfall 2: Over-Blocking UX

**What goes wrong:**
Full-page loader appears for trivial operations, making app feel slower.

**Why it happens:**
No policy for delay threshold or scope severity.

**How to avoid:**
Introduce delay gate (200–300ms) and scope policy for when full-page overlay is used.

**Warning signs:**
- Noticeable flicker on quick clicks
- Users report “nervous” or jumpy UI

**Phase to address:**
Phase 1 (policy and defaults)

---

### Pitfall 3: Message Drift Across Teams

**What goes wrong:**
Different pages reintroduce custom loader text and tone.

**Why it happens:**
No centralized message registry or typed loading scopes.

**How to avoid:**
Central `loading.messages.ts` map + fallback `Lade...` + lint/review convention.

**Warning signs:**
- New PRs include one-off loading strings
- Mixed terminology in admin vs busflow vs auth pages

**Phase to address:**
Phase 1 (message registry) + Phase 3 (hardening)

---

### Pitfall 4: Incomplete Coverage of Async Flows

**What goes wrong:**
Some actions still have no loading feedback, especially rare/admin flows.

**Why it happens:**
Rollout only touches happy-path screens.

**How to avoid:**
Inventory all async flows and track completion checklist per module.

**Warning signs:**
- QA finds “silent waiting” on destructive/admin operations
- Inconsistent behavior during slow network simulation

**Phase to address:**
Phase 2 (module-by-module integration)

---

### Pitfall 5: Accessibility Regressions

**What goes wrong:**
Screenreader users do not receive loading context; motion-sensitive users discomfort.

**Why it happens:**
Loader considered visual-only component.

**How to avoid:**
Define accessibility contract in component API (`aria-busy`, SR status text, reduced motion).

**Warning signs:**
- Keyboard-only flow confusion during long actions
- Missing announcements in SR smoke checks

**Phase to address:**
Phase 1 (contract) + Phase 3 (verification)

## Technical Debt Patterns

| Shortcut | Immediate Benefit | Long-term Cost | When Acceptable |
|----------|-------------------|----------------|-----------------|
| Per-component loading state duplication | Fast local delivery | Inconsistent UX + high maintenance | Never for platform-wide loading concerns |
| Hardcoded strings in components | Quick implementation | Message drift and translation friction | Temporary spike only |
| Loader toggling in every handler | No abstraction work initially | Frequent cleanup bugs | Never once shared loader exists |

## Integration Gotchas

| Integration | Common Mistake | Correct Approach |
|-------------|----------------|------------------|
| React Router lazy routes | Only wrapping some route elements | Centralize route pending handling in app router/loading provider |
| Supabase function calls | Show toast only, no loading state | Wrap calls through shared loading action helper |
| Concurrent async actions | Last finished action hides loader too early | Use token/ref-count strategy |

## Performance Traps

| Trap | Symptoms | Prevention | When It Breaks |
|------|----------|------------|----------------|
| Showing full-page loader instantly | Flicker on quick actions | Delay reveal threshold | Immediately on normal network |
| Re-render storm from naive global state updates | Janky transitions | Keep loading state minimal and derived | Heavy async overlap |
| Blocking UI for non-blocking tasks | Lower perceived performance | Scope policy and optional future inline mode | During high interaction sessions |

## Security Mistakes

| Mistake | Risk | Prevention |
|---------|------|------------|
| Loading messages leak sensitive internals | Users see backend details | Keep user-friendly, non-sensitive text catalog |
| Ignoring auth expiry loading states | Confusing loops during re-auth | Handle auth invalidation distinctly in loading/error pipeline |
| Missing timeout handling for stalled calls | Users stuck without next step | Add long-running action escalation strategy |

## UX Pitfalls

| Pitfall | User Impact | Better Approach |
|---------|-------------|-----------------|
| Generic endless spinner | “App hängt” perception | Scoped message + fallback + optional timeout help |
| Different loaders on different pages | Lower trust in product quality | One canonical loader component |
| No loading feedback on destructive actions | Duplicate clicks and accidental repeats | Immediate pending state + disabled action controls |

## "Looks Done But Isn't" Checklist

- [ ] **Route loading:** all route transitions show consistent behavior with same component.
- [ ] **Mutation coverage:** save/delete/invite/import/profile actions all wired to loading manager.
- [ ] **Cleanup safety:** errors/cancellations never leave loader stuck.
- [ ] **Accessibility:** SR announcements and reduced-motion behavior verified.
- [ ] **Copy consistency:** no legacy strings like `Lade Ansicht` / `Lade BusFlow` remain.

## Recovery Strategies

| Pitfall | Recovery Cost | Recovery Steps |
|---------|---------------|----------------|
| Stuck loader | MEDIUM | Add token diagnostics, patch missing cleanup, add regression test |
| Missing flow coverage | LOW | Add action to inventory checklist, wire helper, verify manually |
| Message inconsistency | LOW | Migrate to registry key and remove local string |

## Pitfall-to-Phase Mapping

| Pitfall | Prevention Phase | Verification |
|---------|------------------|--------------|
| Loader deadlocks | Phase 1 | forced error/cancel test cases pass |
| Coverage gaps | Phase 2 | async flow checklist 100% complete |
| A11y regressions | Phase 3 | SR/reduced-motion checks pass |

## Sources

- Existing platform behavior and user-reported inconsistencies
- Current React/Supabase async flow patterns in repository
- Accessibility best-practice guidance for loading feedback

---
*Pitfalls research for: unified loading rollout in BusFlow*
*Researched: 2026-02-26*
