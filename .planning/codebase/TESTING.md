# Testing Patterns

**Analysis Date:** 2026-02-26

## Test Framework

**Runner:**
- Vitest 4.x.
- Config in `vitest.config.ts` (jsdom, globals, CSS support, setup file).

**Assertion Library:**
- Vitest `expect`.
- Extended DOM matchers via `@testing-library/jest-dom/vitest` in `src/test/setup.ts`.

**Run Commands:**
```bash
npm run test           # Run all tests once (vitest run)
npm run test:watch     # Watch mode
npm run check          # typecheck + lint + build quality gate
npm run test:smoke     # alias to check
```

## Test File Organization

**Location:**
- Co-located with source modules.

**Naming:**
- `*.test.ts` for utilities/hooks.
- `*.test.tsx` for component tests.

**Current examples:**
```text
src/features/auth/lib/auth-callback.test.ts
src/features/admin/shared/lib/admin-ui.test.ts
src/apps/busflow/hooks/useRouteFiltering.test.ts
src/shared/lib/supabaseFunctions.test.ts
src/shared/lib/error-mapping.test.ts
src/pages/Profile.test.tsx
```

## Test Structure

**Suite Organization:**
- `describe` + `it` pattern.
- `beforeEach` used for per-test reset.
- Focus on user-observable behavior and helper contracts.

**Patterns:**
- Arrange/act/assert is implicit and concise.
- `userEvent` for UI interaction.
- Async expectation patterns for promise rejection and callback invocation.

## Mocking

**Framework:**
- `vi.mock(...)`, `vi.fn()`, `vi.hoisted(...)` from Vitest.

**Observed pattern:**
- External module boundaries mocked (e.g., Supabase client methods in `supabaseFunctions.test.ts`).
- Internal pure helpers tested without mocking when possible.

**What is mocked:**
- Supabase auth/session/function invocation edges.
- Browser location/history state where auth callback parsing is tested.

## Fixtures and Factories

**Current state:**
- No centralized fixture/factory library yet.
- Tests use local inline fixtures (e.g., `baseProps` in `Profile.test.tsx`).

## Coverage

**Requirements:**
- No formal line/branch threshold configured.
- Current expectation is pragmatic regression coverage for critical flows.

**Configuration:**
- No dedicated coverage script in `package.json` yet.

## Test Types

**Unit tests:**
- Utility modules (`auth-callback`, error mapping, admin helper logic).

**Component tests:**
- UI interaction and disabled/enabled behavior (`Profile.test.tsx`).

**Operational/integration scripts (non-Vitest):**
- `scripts/supabase/smoke-functions.mjs` for boundary/CORS/auth smoke checks.
- `scripts/supabase/e2e-functions-auth-matrix.mjs` for staged role matrix checks.

**E2E browser tests:**
- No Playwright/Cypress suite found.

## Common Patterns

**Async success/failure:**
```ts
await userEvent.click(button);
expect(handler).toHaveBeenCalledTimes(1);

await expect(asyncCall()).rejects.toMatchObject({ code: 'AUTH_SESSION_MISSING' });
```

**URL-state tests:**
- Use `window.history.replaceState(...)` to simulate auth callback URLs.

**Snapshot testing:**
- Not used in the current test suite.

---

*Testing analysis: 2026-02-26*
*Update when test tooling/coverage policy changes*
