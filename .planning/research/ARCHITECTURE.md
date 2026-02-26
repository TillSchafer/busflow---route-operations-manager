# Architecture Research

**Domain:** Platform-wide loading orchestration in React SPA
**Researched:** 2026-02-26
**Confidence:** HIGH

## Standard Architecture

### System Overview

```
┌─────────────────────────────────────────────────────────────┐
│                    Presentation Layer                       │
├─────────────────────────────────────────────────────────────┤
│  ┌──────────────────┐   ┌───────────────────────────────┐   │
│  │ Route Pages      │   │ Shared FullPageLoadingScreen  │   │
│  └────────┬─────────┘   └──────────────┬────────────────┘   │
│           │                            │                    │
├───────────┴────────────────────────────┴────────────────────┤
│                  Loading Orchestration Layer                │
├─────────────────────────────────────────────────────────────┤
│  ┌───────────────────────────────────────────────────────┐  │
│  │ LoadingProvider + useLoading() + start/stop tokens   │  │
│  └───────────────────────────────────────────────────────┘  │
├─────────────────────────────────────────────────────────────┤
│                    Integration Layer                        │
│  ┌──────────────┐  ┌───────────────┐  ┌──────────────────┐ │
│  │ Router hooks │  │ API wrappers  │  │ Supabase actions │ │
│  └──────────────┘  └───────────────┘  └──────────────────┘ │
└─────────────────────────────────────────────────────────────┘
```

### Component Responsibilities

| Component | Responsibility | Typical Implementation |
|-----------|----------------|------------------------|
| `LoadingProvider` | Central source of truth for loading state and message | Context + reducer/ref-count + delay timer |
| `FullPageLoadingScreen` | Unified visual layer + accessibility semantics | Shared component rendered once near app root |
| `useLoadingAction` helper | Wrap async actions and guarantee cleanup | `try/finally` token lifecycle wrapper |
| Router integration | Show loading during route/lazy transitions | Hook into router pending/lazy boundaries |
| API integration wrappers | Normalize loading for calls (save/delete/invite/import) | Wrapper around existing async handlers/APIs |

## Recommended Project Structure

```
src/
├── shared/
│   ├── loading/
│   │   ├── LoadingProvider.tsx
│   │   ├── FullPageLoadingScreen.tsx
│   │   ├── loading.types.ts
│   │   ├── loading.messages.ts
│   │   └── useLoadingAction.ts
│   └── components/
├── app/
│   ├── providers/
│   │   └── AppProviders.tsx
│   └── router/
└── apps/
    └── busflow/
```

### Structure Rationale

- **`shared/loading/`:** creates a single reusable platform primitive, not feature-local duplicates.
- **`app/providers/`:** ensures loader overlay is globally mounted once and consistently available.

## Architectural Patterns

### Pattern 1: Token-Based Ref Counting

**What:** `start(scope, message?) -> token`, `stop(token)` with active token count.
**When to use:** Multiple concurrent async actions can overlap.
**Trade-offs:** Slightly more plumbing, but prevents stuck or prematurely hidden loaders.

**Example:**
```typescript
const token = loading.start('route-save', 'Route wird gespeichert...');
try {
  await saveRoute();
} finally {
  loading.stop(token);
}
```

### Pattern 2: Delay-Reveal Loader

**What:** Show overlay only after short threshold if action still pending.
**When to use:** Avoid flash/flicker on fast operations.
**Trade-offs:** Very short operations show no global loader, which is desirable.

### Pattern 3: Scoped Message Registry

**What:** Map loading scopes to approved messages + fallback.
**When to use:** Keep consistency and localization readiness.
**Trade-offs:** Requires upfront registry maintenance.

## Data Flow

### Request Flow

```
[User Action]
    ↓
[UI Handler] → [useLoadingAction] → [API/Supabase Call]
    ↓               ↓                     ↓
[Overlay On?] ← [Delay Gate] ← [Pending Promise]
    ↓
[finally cleanup] → [Overlay Off when no active tokens]
```

### State Management

```
[LoadingProvider State]
    ↓ (context)
[FullPageLoadingScreen]
    ↑
[start/stop from route+feature actions]
```

### Key Data Flows

1. **Route navigation flow:** lazy route pending -> global loading message -> resolve -> hide.
2. **Action mutation flow:** save/delete/invite/import wraps async call -> scoped message -> cleanup.

## Scaling Considerations

| Scale | Architecture Adjustments |
|-------|--------------------------|
| 0-1k users | Context-based loading manager is sufficient |
| 1k-100k users | Add loading telemetry by scope for bottleneck analysis |
| 100k+ users | Add richer progress states for long operations and background queues |

### Scaling Priorities

1. **First bottleneck:** untracked long operations — fix with scope telemetry.
2. **Second bottleneck:** noisy global blocking — refine policy for inline vs full-page in v2.

## Anti-Patterns

### Anti-Pattern 1: Local Boolean Chaos

**What people do:** each component defines `isLoading` with inconsistent UI.
**Why it's wrong:** impossible to enforce consistency and difficult to debug.
**Do this instead:** central provider + standardized wrappers.

### Anti-Pattern 2: Missing `finally`

**What people do:** set loading true, return early on error path.
**Why it's wrong:** loader gets stuck forever.
**Do this instead:** token-based `try/finally` abstraction.

## Integration Points

### External Services

| Service | Integration Pattern | Notes |
|---------|---------------------|-------|
| Supabase Auth/DB/Functions | Wrap async calls with loading action helper | Preserve existing APIs; add orchestration only |

### Internal Boundaries

| Boundary | Communication | Notes |
|----------|---------------|-------|
| `AppRouter` ↔ LoadingProvider | Context calls + route pending mapping | Replace current route fallback variants |
| BusFlow/Admin/Profile handlers ↔ LoadingProvider | `useLoadingAction` helper | Ensures same UX language for all modules |

## Sources

- Existing BusFlow code architecture (`src/app`, `src/shared`, `src/apps/busflow`, `src/pages`)
- Existing loading inconsistencies from user-reported behavior
- Established React SPA loading orchestration patterns

---
*Architecture research for: unified loading orchestration in BusFlow*
*Researched: 2026-02-26*
