> MVP scope update (2026-09-08): [Final MVP implementation plan](mvp-final-implementation-plan.md) is authoritative for remaining work: cycle wrap-up and durable backup/restore. Broader M11–M16 requirements and old handoffs are deferred unless explicitly included there. Historical implementation evidence below remains valid.

# Hexis Milestones

**Completion program:** [Completion objective and delivery plan](completion-objective-and-delivery-plan.md)
defines the authoritative M11–M16 scope, task breakdown, contracts, and acceptance
gates. It uses a free Apple ID with owner-accepted seven-day renewal; no paid
developer membership is required. The M0–M10 table below remains the original
implementation record, including its pending physical-device checks.

This is the at-a-glance roadmap for Hexis. Each milestone maps to a phase in
`docs/implementation-plan.md`, which holds the detailed task/step breakdown.
Update the status column as work lands; log the supporting detail for each
completed milestone in `progress/YYYY-MM-DD.md`. Multi-agent branch ownership,
dependency gates, and merge waves are defined in `docs/parallel-delivery-plan.md`.

| # | Milestone | Maps to | Exit criteria | Status |
| --- | --- | --- | --- | --- |
| M0 | Development loop proven | Preflight — Task 0 | Private GitHub repo with `origin`, initial commit pushed, `expo start --go` runs, "Hexis ready" confirmed live on a physical iPhone via Expo Go with working Fast Refresh | ✅ Done |
| M1 | App foundation & design tokens | Phase 0 — Tasks 1–2 | Expo Router stack configured, Jest + RNTL smoke test passing, `tsc --noEmit` clean, Porcelain & Ink tokens defined, `GlassSurface` renders a working non-glass fallback | ✅ Done |
| M2 | Cycle domain & local persistence | Phase 1 — Tasks 3–4 | Pure date/progress domain functions covered by deterministic tests; SQLite schema, migrations, and cycle/goal/session repositories enforce v1 invariants (single active cycle, forward-only revisions, immutable logs) | ✅ Done |
| M3 | Cycle setup & goal editing | Phase 2 — Tasks 5–6 | New-cycle onboarding (welcome → duration → practices → review) creates a cycle + goal snapshots in one transaction; returning-user goal editor writes forward-only revisions without mutating past logs | ✅ Done |
| M4 | Landing page & direct logging | Phase 3 — Tasks 7–8 | Active-cycle landing page shows header, accessible contribution calendar, and unified goal list; one-tap **Log** flow with quick durations writes exactly one immutable session log and refreshes the landing view | ✅ Done |
| M5 | Navigation shell: tabs & back-stack | Phase 4 — Tasks 9–10 | Persistent bottom tab bar (Home, History, Week, Settings) visible with or without an active cycle, Home showing an empty "Start a cycle" state when none exists; cycle setup and goal editing refactored into routed, back-navigable full-screen modals with native header back and swipe-back; Settings consolidates goal editing, reminder placeholder, and end-cycle-early | ✅ Done |
| M6 | Cycle completion, unified history & personal device build | Phase 5 — Tasks 11–14 | Cycles automatically transition from active to completed once their end date passes; Home shows a completion summary; History has Day/Week/Cycle filters; the daily reminder respects permission state; automated checks pass; and a signed local Xcode build runs on a personal iPhone | ✅ Done — signed Xcode/iPhone flow confirmed by the user on 2026-08-23 |
| M7 | Historical activity timeline & corrections | Phase 6 — Tasks 15–18 | Sessions have actual start timestamps; every elapsed cycle day has a chronological session timeline; a person can add an earlier activity and edit or delete an existing one; corrections are append-only revisions rather than destructive rewrites; all Home/History summaries use the effective session state | ✅ Done |
| M8 | Editable active-cycle membership | Phase 7 — Tasks 19–22 | A person can add a practice to or stop tracking a practice in an active cycle, effective from the current local date forward; past dates, logs, and target history remain intact; Home and History respect goal membership boundaries; no cycle-goal row is physically deleted | 🟨 Implemented — physical-device boundary pass pending |
| M9 | Useful active-cycle dashboard | Phase 8 — Tasks 23–25 | Home answers what remains this week and what has happened recently: total sessions/minutes, targets remaining, days left in the week, per-practice remaining progress, and a compact recent rhythm; information is descriptive, accessible, and derived from logs/revisions without stored aggregates | 🟨 Implemented — physical-device visual/VoiceOver pass pending |
| M10 | Cross-cycle archive & repeat-cycle flow | Phase 9 — Tasks 26–29 | History can browse every active, completed, and early-ended cycle; archive summaries make cycles distinguishable; selecting a cycle preserves Day/Week/Cycle navigation bounds; **Repeat cycle** pre-fills setup from the source cycle's final active practices without copying logs or identifiers | 🟨 Implemented — physical-device archive/repeat pass pending |

## Working agreement

For M11–M16, use the ownership, dependency, and evidence rules in the
[completion plan](completion-objective-and-delivery-plan.md#7-agent-execution-and-integration-rules).
The following agreement describes the earlier M0–M10 delivery process.

- A task begins once its dependency gate in `docs/parallel-delivery-plan.md` is merged. Independent implementation and UI scaffolding may run ahead in isolated worktrees.
- Milestone completion still requires its integration, automated, documentation, and device exit criteria; an early branch does not advance milestone status by itself.
- Each completed task within a milestone gets its own dated entry in `progress/`.
- `docs/implementation-plan.md` is the source of truth for step-level detail; this file only tracks milestone-level status.
