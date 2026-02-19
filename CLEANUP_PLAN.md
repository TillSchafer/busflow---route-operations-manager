# BusFlow Cleanup Plan (Phase 0)

## Scope
Safety-first cleanup with no functional regressions.

## Baseline (captured on 2026-02-19)
- Stack: React 19, TypeScript, Vite, React Router, Supabase.
- Commands in `package.json`: `dev`, `build`, `preview`, `typecheck`, `lint`, `check`.
- Baseline execution:
  - `npm run build` -> PASS
  - `npm run check` -> PASS
  - `npm run test` -> FAIL (`Missing script: test`) before this phase
- Main technical hotspots by file size:
  - `src/apps/busflow/api.ts` (~1106 lines)
  - `src/apps/busflow/BusflowApp.tsx` (~1013 lines)
  - `src/apps/busflow/components/Settings.tsx` (~977 lines)
  - `src/apps/busflow/components/RouteEditor.tsx` (~766 lines)
  - `src/pages/Admin.tsx` (~562 lines)
- Security finding:
  - `supabase/config.toml`: `functions.invite-account-user.verify_jwt` was `false` (changed to `true` in this phase).

## Hard Rules
- Never delete code or files without evidence.
- Every cleanup action must include:
  - import/reference search proof
  - route/entrypoint verification
  - dynamic import/environment usage check
  - Supabase query/RPC usage check (where relevant)
- If uncertain: mark candidate as `HOLD`, do not delete.

## Evidence Standard
For every delete/refactor candidate, document:
1. `Path`
2. `Claim` (unused/duplicate/obsolete)
3. `Evidence` (`rg` references, routing checks, dynamic usage checks)
4. `Decision` (`KEEP` / `REFACTOR` / `DELETE`)
5. `Risk`
6. `Validation` (build/check/smoke result after change)

## Phase Checklist

### Phase 0 — Baseline & Safety
- [x] Verify framework, scripts, and current commands.
- [x] Capture baseline run results.
- [x] Add central cleanup plan/checklist (`CLEANUP_PLAN.md`).
- [x] Add missing `test` script as smoke gate.
- [x] Apply immediate low-risk security hardening (`verify_jwt = true` for invite function).

### Phase 1 — Unused Code/Files Discovery
- [x] Build repository inventory (entrypoints, routes, modules, utilities).
- [x] Generate delete candidate table with evidence.
- [x] Execute only 100% verified safe removals.

### Phase 2 — Structure Refactor (No Behavior Change)
- [x] Split `api.ts` into route/customer/contact/import/settings modules.
- [ ] Split `BusflowApp.tsx` into orchestration hooks + presentational sections.
- [ ] Split `Settings.tsx` into list/import/delete/dialog modules.
- [ ] Keep external behavior and interfaces stable.

### Phase 3 — Supabase Cleanup (Migration-first)
- [x] Build "used-by" map for tables/views/functions/triggers/policies.
- [x] Mark drift/legacy artifacts and cleanup candidates.
- [x] Remove unused DB artifacts via idempotent migrations only.
- [ ] Run auth/RLS/CRUD smoke validation after each migration.

### Phase 4 — Quality Gates & Dependencies
- [ ] Add/expand smoke tests.
- [x] Remove unused dependencies with evidence.
- [ ] Optional bundle analysis and targeted code splitting.

## Prioritized First 10 Actions (with risk)
1. Create and maintain this plan as single source of truth. (Low)
2. Close `npm run test` gap with smoke gate. (Low-Medium)
3. Enforce JWT verification for `invite-account-user`. (Medium)
4. Build Supabase artifact inventory with "used-by" mapping. (Low)
5. Remove only obvious dead artifacts (empty folders/files) after proof. (Low)
6. Split `api.ts` by domain. (Medium)
7. Split `BusflowApp.tsx` orchestration from views. (Medium-High)
8. Split `Settings.tsx` workflows into smaller modules. (Medium-High)
9. Consolidate migration governance and canonical owners. (Medium)
10. Remove unused dependencies with reference evidence. (Low-Medium)

## Validation Gate (required after each cleanup step)
1. `npm run test`
2. `npm run check`
3. Manual smoke:
   - Login/Logout
   - Route create/edit/delete
   - Customer/contact CRUD
   - CSV import + bulk delete
   - Admin invite flow

## Notes
- This phase intentionally avoids behavioral refactors.
- No deletions are performed in Phase 0.
