> **Document status:** implemented on `main`. Retained as historical context, not as a current description of the app. The backup call-to-action this plan omitted was added later. Device acceptance has not been claimed.

# Implementation plan: cycle wrap-up and comparison

Specification: [wrap-up spec](mvp-cycle-wrap-up.md). Authority: [final MVP plan](mvp-final-implementation-plan.md).
Base SHA: `7fe6394`. Branch: `codex/mvp-cycle-wrap-up`.

## Ownership and conflict boundary

This branch owns `src/features/cycles/domain/cycleWrapUp.ts` (new), `src/features/cycles/hooks/useCycleWrapUp.ts` (new), `app/cycles/[cycleId]/summary.tsx` (new), the route registration in `app/_layout.tsx`, the wrap-up entry points in `app/(tabs)/index.tsx` and `app/(tabs)/history.tsx`, and the `mostConsistentPracticeName` rename in `src/features/cycles/domain/cycleSummary.ts`.

Do **not** touch `src/db/**`, `src/features/backup/**`, `package.json`, or `app/(tabs)/settings/index.tsx`. The durability branch owns those.

**Omit the "Back up data" action entirely.** The spec lists it, but the durability service it depends on lands on the other branch. Ship "Repeat cycle" and "See full activity" only; integration step 5 adds the backup call-to-action and its freshness line after both branches merge. Do not stub it, and do not leave a placeholder button.

## What already exists

Read these before writing anything. The metrics are more complete than they look, and the point of this task is composition, not invention.

- `src/features/cycles/domain/cycleSummary.ts` — `buildCycleSummary(cycle, goals, revisions, logs)` already returns `activeDayCount` (inclusive days start→`endDate`, correct for early-ended cycles because `endCycleEarly` overwrites `end_date`), `loggedDayCount`, `practiceTotals` with per-goal counts and minutes named at `cycle.endDate`, `strongestWeekLabel`, and `mostConsistentPracticeName`. The private helpers `inclusiveDayCount`, `formatWeekLabel` and `strongestWeekLabel` are directly relevant; export or extract them rather than rewriting.
- `src/features/cycles/domain/cycleArchive.ts` — `buildCycleArchiveItems` and `formatCycleDateRange`.
- `src/features/cycles/domain/date.ts` — `addLocalDays`, `weekStart` (Monday), `todayLocalDate`, `localDateForInstant`. Use these; never divide milliseconds, which breaks across DST.
- `src/features/cycles/domain/cycleProgress.ts` — `goalConfigurationOn(goal, revisions, date)` resolves a practice's name and targets on a date.
- `src/features/logging/data/sessionRepository.ts` — `listForCycle(cycleId)` already returns **effective** sessions: latest revision wins, tombstones excluded, corrections counted once. Never sum base rows and revisions yourself.
- `src/features/cycles/data/cycleRepository.ts` — `listCycles()`, `getCycleById()`. `listCycles()` orders active first, then `start_date DESC`.
- `src/features/goals/data/goalRepository.ts` — per-cycle goals and revisions.

`buildCycleSummary` computes `strongestWeekLabel` from the unfiltered `logs` argument while everything else uses `inRangeLogs`. Confirm whether that is a latent bug for cycles whose sessions were moved out of range by a correction, and fix it if so.

## Task W1 — the pure selector

New file `src/features/cycles/domain/cycleWrapUp.ts`. Pure, no database access, no dates from `Date.now()` except via injected parameters.

```ts
export type WrapUpBusiestWeek = {
  weekStartDate: string;   // Monday, clamped to cycle bounds for display
  weekEndDate: string;     // Sunday, clamped
  sessions: number;
  recordedMinutes: number;
  isPartialWeek: boolean;  // week extends beyond the cycle on either side
};

export type WrapUpMetrics = {
  cycleDays: number;
  sessions: number;
  recordedMinutes: number;
  sessionsWithRecordedDuration: number;
  activeDays: number;
  activityDayPercentage: number;      // 0-100
  sessionsPerWeek: number;            // display to one decimal
  recordedMinutesPerWeek: number;
  longestActiveDayRun: number;
  busiestWeek: WrapUpBusiestWeek | null;
  /** More than one entry means a genuine tie: label it "joint most-logged". */
  mostLoggedPractices: { goalId: string; name: string; sessions: number }[];
};

export function buildCycleWrapUp(
  cycle: Cycle,
  goals: CycleGoal[],
  revisions: GoalRevision[],
  effectiveSessions: SessionLog[],
): WrapUpMetrics;
```

Rules, from the spec's metric contract:

