# Dependency Audit

Evidence-based dependency status for current cleanup cycle.

## Runtime Dependencies

| Package | Evidence | Decision |
|---|---|---|
| `@supabase/supabase-js` | Imported by `src/shared/lib/supabase.ts` and edge function code | KEEP |
| `@vercel/analytics` | Imported by `src/App.tsx` | KEEP |
| `@vercel/speed-insights` | Imported by `src/App.tsx` | KEEP |
| `lucide-react` | Used across UI components | KEEP |
| `react` | App runtime | KEEP |
| `react-dom` | Entry render (`src/index.tsx`) | KEEP |
| `react-router-dom` | Routing (`src/index.tsx`, `src/App.tsx`) | KEEP |
| `recharts` | Only used by deleted `PassengerChart.tsx` | REMOVE (done) |

## Dev Dependencies

| Package | Evidence | Decision |
|---|---|---|
| `@eslint/js` | `eslint.config.js` | KEEP |
| `@types/node` | Type tooling | KEEP |
| `@typescript-eslint/eslint-plugin` | `eslint.config.js` | KEEP |
| `@typescript-eslint/parser` | `eslint.config.js` | KEEP |
| `@vitejs/plugin-react` | `vite.config.ts` | KEEP |
| `eslint` | lint script | KEEP |
| `eslint-plugin-react-hooks` | lint config | KEEP |
| `globals` | lint config | KEEP |
| `supabase` | CLI usage for migrations/functions | KEEP |
| `typescript` | typecheck/build | KEEP |
| `vite` | dev/build runtime | KEEP |

## Follow-ups

- Re-run dependency scan after Phase 2 splits to catch newly orphaned packages.
- Keep removal policy strict: no uninstall without code-reference evidence and successful gates.

