# Phase 1: Loading Core Foundation - Context

**Gathered:** 2026-02-26
**Status:** Ready for planning

<domain>
## Phase Boundary

Introduce one global loading infrastructure that safely coordinates async operations through a canonical full-page loading UI, delayed reveal behavior to avoid flicker, and guaranteed lifecycle cleanup across success/error/cancellation paths.

</domain>

<decisions>
## Implementation Decisions

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

</decisions>

<specifics>
## Specific Ideas

- Spinner implementation reference from user:
  - Install: `npx shadcn@latest add https://21st.dev/r/ravikatiyar162/loader-15`
  - Usage: `import Loader from "@/components/ui/loader-15";`
- User preference: in ambiguous cases, show loading feedback rather than risking unclear system state to customers.

</specifics>

<deferred>
## Deferred Ideas

None - discussion stayed within phase scope.

</deferred>

---

*Phase: 01-loading-core-foundation*
*Context gathered: 2026-02-26*
