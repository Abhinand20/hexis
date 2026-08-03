# Hexis Milestones

This is the at-a-glance roadmap for Hexis. Each milestone maps to a phase in
`docs/implementation-plan.md`, which holds the detailed task/step breakdown.
Update the status column as work lands; log the supporting detail for each
completed milestone in `progress/YYYY-MM-DD.md`.

| # | Milestone | Maps to | Exit criteria | Status |
| --- | --- | --- | --- | --- |
| M0 | Development loop proven | Preflight — Task 0 | Private GitHub repo with `origin`, initial commit pushed, `expo start --go` runs, "Hexis ready" confirmed live on a physical iPhone via Expo Go with working Fast Refresh | ✅ Done |
| M1 | App foundation & design tokens | Phase 0 — Tasks 1–2 | Expo Router stack configured, Jest + RNTL smoke test passing, `tsc --noEmit` clean, Porcelain & Ink tokens defined, `GlassSurface` renders a working non-glass fallback | ✅ Done |
| M2 | Cycle domain & local persistence | Phase 1 — Tasks 3–4 | Pure date/progress domain functions covered by deterministic tests; SQLite schema, migrations, and cycle/goal/session repositories enforce v1 invariants (single active cycle, forward-only revisions, immutable logs) | ✅ Done |
| M3 | Cycle setup & goal editing | Phase 2 — Tasks 5–6 | New-cycle onboarding (welcome → duration → practices → review) creates a cycle + goal snapshots in one transaction; returning-user goal editor writes forward-only revisions without mutating past logs | ✅ Done |
| M4 | Landing page & direct logging | Phase 3 — Tasks 7–8 | Active-cycle landing page shows header, accessible contribution calendar, and unified goal list; one-tap **Log** flow with quick durations writes exactly one immutable session log and refreshes the landing view | ✅ Done |
| M5 | Navigation shell: tabs & back-stack | Phase 4 — Tasks 9–10 | Persistent bottom tab bar (Home, History, Week, Settings) visible with or without an active cycle, Home showing an empty "Start a cycle" state when none exists; cycle setup and goal editing refactored into routed, back-navigable full-screen modals with native header back and swipe-back; Settings consolidates goal editing, reminder placeholder, and end-cycle-early | ✅ Done |
| M6 | Cycle completion, unified history & personal device build | Phase 5 — Tasks 11–14 | Cycles automatically transition from active to completed once their end date passes (no more domain dead-end), and Home shows an achievement summary with a **Start a new cycle** action; the separate Week tab is folded into a single History tab with Day/Week/Cycle filters built from pure summary selectors; optional app-level daily reminder with a time picker respects permission state; full automated suite (`jest`, `tsc`, `expo-doctor`) is green; manual device validation complete; app installed and verified on a personal iPhone via a local Xcode build | 🟨 In progress — Tasks 11–13 and the automated portion of Task 14 done; manual device validation and the local Xcode install remain |
| M7 | Accessible interaction pass | Phase 6 — Tasks 15–17 | Informational contribution-calendar cells no longer claim to be buttons; every in-app action has an effective 44 × 44 pt touch target; VoiceOver receives accurate roles/labels/states; critical layouts remain usable at large Dynamic Type sizes; automated and physical-device accessibility checks pass | 🟦 Planned — begins after M6's device validation is complete |

## Working agreement

- No milestone begins before the previous one's exit criteria are met and recorded.
- Each completed task within a milestone gets its own dated entry in `progress/`.
- `docs/implementation-plan.md` is the source of truth for step-level detail; this file only tracks milestone-level status.