- Filter to sessions whose `localDate` is within inclusive `[cycle.startDate, cycle.endDate]` **and** whose `cycleGoalId` belongs to this cycle's goals. Both filters matter: a correction can move a session outside the range.
- `cycleDays` counts inclusive local calendar days from `startDate` through the stored `endDate`. Never use `durationDays`, which is wrong for early-ended cycles.
- `recordedMinutes` sums non-null durations only. A missing duration is unknown; never infer it from a practice's expected duration. Track `sessionsWithRecordedDuration` so the page can say "Minutes recorded for X of Y sessions". Zero sessions has no coverage figure at all.
- `activityDayPercentage` = `activeDays / cycleDays * 100`.
- `sessionsPerWeek` = `sessions / cycleDays * 7`. Same shape for minutes.
- `longestActiveDayRun` counts consecutive local dates having at least one session; several sessions in a day count once. Walk with `addLocalDays`.
- `busiestWeek` buckets Monday–Sunday, ranked by sessions, then recorded minutes, then earliest date. Mark `isPartialWeek` when the bucket extends past either cycle bound.
- `mostLoggedPractices` ranks by effective session count, resolves each name via `goalConfigurationOn` at the practice's final membership date within the cycle, and returns every practice tied at the top sorted by goal ID for determinism. Empty when there are no sessions.
- Guard inverted or invalid ranges (`endDate < startDate`) as a data error rather than returning nonsense.
- Keep distinct goal identities distinct even when names match.

Do not add target attainment or streak-of-target-success metrics. Do not compute per-practice rows or weekly rhythm — those stay in History.

## Task W2 — comparison

Same file.

```ts
export type WrapUpComparison = {
  baseline: Cycle;
  selected: WrapUpMetrics;
  baselineMetrics: WrapUpMetrics;
  differences: {
    sessions: number;
    recordedMinutes: number;
    activeDays: number;
    activityDayPercentagePoints: number;
    sessionsPerWeek: number;
    recordedMinutesPerWeek: number;
  };
  hasDifferentLengths: boolean;
};

export function eligibleComparisonBaselines(
  allCycles: Cycle[],
  selected: Cycle,
): Cycle[];

export function buildWrapUpComparison(
  selected: WrapUpMetrics,
  baseline: Cycle,
  baselineMetrics: WrapUpMetrics,
  selectedCycle: Cycle,
): WrapUpComparison;
```

- Eligible baselines are finished cycles (`completed` or `ended_early`) whose `endDate` is strictly before the selected cycle's `startDate`. Exclude active, overlapping and future cycles.
- Default ordering: latest `endDate`, then latest `startDate`, then stable ID. The default baseline is the first entry.
- Report **absolute** differences only. Never a percentage change against a zero baseline, and never infinity.
- Activity-day differences are in percentage **points**, and must be labelled that way.
- Set `hasDifferentLengths` when `cycleDays` differ; the page then states "Cycles have different lengths" and shows both day counts, emphasising activity-day percentage and sessions per week.
- Minute differences are labelled "recorded minutes", and duration coverage is shown for both sides.
- No eligible history: `eligibleComparisonBaselines` returns empty, the selector is hidden, and the page shows "Your next cycle will have a comparison."

Per-practice cross-cycle matching is deferred: repeated cycles create new goal IDs and names are not reliable identities. Compare aggregate metrics only. No all-time rankings or averages.

## Task W3 — data hook

New file `src/features/cycles/hooks/useCycleWrapUp.ts`. Follow the existing pattern in `useCycleHistory.ts` — `useDatabase()`, `useState`, `useEffect`, a cancelled flag, and a discriminated status union.

```ts
export type CycleWrapUpState =
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "not_found" }
  | { status: "active_cycle"; cycle: Cycle }
  | {
      status: "ready";
      cycle: Cycle;
      metrics: WrapUpMetrics;
      baselines: Cycle[];
      comparison: WrapUpComparison | null;
    };

export function useCycleWrapUp(
  cycleId: string | undefined,
  baselineCycleId: string | null,
  refreshVersion: number,
): CycleWrapUpState;
```

- An active cycle returns `active_cycle`, not a fabricated final result. A missing or unknown ID returns `not_found`.
- Load detail records for the selected cycle and the chosen baseline only. The baseline selector uses `listCycles()` metadata, which needs no session queries.
- Wrap-ups are live derived views. Refresh on focus with `useFocusEffect` bumping a counter, exactly as Home and History do, so a correction made in History updates both sides on return. Opening a wrap-up writes nothing and never changes lifecycle state.
- Persist nothing. No derived aggregates in the database, no schema migration.

## Task W4 — the route

