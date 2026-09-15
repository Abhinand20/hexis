> **Document status:** never built as specified. Custom cycle lengths and explicit actual-closure were not implemented; dated add/stop membership had already shipped as M8. Retained as historical context.

# Branch handoff: M14 flexible cycles with preserved plans

**Branch:** `codex/m14-flexible-cycles`  
**Tasks:** M14.1–M14.5 except integration-owned schema/archive and shared-shell wiring  
**Start gate:** G3 shared M14/M15 persistence contract  
**Runs with:** `codex/m15-measurements`  
**Authority:** [completion objective and delivery plan](../completion-objective-and-delivery-plan.md)  
**Coordinates:** [completion parallel delivery plan](../completion-parallel-delivery-plan.md)  
**Objective:** implement custom cycle creation, dated active plan edits, explicit actual closure, and consistent planned/actual consumers while preserving legacy facts.

## Dispatch fields

- Dependency commit: `<G3-commit>`
- Worktree: `<absolute-path>`
- Assignee: `<name-or-agent>`
- Cycle migration version/interface: `<version-and-module>`
- Device access: `available | unavailable`

Read authority section 4.4, M14, migration/backup policy, and cycle scenarios in section 8. Treat the G3 schema/types as frozen.

## Owned files

- `src/features/cycles/data/cycleRepository.ts` and cycle-specific domain/types/hooks/components.
- Setup state and routes under `app/setup/` and `src/features/cycles/hooks/useCycleSetupState.tsx`.
- New focused cycle-edit route/component files that do not edit `app/_layout.tsx`.
- History/calendar/archive/repeat cycle consumers that do not overlap shared Home/Settings shell files.
- Cycle repository/domain/setup/component tests and branch evidence.

Do not edit:

- `src/db/schema.ts`, `src/db/migrations.ts`, G3 persistence types, archive manifest/inventory/validation/data dictionary, or backup promotion;
- `app/_layout.tsx`, `app/(tabs)/index.tsx`, or `app/(tabs)/settings/index.tsx`;
- measurement files; or
- top-level milestone/status docs.

Expose callback-driven cycle header/settings controls and route-registration requirements for the G4 integrator rather than editing shared shells.

## Frozen lifecycle contract

- Creation supports 30/60/90 shortcuts, any valid positive whole-day length, or an explicit inclusive end date. New cycles start today.
- Initial name/start/planned end remain preserved. Active name/planned-end changes append full dated, monotonically ordered plan snapshots effective today.
- Start date is immutable. Planned duration is derived from dates; no ambiguous independent duration truth remains.
- Shortening must end today or later and cannot strand any activity, membership, or configuration event. It fails with a specific explanation and deletes nothing.
- Scheduling the planned end for today keeps the cycle active through today. `End today` closes it immediately and records today's inclusive actual end.
- Expired cycles settle before edit; reopen is excluded.
- Same-day end and new cycle is valid; source cycle identities prevent copying/double count while one-active-cycle enforcement remains.
- After closure, historical activity correction stays within valid actual bounds.
- Repeat pre-fills final active practice configuration and final planned length with a visible preview; cancel writes nothing.

## Work checklist

- [ ] Verify G3 legacy migration fixtures represent active, completed, and early-ended cycles correctly.
- [ ] Implement repository reads/writes for resolved plan snapshots and actual closure.
- [ ] Implement custom length/end-date setup with one source of truth, inclusive preview, validation, and back/cancel state preservation.
- [ ] Implement focused active name/end edit flow with save-time revalidation and explanatory shortening failures.
- [ ] Keep plan-today and close-today actions distinct; guard duplicate submits and active-cycle conflicts.
- [ ] Adapt Home-facing cycle models, History bounds, week bounds, calendar, archive summary, correction bounds, and repeat draft to explicit planned/actual dates.
- [ ] Render long cycles in bounded pages/months, not one unbounded grid.
- [ ] Preserve prior plan/configuration/activity context in all summaries and audit reads.
- [ ] Supply the integrator with exact Home/Settings callbacks, labels, and route registration needed at G4.

## Automated acceptance

Cover:

- 1-day, 17-day, preset, >90-day, month/year/leap-boundary creation;
- invalid/reversed/unsupported dates and conflicting length/end inputs;
- extend and shorten, including data-stranding rejection and expired-cycle rejection;
- plan end today versus explicit End today;
- same-day closure/new start, one-active-cycle enforcement, and repeated taps;
- legacy active/completed/early-ended resolved values;
- final planned length and final practices in repeat; all cancel paths write nothing;
- planned versus actual bounds across Home model, History, calendar, archive, correction, and summaries; and
- G3 old/new backup round-trip fixtures still pass unchanged.

Run at minimum:

```bash
npx jest --runInBand __tests__/data/cycleRepository.test.ts
npx jest --runInBand __tests__/domain
npx jest --runInBand __tests__/components/cycleSetupNavigation.test.tsx __tests__/components/cycleHistory.test.tsx __tests__/components/cycleArchive.test.tsx
npm run typecheck
```

## Physical checks

Exercise native custom date input, back/swipe/cancel, interrupted edit, long-cycle calendar, end confirmation, same-day replacement, archived correction, and VoiceOver schedule labels. If unavailable, provide exact fixture and steps.

## Stop and escalate

Stop for: changes to the G3 schema/archive contract, a need to rewrite a released migration, deletion/truncation to satisfy shortening, pause/reopen/future scheduling, or shared Home/Settings/root changes. Send the integrator the smallest contract adjustment.

## Handoff requirements

Provide commits, changed files, repository API, planned/actual resolution examples, tests/results, G3 compatibility result, exact G4 shell wiring, and pending device checks. Do not mark M14 accepted.
