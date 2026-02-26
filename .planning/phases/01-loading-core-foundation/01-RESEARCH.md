# Phase 1: Loading Core Foundation - Research

**Researched:** 2026-02-26
**Domain:** React 19 global loading orchestration in a Vite SPA
**Confidence:** HIGH

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
### Loading screen presentation
- Visual direction is modern, elegant, and minimal.
- Full-page loading surface shows spinner + loading text.
- Default loading text should be `Lade...`.
- Background should remain faintly visible behind the loading surface.
- Use the provided spinner reference (`@/components/ui/loader-15`) if compatible.
- Show progress percentage only when feasible/determinate.

### Reveal and hide timing
- Delay before showing full-page loader: `150ms`.
- No required minimum visible duration once shown.
- If operation completes before `150ms`, loader remains fully hidden.
- Prefer over-communicating loading state rather than under-communicating during back-to-back async activity.

### Interaction model during loading
- Loading overlay is full-blocking (no interaction/clicks).
- No cancel action is exposed from the loading UI.
- Underlying content can be visible but must stay non-interactive.
- Use a lighter visual variant for very short visible loading periods.

### Failure and concurrent behavior
- Loading errors should be communicated via toast.
- Error copy should be clear (not ultra-terse).
- Retry affordance should appear only when contextually meaningful.
- With concurrent operations, loading remains visible until all active operations complete.

### Claude's Discretion
- Exact threshold/rules for switching to the lighter short-load variant.
- Exact criteria for when retry appears on failure-related feedback.
- Progress-percentage behavior when progress is not determinable.
- Final toast wording details while preserving clear tone.

### Deferred Ideas (OUT OF SCOPE)
None - discussion stayed within phase scope.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| LOAD-01 | Platform uses one shared full-page loading screen component as the canonical loading UI. | Replace local route/auth fallback UI with one shared component rendered from app-level provider state. |
| LOAD-02 | Loading screen appears only after a short delay threshold to avoid flicker on fast actions. | Centralized delay gate in loading manager (`setTimeout` reveal, canceled on early completion). |
| LOAD-04 | Loading lifecycle is managed through a centralized start/stop contract that guarantees cleanup on success, error, and cancellation. | Token/ref-count contract + wrapper helper (`runWithLoading`) with `try/finally` cleanup semantics. |
</phase_requirements>

## Summary

The codebase already has multiple loading surfaces (`RouteFallback` in `AppRouter`, `AuthContext` gate behavior, and `ProgressViewport` for long-running customer operations), but no unified global lifecycle contract. The safest Phase 1 shape is to introduce a dedicated loading subsystem in `src/shared/loading/*` and integrate it at `AppProviders` level so route/auth and future action flows share one source of truth.

To satisfy cleanup guarantees, the loading API should issue operation tokens and track active operations via ref-count semantics. A helper wrapper should enforce `stop()` in `finally` so all success/error paths clean up correctly. This also enables Phase 3 concurrent behavior requirements without redesign.

**Primary recommendation:** Create `LoadingProvider + useLoading + FullPageLoadingScreen + 150ms reveal gate` and wire it at app root while replacing `RouteFallback` usage with the shared full-page component.

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| react | ^19.2.3 | Provider/state orchestration and composition | Already foundational across app shell and shared providers. |
| react-router-dom | ^6.26.2 | Lazy route boundaries and Suspense fallbacks | Existing route transitions already use Suspense fallback points. |
| lucide-react | ^0.562.0 | Spinner/icon fallback where custom loader unavailable | Existing iconography system; no new dependency required for phase baseline. |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| shadcn CLI | ^3.8.5 (dev) | Install user-selected `loader-15` component | Use only if component integrates cleanly with existing styling and build. |
| vitest + RTL | ^4.0.18 / ^16.3.2 | Provider contract and reveal-delay tests | Use in hardening phase or for early contract coverage. |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Context provider with token API | Global state lib (Redux/Zustand) | Unnecessary scope increase for phase; app already uses context pattern. |
| Shared full-page loading screen | Keep per-route fallback components | Contradicts LOAD-01 canonical UI requirement and causes divergence. |

**Installation:**
```bash
npx shadcn@latest add https://21st.dev/r/ravikatiyar162/loader-15
```

## Architecture Patterns

### Recommended Project Structure
```text
src/
├── shared/loading/                 # loading engine + UI
│   ├── LoadingProvider.tsx
│   ├── FullPageLoadingScreen.tsx
│   ├── loading-types.ts
│   └── index.ts
├── app/providers/AppProviders.tsx  # provider wiring
└── app/router/AppRouter.tsx        # route fallback consumption
```

### Pattern 1: Token/ref-count lifecycle contract
**What:** `start(scope, message?) -> token` increments active count; `stop(token)` decrements once; visibility derives from active token count and delay state.
**When to use:** Any async flow that should drive global blocking UI.
**Example:**
```typescript
const token = loading.start({ scope: 'route', message: 'Lade...' });
try {
  await action();
} finally {
  loading.stop(token);
}
```