New file `app/cycles/[cycleId]/summary.tsx`, registered in `app/_layout.tsx` beside the existing `cycles/[cycleId]/add-goal` and `cycles/[cycleId]/edit-goal/[goalId]` entries. There is no `app/cycles/[cycleId]/_layout.tsx` and this feature does not need one. Use a pushed screen with a visible header and title "Cycle wrap-up", not a modal, since it is a destination the owner returns to.

Scrollable, in this order:

1. Cycle name, `formatCycleDateRange`, day count, and "Completed" or "Ended early".
2. Sessions, recorded minutes with coverage context, active days out of cycle days, activity-day percentage.
3. Comparison block with a baseline selector, or the no-history message.
4. Highlights: longest active-day run, busiest week, most-logged practice (or "joint most-logged" on a tie).
5. Actions: "Repeat cycle" and "See full activity".

- "Repeat cycle" pushes `/setup/duration?repeatCycleId=<id>`, matching `app/(tabs)/history.tsx`. It must never silently create a cycle.
- "See full activity" opens this cycle in History. History already reads a `cycleId` param and keeps Day/Week/Cycle bounds.
- Distinct states for loading, `not_found`, `active_cycle` and query errors, each with a way back. Empty cycles say "No sessions recorded" and still allow repeat.
- No charts, so every value is already text and no chart/text-equivalence work is needed. No forced rating, reflective form or dismissal gate.
- Match `src/design/tokens.ts` and reuse existing components, including `GlassSurface`, the way `CycleSummaryCard` does.

## Task W5 — entry points

- `app/(tabs)/index.tsx` — the completed-cycle branch currently renders `CycleSummaryCard` with only "Start a new cycle". Add "View wrap-up" pushing `/cycles/<id>/summary`. The completed cycle comes from `useCycleLanding`.
- `app/(tabs)/history.tsx` — add "View wrap-up" for every finished cycle, beside the existing "Repeat cycle" action. Access must survive starting another cycle, which it does because the route takes an explicit ID.
- Early ending currently navigates to `/` from Settings, which this branch does not own. Leave it alone and note in the PR that routing a successful early end to the wrap-up is an integration step.

Both files carry the hook-order fix from `ef0d155`, where four `useCallback` declarations were moved above the early returns. Add new hooks **above** the guards and do not reintroduce conditional hook ordering.

## Task W6 — the rename

The spec forbids calling the most-logged practice "most consistent", and `cycleSummary.ts` already exports `mostConsistentPracticeName` for the identical session-count calculation used on Home. Rename it to `mostLoggedPracticeName` across `CycleAchievementSummary`, `buildCycleSummary`, `CycleSummaryCard`, and `__tests__/domain/cycleSummary.test.ts`, plus any other reference. Shipping two names for one idea is worse than the rename. Keep the calculation identical apart from adopting the deterministic goal-ID tie-break.

## Task W7 — tests

`__tests__/domain/cycleWrapUp.test.ts` — assert every metric against hand-calculated fixtures, independently of the UI. Cover: first and empty cycle; natural completion and early ending; the `durationDays` versus stored `endDate` distinction; missing durations and coverage; sessions moved out of range by a correction; tombstoned sessions excluded; corrected sessions counted once; longest-run ties and single-day runs; busiest-week ranking through all three tie-breaks; partial boundary weeks; a cycle starting mid-week; a DST transition; practices joining, leaving and being renamed; duplicate practice names; joint most-logged; inverted ranges.

Comparison cases: unequal lengths with the spec's worked example (60 sessions in 30 days and 120 in 60 days both equal 14 sessions per week); 40% to 50% active days reported as +10 percentage points; a zero baseline producing no infinity or percentage growth; baseline eligibility excluding active, overlapping and future cycles; default selection and its tie-breaks; empty eligibility.

`__tests__/components/cycleWrapUp.test.tsx` — route errors for unknown and active cycles; changing the baseline; focus refresh after a correction recalculates both sides; the empty-cycle state; repeat navigation carrying the right ID; "See full activity" navigation; long practice names remaining readable; absence of any backup action on this branch.

`__tests__/domain/cycleSummary.test.ts` — update for the rename, and add a case asserting wrap-up totals equal `buildCycleSummary` and `buildCycleArchiveItems` values for the same finished cycle. That equivalence test is the reason the three builders need not be refactored into one: they all read the same effective-session query, and the only real divergence, `cycleArchive.activeDayRatio` dividing by *elapsed* days, affects active cycles only, which the wrap-up never shows.

## Definition of done for this branch

`npx jest --runInBand` and `npm run typecheck` both clean, with no existing suite regressed and the rename propagated. Every automated case above covered. PR body lists changed files, confirms no schema migration was needed, records commands and results, and notes the two deferred integration items: the backup call-to-action with freshness, and routing a successful early end to the wrap-up.
