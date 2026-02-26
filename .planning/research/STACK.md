# Stack Research

**Domain:** Unified loading UX for a brownfield React SPA
**Researched:** 2026-02-26
**Confidence:** HIGH

## Recommended Stack

### Core Technologies

| Technology | Version | Purpose | Why Recommended |
|------------|---------|---------|-----------------|
| React | 19.x | UI state + rendering for loading overlay and action binding | Already in use; supports context/hook patterns and route-level lazy flows |
| React Router DOM | 6.26.x | Route transitions and lazy route loading states | Existing routing layer; can centralize route pending/loading behavior |
| TypeScript | 5.8.x | Typed loading contracts (`LoadingScope`, `LoadingToken`, messages) | Prevents ad-hoc loading strings and mismatched start/stop usage |
| Tailwind CSS | 4.x | Consistent full-page overlay styling and motion variants | Already used globally; avoids introducing new styling system |
| Supabase JS | 2.x | Async data/auth calls that trigger loading states | Main backend integration path; needs standardized loading wrappers |

### Supporting Libraries

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `lucide-react` | 0.562.x | Optional iconography in loading overlay/status | Use for consistent visual cue in full-page loader |
| Native `AbortController` | Browser standard | Safe cancellation and cleanup for async actions | Use to avoid stuck loading states when users navigate away |
| Native `prefers-reduced-motion` CSS media query | Browser standard | Motion reduction for accessibility | Always apply in loader animation layer |

### Development Tools

| Tool | Purpose | Notes |
|------|---------|-------|
| Vitest + RTL | Verify loading manager logic and UI behavior | Add tests for delay threshold, ref-counting, and fallback text |
| ESLint + TypeScript checks | Prevent inconsistent loader usage patterns | Keep `npm run check` as release gate |
| Vite | Build/lazy chunk behavior validation | Confirm route-based loader behavior in production build |

## Installation

```bash
# No mandatory new runtime dependencies required for v1.
# Existing stack is sufficient.

# Optional if dedicated motion lib becomes necessary later:
# npm install framer-motion
```

## Alternatives Considered

| Recommended | Alternative | When to Use Alternative |
|-------------|-------------|-------------------------|
| Global loading manager + hook API | Per-page local loading booleans | Only for isolated prototype pages, not platform standards |
| Existing full-page overlay component pattern | Third-party top-bar loaders (`nprogress`) | Use only if product wants non-blocking progress bar UX |
| Centralized typed loading messages | Free-text messages per component | Never for core UX consistency; only for temporary debugging |

## What NOT to Use

| Avoid | Why | Use Instead |
|-------|-----|-------------|
| Multiple independent full-page loaders with different text | Creates UX inconsistency and confusion | Single shared loader surface + scoped message mapping |
| Immediate loader for ultra-fast actions (0ms threshold) | Causes flicker and perceived instability | Delay window (e.g., 200–300ms) before showing loader |
| Fire-and-forget async without guaranteed cleanup | Leads to stuck loaders on errors/navigation | Token/ref-count loading API with `finally` cleanup |

## Stack Patterns by Variant

**If action can block whole user flow (route transition, critical save/import/delete):**
- Use global full-page loader.
- Because user must understand app is active and avoid duplicate actions.

**If action is local and non-blocking (optional future):**
- Keep local inline loading state, but still register with central analytics/status API.
- Because UX can remain responsive while preserving consistency.

## Version Compatibility

| Package A | Compatible With | Notes |
|-----------|-----------------|-------|
| `react@19.x` | `react-router-dom@6.26.x` | Current app baseline works with route lazy loading |
| `tailwindcss@4.x` | `@tailwindcss/vite@4.x` | Existing setup in `vite.config.ts` |
| `@supabase/supabase-js@2.x` | Browser ESM via Vite 6 | Existing runtime contract for async calls |

## Sources

- Existing repository architecture and codebase map (`.planning/codebase/*.md`) — current state verification
- React docs (Context, Suspense patterns) — loading state architecture guidance
- React Router docs (lazy routes, navigation pending patterns) — routing integration guidance
- Web accessibility guidance (ARIA status, reduced motion) — UX accessibility requirements

---
*Stack research for: unified loading UX in BusFlow web app*
*Researched: 2026-02-26*
