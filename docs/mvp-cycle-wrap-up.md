> **Document status:** implemented on `main`. Retained as historical context, not as a current description of the app. Device acceptance in this specification has not been claimed.

# MVP feature: cycle wrap-up and comparison

Authority: [final MVP plan](mvp-final-implementation-plan.md). Originally a specification.

Decision taken on 2026-09-08 by the owner: build the **thin** wrap-up. History's Cycle tab already renders weekly rhythm and a per-practice breakdown; do not rebuild either inside the wrap-up. The wrap-up owns the completion moment and the cross-cycle comparison, and links into History for detail.

## Experience

Add a routed, scrollable page, proposed `app/cycles/[cycleId]/summary.tsx`, for completed and early-ended cycles. Home's completion state offers “View wrap-up”; successful early ending offers the same destination. History exposes “View wrap-up” for every finished cycle. Preserve access after another cycle starts. An active-cycle or invalid ID shows an appropriate state with a way back, not a fabricated final result.

The page contains, in order:

1. Cycle name, actual date range, duration and “Completed” or “Ended early”.
2. Total sessions, recorded minutes, active days out of cycle days and activity-day percentage.
3. Comparison with the previous finished cycle, with a selector for another earlier finished cycle.
4. Descriptive highlights: longest run of consecutive active days, busiest week and most-logged practice.
5. “Back up data”, “Repeat cycle”, and “See full activity” opening this cycle in History. Show backup freshness using the durability service; repeat uses the existing setup flow and never silently creates a cycle.

Weekly rhythm charts and per-practice rows are deliberately absent; “See full activity” is how the owner reaches them. Because the page carries no charts, every value on it is already text, so no chart/text-equivalence work is required.

No forced rating, reflective form or dismissal gate. Empty cycles say “No sessions recorded” and still allow backup/repeat. Loading, missing/deleted records and query errors each have distinct states. Match existing design tokens and reusable components.

## Metric contract

Use one pure selector for wrap-up and comparison; align reused archive/completion metrics with it. Inputs include a finished cycle, its goals/configurations, and already-resolved effective sessions. Filter by goal ownership and inclusive actual cycle bounds. Corrected rows count once; tombstoned sessions do not count. Never sum base sessions and revisions together.

| Metric | Definition |
| --- | --- |
| Cycle days | Inclusive local-calendar days from start through stored actual end date; do not use the original duration field for early-ended cycles |
| Sessions | Number of in-range effective sessions |
| Recorded minutes | Sum of non-null durations; missing durations are unknown, not inferred from practice targets |
| Active days | Distinct local dates with one or more effective sessions |
| Activity-day percentage | Active days / cycle days × 100 |
| Sessions per week | Sessions / cycle days × 7; display one decimal |
| Recorded minutes per week | Recorded minutes / cycle days × 7, with duration-coverage context |
| Longest active-day run | Maximum consecutive local-calendar dates with sessions; multiple sessions on a day count as one day |
| Busiest week | Monday–Sunday bucket with most sessions, then most recorded minutes, then earliest date; label boundary weeks as partial |
| Most-logged practice | Highest effective session count; deterministic tie by goal ID; use “joint most-logged” for a displayed tie |

Use local date arithmetic, not millisecond division across DST. Guard invalid/inverted ranges as data errors. Show “Minutes recorded for X of Y sessions” when duration coverage is incomplete; zero sessions has no coverage percentage.

Name the most-logged practice by its name at its final membership date within the cycle, and keep separate goal identities separate even if their names match. Do not call it “most consistent”: `cycleSummary.mostConsistentPracticeName` already uses that word on Home for the same session-count calculation, so rename that field as part of this work rather than shipping two names for one idea.

Do not introduce target attainment scores or streak-of-target-success metrics in this MVP; they would require resolving broader target-change semantics.

Per-practice rows and weekly rhythm are out of scope for this page. `historyInsights` already computes both for the History Cycle tab; reuse by linking, not by re-rendering.

## Comparison contract

Eligible baselines are other finished cycles whose actual end date is before the selected cycle's start date. Default to the latest end date, then latest start date, then stable ID. List completed and early-ended baselines with date ranges, lengths and status; exclude active, overlapping and future cycles. Selection is page state and must refresh when source data changes.

Show selected/baseline values and absolute differences for sessions, recorded minutes, active days, activity-day percentage, sessions/week and recorded minutes/week. Label activity percentage differences in percentage points. Emphasize activity-day percentage and sessions/week for unequal lengths; explicitly state “Cycles have different lengths” and show both day counts. Rate comparisons are descriptive, not a claim that difficulty or practice mix is equal.

Example: 60 sessions in 30 days and 120 in 60 days both equal 14 sessions/week. A change from 40% to 50% active days is +10 percentage points. Do not display infinity or percentage growth against a zero baseline; absolute differences are sufficient. Missing-duration coverage appears for both cycles and minute differences are labeled “recorded minutes”.

No eligible history: hide the selector and show “Your next cycle will have a comparison.” Per-practice cross-cycle matching is deferred because repeated cycles use new goal IDs and names are not reliable identities. Compare aggregate cycle metrics only. Do not add an all-time ranking or averages across all cycles as another release requirement.

Wrap-ups are live derived views, not frozen snapshots: historical corrections update both sides on return/focus. Opening a wrap-up writes nothing and never changes lifecycle state by itself. Reuse existing lifecycle reconciliation for natural completion. Do not persist derived aggregates.

## Implementation and verification

Extend or compose `cycleSummary.ts` and `cycleArchive.ts`, add a bounded selected/baseline query hook, and reuse the existing SQL effective-session resolution in `sessionRepository.effectiveSessionSql`. Load only the two selected cycles' detail records; the selector can use lightweight cycle metadata. Register the new route in `app/_layout.tsx` alongside the existing `cycles/[cycleId]/*` entries; there is no `cycles/[cycleId]/_layout.tsx` and this feature does not need one. Wire Home, History and early-end actions without disturbing their current hook-order fixes. No schema migration is needed.

Metric alignment across screens is a smaller problem than it looks. Home, History and the archive all read the same effective-session query, and the one real divergence — `cycleArchive.activeDayRatio` dividing by *elapsed* days — only affects active cycles, which the wrap-up never shows. Verify that equivalence with a test rather than refactoring the three existing builders into one.

Automated cases: first/empty cycle; natural/early ending; unequal lengths; baseline selection/ties; zero baseline; missing durations; weekday boundary and DST; practice joining/leaving/renaming; duplicate names; corrected, moved and deleted sessions; longest-run ties; route errors; changing baseline; focus refresh after correction; summary access after repeat; backup CTA navigation; and agreement between wrap-up totals and the Home/History values for the same finished cycle. Assert selector values independently with hand-calculated fixtures.

Device acceptance: finish a cycle, read and switch comparisons, follow “See full activity” into History, correct a session, return and see recalculated totals, repeat through setup, and reopen the old wrap-up from History. Verify readable long names, large text and VoiceOver reading order. Record evidence under the final MVP acceptance checklist.
