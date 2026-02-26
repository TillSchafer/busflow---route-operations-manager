# Codebase Concerns

**Analysis Date:** 2026-02-26

## Tech Debt

**Large legacy page components still carry heavy responsibility:**
- Issue: Several route pages are still monolithic despite new feature-first wrappers.
- Evidence:
  - `src/pages/PlatformAdmin.tsx` (~900 LOC)
  - `src/pages/TeamAdmin.tsx` (~555 LOC)
  - `src/apps/busflow/components/RouteEditor.tsx` (~651 LOC)
  - `src/apps/busflow/BusflowApp.tsx` (~613 LOC)
- Why: Refactor introduced wrappers first to keep behavior stable.
- Impact: Higher regression risk, difficult code ownership, slower onboarding.
- Fix approach: Continue phase-wise decomposition into `features/*` and sub-hooks/components.

**Hybrid routing layer (`features/*` wrappers + `pages/*` implementations):**
- Issue: Indirection helps migration but doubles navigation of code references.
- Impact: Easy to modify wrapper without touching legacy behavior source.
- Fix approach: Move core logic from `pages/*` into feature-local modules and retire wrappers.

## Known Bugs / Operational Gaps

**No repository CI workflow file detected:**
- Symptoms: Local checks pass, but no enforced PR gate visible in-repo.
- Trigger: Any contributor can skip `npm run check` before merge.
- Workaround: Manual local gate.
- Root cause: Missing `.github/workflows/*` in repository.

**Edge function inventory includes runtime-unused candidates:**
- Functions: `platform-send-password-reset`, `admin-update-user-v1`.
- Symptoms: Operational surface area grows without product-path validation.
- Trigger: Security hardening/upgrade tasks must still account for dormant endpoints.
- Workaround: Keep smoke tested and documented as candidates.
- Root cause: API implemented before UI/runtime caller adoption.

## Security Considerations

**`verify_jwt = false` for all configured edge functions:**
- Risk: Gateway-level JWT enforcement disabled; each function must enforce auth manually.
- Current mitigation: Manual Authorization parsing + permission checks inside function code.
- Recommendations:
  - Keep explicit auth checks audited per function.
  - Document intentional exceptions per function and periodically re-validate drift.

**Client-side direct table access remains broad:**
- Risk: Frontend knows table structure and relies heavily on RLS correctness.
- Current mitigation: account-scoped filters and migration-based RLS governance.
- Recommendations:
  - Prefer RPC/functions for privileged or complex mutations.
  - Continue periodic RLS audits and boundary smoke checks.

## Performance Bottlenecks

**Bundle/chunk pressure still notable in main and BusFlow routes:**
- Measurement from latest build:
  - main chunk `dist/assets/index-*.js` ~447 kB (uncompressed)
  - `BusflowAppPage-*.js` ~115 kB
- Cause: Large page modules and rich domain UI in single routes.
- Improvement path:
  - Deeper component splitting in admin and busflow modules.
  - Optional manual chunk strategy if route-level split plateaus.

## Fragile Areas

**Auth callback normalization + account security flows:**
- Why fragile: URL query/hash payload combinations (`code`, `token_hash`, `access_token`, `type`) drive multiple critical flows.
- Common failures: Wrong redirect type mapping can break invite/recovery/email-change.
- Safe modification: Update `src/features/auth/lib/auth-callback.ts` first and keep tests in sync.
- Test coverage: Present but minimal (utility-level only).

**Tenant/account scoping across mixed query paths:**
- Why fragile: Some operations go through functions/RPC, others through direct PostgREST queries.
- Common failures: Missing `account_id` guard can leak or block data.
- Safe modification: Keep `requireActiveAccountId()` + `.eq('account_id', ...)` patterns mandatory.
- Test coverage: Limited integration coverage for client-table queries.

## Scaling Limits

**Operational testing depth is still lightweight:**
- Current capacity: Basic unit/component checks + manual/CLI supabase smoke scripts.
- Limit: Regression risk for full multi-role tenant workflows.
- Symptoms at limit: Breakages discovered late (staging/prod) for cross-module flows.
- Scaling path: Add CI + targeted integration tests for admin/busflow/auth-critical journeys.

## Dependencies at Risk

**Telemetry and SDK version drift risk:**
- Packages: Supabase JS, React Router, Vite, Tailwind, Vercel telemetry libs.
- Risk: Minor-to-major upgrades can alter runtime behavior (routing/auth/build output).
- Impact: Auth callback handling, build output, or edge invocations may regress.
- Migration plan: Keep lockfile updates paired with `npm run check` + smoke scripts.

## Missing Critical Features

**No formal CI gate in-repo:**
- Problem: Quality gates rely on developer discipline.
- Current workaround: manual local execution (`npm run check`, `npm run test`).
- Blocks: consistent merge quality and automated regression confidence.
- Implementation complexity: Low-to-medium (add GitHub Actions workflow).

**No full browser E2E suite:**
- Problem: Core user journeys are not validated end-to-end in one automated run.
- Current workaround: manual testing + supabase script checks.
- Blocks: confidence in auth/invite/profile/admin integration changes.
- Implementation complexity: Medium.

## Test Coverage Gaps

**Admin mutation workflows:**
- What's not tested deeply: role change edge cases, invitation lifecycle, destructive delete paths.
- Risk: authorization regressions or accidental behavior drift.
- Priority: High.
- Difficulty: Medium (needs seeded auth matrix and controlled fixtures).

**BusFlow integration behavior:**
- What's not tested deeply: full route CRUD with RPC conflict handling + realtime refresh interplay.
- Risk: subtle data consistency bugs.
- Priority: High.
- Difficulty: Medium-high (requires integration harness and account fixtures).

---

*Concerns audit: 2026-02-26*
*Update as risks are mitigated or newly discovered*
