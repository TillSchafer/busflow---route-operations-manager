# BusFlow Unified Loading Experience

## What This Is

A platform-wide loading standard for the existing BusFlow web application. The goal is to replace inconsistent loading behaviors with one unified full-page loading system that communicates clearly what is happening. This is for end users so they always understand that work is in progress instead of assuming the app is stuck.

## Core Value

Every waiting state feels predictable and trustworthy because users always see a clear, consistent loading experience.

## Requirements

### Validated

- ✓ Multi-route, role-aware web platform already exists (`/`, `/busflow`, `/profile`, `/adminbereich`, `/owner-bereich`, `/auth/*`) — existing
- ✓ Auth/session hydration and account-context switching already run asynchronously — existing
- ✓ BusFlow and admin modules already execute async data loads and mutations — existing
- ✓ Loading UI is currently inconsistent (`"Lade Ansicht"` vs `"Lade BusFlow"` and mixed action states) — existing

### Active

- [ ] Implement one centralized full-page loading screen system used across the complete platform.
- [ ] Apply loading coverage to all relevant async actions (route transitions, initial app hydration, data fetching, and user-triggered actions like save/delete/invite/import).
- [ ] Support action-specific loading text where available and use `Lade...` as global fallback text.
- [ ] Add short-delay display behavior to avoid flicker on very fast actions.
- [ ] Add accessibility support (`aria-busy`, screenreader-friendly status text, reduced-motion behavior).
- [ ] Remove/replace all currently divergent loading screens to ensure visual and behavioral consistency.

### Out of Scope

- Full visual redesign of unrelated UI areas — not required to deliver loading consistency.
- Functional changes to business workflows (routing/auth/tenant logic) beyond loading orchestration — avoid unnecessary risk.

## Context

This is a brownfield enhancement on the existing BusFlow codebase with a documented map in `.planning/codebase/`. The app uses React 19 + TypeScript + Vite + React Router + Tailwind + Supabase. Current loading behavior is split across different components and strings, causing user confusion. The target is consistency, clarity, and confidence across all user-visible wait states.

## Constraints

- **Tech stack**: Must use existing frontend stack and patterns — keep implementation aligned with current architecture.
- **Behavioral safety**: No breakage of existing URLs/user flows — this is a consistency hardening project.
- **Coverage scope**: Apply to all loading-prone actions — requested as full platform rollout in v1.
- **UX clarity**: Show loading only after short delay — prevents noisy flicker while preserving feedback on meaningful waits.
- **Accessibility**: Must include ARIA status semantics and reduced-motion support — explicit requirement.

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Use a full-page loading screen pattern | User should immediately understand system is working | — Pending |
| Scope includes all async actions | Remove inconsistency and duplicated behavior fully | — Pending |
| Allow context-specific loading messages | Better feedback than one generic message for every case | — Pending |
| Global fallback message is `Lade...` | Safe default when no specific action text exists | — Pending |
| Show loader after short delay | Avoid flicker on fast operations | — Pending |
| Include accessibility defaults (`aria-busy`, reduced-motion) | Required for robust user experience | — Pending |

---
*Last updated: 2026-02-26 after project initialization questioning*
