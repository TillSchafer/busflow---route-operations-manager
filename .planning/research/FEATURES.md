# Feature Research

**Domain:** Unified loading UX for a role-based operations web platform
**Researched:** 2026-02-26
**Confidence:** HIGH

## Feature Landscape

### Table Stakes (Users Expect These)

Features users assume exist. Missing these = product feels incomplete.

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| One global loading visual language | Users expect consistent system behavior across pages | MEDIUM | Replace all divergent loaders/text variants |
| Action-specific loading message | Users need context for waiting states | LOW | Default fallback `Lade...` when message unknown |
| Delay before showing loader | Prevents flicker and perceived instability | LOW | Typical threshold 200–300ms |
| Guaranteed cleanup on success/error/cancel | Users expect loader to disappear reliably | MEDIUM | Use token/ref-count start/stop contracts |
| Accessibility semantics (`aria-busy`, SR text) | Core UX expectation for assistive technologies | LOW | Include reduced-motion branch |
| Coverage for critical async actions | Users expect same behavior in route load, save, delete, invite, import | MEDIUM | Apply platform-wide, not per-team convention |

### Differentiators (Competitive Advantage)

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| Semantic status taxonomy (route-load, save, import, auth, sync) | Improves clarity and support/debugging | MEDIUM | Enables consistent message and analytics mapping |
| Central loader orchestration API | Eliminates duplicate local logic and regressions | MEDIUM | Hook + helper wrapper for all async actions |
| Loading telemetry hooks (optional v1.x) | Detects slow flows and UX pain points | MEDIUM | Can tie into existing Vercel analytics events |

### Anti-Features (Commonly Requested, Often Problematic)

| Feature | Why Requested | Why Problematic | Alternative |
|---------|---------------|-----------------|-------------|
| “Custom loader per page/team” | Teams want local control | Reintroduces inconsistency and drift | Central loader with scoped message slots |
| Infinite generic spinner with no context | Easy to implement quickly | Feels broken and erodes trust | Context message + optional timeout escalation |
| Blocking loader for tiny sub-100ms actions | “Always show feedback” instinct | Visual flicker and cognitive noise | Delay threshold + local micro-feedback where needed |

## Feature Dependencies

```
[Global Loading Manager]
    └──requires──> [Typed Loading Contract]
                       └──requires──> [Wrapper Hooks/Helpers]

[Action-Specific Messages]
    └──requires──> [Loading Scope Taxonomy]

[A11y + Reduced Motion]
    └──requires──> [Single Shared Loading UI]
```

### Dependency Notes

- **Global manager requires typed contract:** without a shared API, cleanup and consistency are fragile.
- **Action messages require scope taxonomy:** message mapping must be deterministic, not free-text chaos.
- **A11y requires shared UI:** accessibility cannot be guaranteed when each page renders its own loader.

## MVP Definition

### Launch With (v1)

- [ ] Central full-page loader component used platform-wide.
- [ ] Loading manager API with delayed reveal and safe cleanup.
- [ ] Scoped loading messages + fallback `Lade...`.
- [ ] Integration in all critical async flows (routing, auth hydration, admin actions, busflow actions).
- [ ] Accessibility defaults (`aria-busy`, screenreader text, reduced-motion).

### Add After Validation (v1.x)

- [ ] Loader metrics/telemetry for slow-action reporting.
- [ ] Timeout/escalation copy for very long operations.

### Future Consideration (v2+)

- [ ] Per-scope progressive status steps (e.g., import stages).
- [ ] Optional inline + global hybrid policy engine.

## Feature Prioritization Matrix

| Feature | User Value | Implementation Cost | Priority |
|---------|------------|---------------------|----------|
| Unified full-page loader | HIGH | MEDIUM | P1 |
| Scoped loading messages + fallback | HIGH | LOW | P1 |
| Delay + cleanup safety | HIGH | MEDIUM | P1 |
| Full async coverage rollout | HIGH | MEDIUM | P1 |
| A11y + reduced motion | HIGH | LOW | P1 |
| Telemetry | MEDIUM | MEDIUM | P2 |

**Priority key:**
- P1: Must have for launch
- P2: Should have, add when possible
- P3: Nice to have, future consideration

## Competitor Feature Analysis

| Feature | Competitor A | Competitor B | Our Approach |
|---------|--------------|--------------|--------------|
| Global route loading feedback | Common in modern SaaS dashboards | Common in admin products | Full-page loader with clear action text |
| Contextual operation messages | Often present for heavy actions | Mixed quality across products | Required for all major async actions |
| Reduced-motion support | Inconsistent in many products | Increasingly common | Built-in from first rollout |

## Sources

- Existing BusFlow UX behavior and page/hook analysis in current repo
- Established UX conventions in modern web SaaS products
- Accessibility best-practices for loading states

---
*Feature research for: unified loading UX in BusFlow platform*
*Researched: 2026-02-26*
