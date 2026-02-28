# Repository Guidelines

## Project Structure & Module Organization
- `src/app/` contains app bootstrapping (providers and router).
- `src/features/` holds feature-first modules (`auth`, `admin`, `profile`, `home`, `busflow`) with `pages/` and local `lib/`.
- `src/shared/` contains reusable building blocks: UI primitives, shared API clients, auth context, hooks, and loading utilities.
- `src/apps/busflow/` is the main BusFlow domain area (API adapters, hooks, components, utilities).
- `supabase/functions/` contains Edge Functions (`*_v1`, `*_v3`); shared server helpers live in `supabase/functions/_shared/`.
- `supabase/migrations/` is the source of truth for DB schema changes. `docs/migrations/` is reference/archive only.
- Tests are colocated as `*.test.ts` / `*.test.tsx`; global test setup is `src/test/setup.ts`.

## Build, Test, and Development Commands
- `npm install`: install dependencies.
- `npm run dev`: start Vite dev server.
- `npm run build`: create production bundle in `dist/`.
- `npm run test`: run Vitest once.
- `npm run test:watch`: run Vitest in watch mode.
- `npm run lint`: run ESLint across source files.
- `npm run typecheck`: run TypeScript checks without emit.
- `npm run check`: local quality gate (`typecheck + lint + build`).

## Coding Style & Naming Conventions
- Language: TypeScript + React (ES modules), 2-space indentation.
- Components/pages: `PascalCase.tsx` (for example `ProfilePage.tsx`).
- Hooks: `useXxx.ts` (for example `useRealtimeSync.ts`).
- Shared utilities/API modules: `camelCase.ts` / `*.api.ts`.
- Prefer path alias imports with `@/` when practical (configured in `vite.config.ts`).
- Run `npm run lint` before pushing.

## Testing Guidelines
- Framework: Vitest + Testing Library (`jsdom` environment).
- Name tests `*.test.ts` or `*.test.tsx`, next to the file under test.
- Focus on behavior regressions (routing, loading states, auth flows, API mapping).
- Minimum expectation for PRs: added/updated tests for changed behavior and a passing `npm run test` + `npm run check`.

## Commit & Pull Request Guidelines
- Follow the observed commit pattern: `type(scope): summary` (for example `feat(auth): normalize callback redirects`).
- Common types in this repo: `feat`, `test`, `docs`, `fix`, `chore`.
- Keep commits focused and reviewable; avoid mixing unrelated concerns.
- PRs should include a concise problem/solution summary, linked issue/phase reference, and test evidence (commands run).
- Add screenshots for UI changes.
- Add migration/function rollout notes when touching `supabase/`.

## Security & Configuration Tips
- Start from `.env.example`; keep local values in `.env.local`.
- Never commit secrets. Client-safe values use `VITE_*`; server secrets belong in Supabase Function secrets.
- For invite/auth changes, verify redirect URLs and setup docs in `docs/supabase/SUPABASE_EDGE_FUNCTION_SETUP.md`.
