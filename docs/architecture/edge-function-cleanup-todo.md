# Edge-Function Cleanup To-do (Phase 1)

Date: 2026-02-24

- [x] Preflight snapshot: remote functions + git status collected.
- [x] Usage evidence documented (`edge-function-inventory.md`).
- [x] DB read-only CLI checks executed (partial success, blockers documented).
- [x] Conservative local config cleanup prepared (`supabase/config.toml`).
- [x] Remote legacy functions deleted (`admin-delete-user`, `admin-delete-user-v2`, `smart-function`).
- [x] Post-delete verification (`supabase functions list`).
- [x] Regression checks (`npm run typecheck`, `npm run lint`, `npm run build`).
- [x] Migration workflow switch scaffolded to `supabase/migrations` + docs updated.
- [x] Final closure report updated with completed evidence.
