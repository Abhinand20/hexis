# Branch handoff: M15 optional daily weight and calories

**Branch:** `codex/m15-measurements`  
**Tasks:** M15.1–M15.5 except integration-owned schema/archive and shared-shell wiring  
**Start gate:** G3 shared M14/M15 persistence contract  
**Runs with:** `codex/m14-flexible-cycles`  
**Authority:** [completion objective and delivery plan](../completion-objective-and-delivery-plan.md)  
**Coordinates:** [completion parallel delivery plan](../completion-parallel-delivery-plan.md)  
**Objective:** implement fast optional daily body-weight and calorie logging, append-only corrections, bounded history, and truthful sparse calculations independent of cycle state.

## Dispatch fields

- Dependency commit: `<G3-commit>`
- Worktree: `<absolute-path>`
- Assignee: `<name-or-agent>`
- Measurement migration version/interface: `<version-and-module>`
- Device access: `available | unavailable`

Read authority section 4.5, M15, migration/backup policy, and measurement scenarios in section 8. Treat G3 storage/archive contracts as frozen.

## Owned files

- New `src/features/measurements/` data/domain/hooks/components.
- New measurement route files under `app/measurements/` that do not edit `app/_layout.tsx` or tab roots.
- Measurement repository/domain/component tests and fixtures.
- Branch-specific measurement behavior/precision evidence.

Do not edit:

- `src/db/schema.ts`, `src/db/migrations.ts`, G3 persistence types, archive inventory/manifest/validation/data dictionary, or backup promotion;
- `app/_layout.tsx`, `app/(tabs)/index.tsx`, or `app/(tabs)/settings/index.tsx`;
- cycle files; or
- top-level milestone/status docs.

Provide pure `MeasurementHomeEntry` and Settings preference controls with callback props for G4 wiring. Do not add a permanent fourth tab.

## Frozen measurement contract

- Closed set: `weight` and `calories`; no user-defined measurement framework.
- Measurements use global local dates and work before, between, and after cycles.
- One stable daily identity per `(kind, local_date)` with ordered append-only value/correction/delete/restore revisions.
- Entering another value for an existing day visibly edits it; calories never sum and weight never silently averages.
- Date correction is one atomic move preserving source audit history; an effective destination collision is rejected without overwrite/merge.
- Weight preserves entered decimal/unit and a fixed-precision canonical value; display-unit changes never rewrite observations.
- Calories are integer kcal; zero is a valid observation and differs from missing.
- Week averages use observed days only and show coverage. Seven-day comparison requires at least three observations in each adjacent window.
- Visibility and unit preferences hide UI only; records remain backed up, exported, and visible after re-enable.

## Work checklist

- [ ] Verify G3 schema constraints, ordering, precision, and round-trip fixtures match repository needs.
- [ ] Implement typed repository APIs for create/effective read/correct/delete/restore/date move and preferences.
- [ ] Implement locale-aware parsing and validation: positive finite weight, nonnegative integer calories, generous technical bounds.
- [ ] Implement independent Monday–Sunday averages, coverage, recent raw values/gaps, trailing seven-day mean, prior-window comparison, and neutral insufficient-data states.
- [ ] Build a compact Home entry component usable in empty/active/completed states.
- [ ] Build Today editor with visible replace semantics, pending/error state, preserved input, and relaunch persistence.
- [ ] Build bounded recent history (about 28 days), readable list, accessible navigation, edit/delete/restore, and collision-safe date correction.
- [ ] Build Settings controls for per-kind enablement and weight display unit as callback-driven components.
- [ ] Verify the G3 archive/CSV adapters expose all revisions/preferences and effective values; report defects to the integrator rather than editing them.
- [ ] Supply exact root/Home/Settings wiring instructions for G4.

## Automated acceptance

Cover:

- kg/lb precision, canonical tolerance, locale decimal input, display conversion invariance;
- positive weight, nonnegative integer calories, explicit zero, missing, invalid/nonfinite/overflow inputs;
- one effective value per kind/date, visible repeated-entry replacement, duplicate taps;
- date-move success, collision, and injected transaction failure;
- correction/delete/restore ordering and hidden-data retention;
- observed-day weekly averages and coverage, including 70/71/72 → 71 kg over 3 of 7 and 0/2000 → 1000 kcal over 2 of 7;
- three-observation threshold in both comparison windows, no zero-fill/interpolation;
- Home entry in empty/active/completed states and disabled-state absence; and
- unchanged G3 migration and full archive round trips.

Run all new suites plus:

```bash
npx jest --runInBand __tests__/db __tests__/data __tests__/domain __tests__/components
npm run typecheck
```

## Physical checks

Exercise decimal keyboards, kg/lb switching, edit after midnight/travel, VoiceOver units/values, large text/small-screen keyboard layout, offline relaunch, no-cycle logging, hide/re-enable, and Files backup/restore with preferences.

## Stop and escalate

Stop for: a third measurement kind, targets/recommendations, meals/macros, multi-sample analysis, shared schema/archive changes, a new dependency, or shared Home/Settings/root edits. Send the integrator the smallest contract defect and continue independent work.

## Handoff requirements

Provide commits, changed files, repository/component APIs, precision/rounding rules, tests/results, G3 compatibility result, exact G4 wiring, and pending device checks. Do not mark M15 accepted.
