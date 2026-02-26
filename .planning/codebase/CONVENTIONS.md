# Coding Conventions

**Analysis Date:** 2026-02-26

## Naming Patterns

**Files:**
- React components and pages use PascalCase filenames (`AppRouter.tsx`, `Profile.tsx`, `BusflowApp.tsx`).
- API boundary modules use `*.api.ts` suffix (`teamAdmin.api.ts`, `routes.api.ts`).
- Test files are colocated and use `*.test.ts` / `*.test.tsx`.
- Supabase functions use kebab-case folder names with version suffixes (`admin-delete-user-v3`).

**Functions:**
- General functions: camelCase.
- UI handlers: `handleX` pattern (`handleForgotPassword`, `handleProfileAvatarSave`).
- Hooks: `useX` pattern (`useAuth`, `useRealtimeSync`, `useRouteFiltering`).

**Variables:**
- camelCase for state and locals.
- Constants often UPPER_SNAKE_CASE for fixed values (`MAX_TOASTS`, `PLATFORM_OWNER_EMAIL`).

**Types:**
- Interfaces and types: PascalCase (`AccountSummary`, `FunctionAuthErrorCode`).
- Union string literals are used heavily for role/status/function action contracts.

## Code Style

**Formatting:**
- Single quotes and semicolons consistently used.
- JSX with concise inline handlers where practical.
- No explicit line-length rule observed in config.

**Linting:**
- ESLint 9 flat config in `eslint.config.js`.
- `@typescript-eslint` recommended + `react-hooks` recommended.
- `no-undef` disabled for TS files and script override.
- `@typescript-eslint/no-explicit-any` and `no-unused-vars` are currently relaxed.

## Import Organization

**Observed order (common pattern):**
1. External packages (`react`, `react-router-dom`, SDK libs).
2. Internal absolute/shared modules.
3. Relative local modules.

**Grouping:**
- Usually grouped by origin with blank lines between conceptual groups.
- Type imports are mixed with value imports (not strictly separated).

**Path aliases:**
- `@/*` configured in TS/Vite and points to project root (`./*`).
- Relative paths still widely used.

## Error Handling

**Patterns:**
- `try/catch` around async UI actions; user-facing feedback via toasts.
- API wrappers throw normalized `Error` with friendly message fallback.
- Code-bearing errors used where needed (`code` property on Error for domain cases).

**Auth/function errors:**
- `invokeAuthedFunction` introduces dedicated `FunctionAuthError` with codes:
  - `AUTH_SESSION_MISSING`
  - `AUTH_SESSION_INVALID`

## Logging

**Framework:**
- Console logging only (`console.error`, `console.warn`).

**Patterns:**
- Operational failures logged with context payloads in function invoke wrapper.
- Best-effort operations (e.g., invitation expiry normalization) warn without hard-failing UI.

## Comments

**When used:**
- Sparse and pragmatic.
- Used for intent and safeguards (e.g., avoiding account enumeration, best-effort fallbacks).

**JSDoc/TSDoc:**
- Not a dominant pattern in current code.

## Function Design

**Common style:**
- Guard clauses first for invalid state/permissions.
- Async handlers encapsulate one user action.
- Mapping and transformation helpers extracted in API shared modules.

**Parameters:**
- Plain arguments for small functions.
- Object payloads for API/function calls.

## Module Design

**Exports:**
- Default exports are common for React page/component modules.
- Named exports used for utility functions, hooks, and API methods.

**Separation:**
- `shared/api/*` for cross-domain API wrappers.
- `apps/busflow/api/*` for BusFlow data boundary.
- `features/*` wrappers provide a migration seam over legacy `pages/*`.

---

*Convention analysis: 2026-02-26*
*Update when lint rules or style policy changes*