### Pattern 2: Wrapper API that guarantees cleanup
**What:** `runWithLoading(fn, options)` wraps async operations and handles `start/stop` + error handoff.
**When to use:** Route/auth/action code paths where manual `try/finally` repetition is error-prone.
**Example:**
```typescript
await loading.runWithLoading(
  async () => {
    await loadSession();
  },
  { scope: 'auth', message: 'Lade...' }
);
```

### Pattern 3: Delay reveal gate at provider level
**What:** Global `visible` state turns true only after 150ms while operations remain active; canceled if all operations finish earlier.
**When to use:** All full-page loading displays to avoid flicker on fast operations.
**Example:**
```typescript
useEffect(() => {
  if (activeCount === 0) return setVisible(false);
  const timer = window.setTimeout(() => setVisible(true), 150);
  return () => window.clearTimeout(timer);
}, [activeCount]);
```

### Anti-Patterns to Avoid
- **Inline local loading UIs per route:** recreates current inconsistency (`Lade Ansicht ...`, `Lade BusFlow Daten...`) and violates canonical UI goal.
- **Boolean-only loading flag without token ownership:** fails on concurrent operations and can prematurely hide loader.
- **Relying on component unmount for cleanup:** error/cancel paths can leak active state.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Async cleanup guarantee | Ad-hoc repeated `setLoading(true/false)` | Central helper (`runWithLoading`) with `finally` cleanup | Eliminates forgotten stop calls and lifecycle drift. |
| Concurrent operation tracking | Single global boolean | Token + ref-count map/set | Correct visibility for overlapping async actions. |
| Multiple loading UIs | Route-local fallback variants | One shared `FullPageLoadingScreen` component | Enforces consistency and reduces duplicate styling logic. |

**Key insight:** lifecycle correctness is the risky part, not spinner rendering. Contract-first loading management removes most regression risk.

## Common Pitfalls

### Pitfall 1: Lost stop calls on thrown errors
**What goes wrong:** loader stays visible forever after exception.
**Why it happens:** missing `finally` or early return path.
**How to avoid:** wrapper helper and idempotent `stop(token)` guard.
**Warning signs:** active token count never returns to zero.

### Pitfall 2: Flicker from immediate reveal/hide
**What goes wrong:** jarring UI flashes for fast operations.
**Why it happens:** no reveal threshold and no cancelation of pending timers.
**How to avoid:** centralized 150ms reveal delay with timer cleanup on settle.
**Warning signs:** loader appears for near-instant operations.

### Pitfall 3: Inconsistent copy and visuals across entry points
**What goes wrong:** users see mixed loading styles and texts.
**Why it happens:** separate route/auth/action fallback components.
**How to avoid:** single shared screen component and default message fallback (`Lade...`).
**Warning signs:** multiple hardcoded loading strings in app shell files.

## Code Examples

Verified codebase-aligned patterns:

### Context provider with typed hook
```typescript
const LoadingContext = createContext<LoadingContextValue | undefined>(undefined);

export const useLoading = () => {
  const ctx = useContext(LoadingContext);
  if (!ctx) throw new Error('useLoading must be used within LoadingProvider');
  return ctx;
};
```

### Unified root-level viewport injection
```tsx
<LoadingProvider>
  {children}
  <FullPageLoadingScreen />
</LoadingProvider>
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Local fallback per route/screen | Platform-level loading orchestrator | Ongoing platform hardening | Predictable behavior and fewer async lifecycle bugs. |
| Boolean loading state | Token/ref-count loading contract | Common in modern async UI orchestration | Correct concurrency handling. |

**Deprecated/outdated:**
- Loading strings embedded directly in route-level fallback components.

## Open Questions

1. **Loader-15 integration details**
   - What we know: User strongly prefers this spinner.
   - What's unclear: Final className/theming compatibility in current Tailwind stack.
   - Recommendation: Attempt integration in Plan 02 with Lucide spinner fallback path.

2. **Short-load lighter-variant threshold**
   - What we know: User wants lighter variant for very short visible states.
   - What's unclear: Exact threshold value for switching style.
   - Recommendation: set provider-level constant (e.g. 700-900ms) as Claude discretion and validate in execution.

## Sources

### Primary (HIGH confidence)
- `.planning/phases/01-loading-core-foundation/01-CONTEXT.md` - locked UX and behavior decisions.
- `.planning/ROADMAP.md` - phase goal/success criteria and required IDs.
- `.planning/REQUIREMENTS.md` - LOAD-01/LOAD-02/LOAD-04 definitions.
- `src/app/router/AppRouter.tsx` - current route fallback and auth loading gate.
- `src/shared/auth/AuthContext.tsx` - current auth loading lifecycle.
- `src/shared/components/ProgressProvider.tsx` - existing provider pattern for async state.
- `src/app/providers/AppProviders.tsx` - root provider composition point.
- `package.json` - active dependency versions and test/build commands.

### Secondary (MEDIUM confidence)
- None.

### Tertiary (LOW confidence)
- None.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - from package manifests and active imports.
- Architecture: HIGH - from app shell/provider/router/auth code inspection.
- Pitfalls: HIGH - directly derived from current divergent loading surfaces and async patterns.

**Research date:** 2026-02-26
**Valid until:** 2026-03-28
