# Cloud handoff: M14 flexible cycles

**Cloud branch:** `codex/cloud-m14-cycles`  
**Base:** `<pushed-G3-SHA>`  
**Runs with:** `codex/cloud-m15-measurements`  
**Authority:** [completion objective](../completion-objective-and-delivery-plan.md)  
**Cloud plan:** [cloud execution handoff](../cloud-execution-handoff-plan.md)  
**Cloud completion state:** feature implementation and automated evidence complete; native UI/lifecycle checks pending.

## Objective

Implement M14 using the frozen G3 persistence contract: arbitrary positive cycle lengths/end dates, dated plan/name revisions, explicit actual closure, safe shortening, and consistent planned/actual consumers.

## Own

- Cycle repository/domain/types/hooks/components.
- Setup state/routes and new focused cycle-edit files.
- History/calendar/archive/repeat consumers outside shared Home/Settings/root shells.
- Cycle data/domain/setup/component tests and cloud evidence.

Do not edit schema/migrations, archive inventory/validation, measurement files, `app/_layout.tsx`, shared Home/Settings tab files, or milestone/status docs. Return exact callbacks/routes for the integration owner to wire.

## Deliver

- [ ] Repository resolution/write behavior for immutable initial plan, dated ordered revisions, and actual closure.
- [ ] 30/60/90 shortcuts plus one-day, arbitrary length, and explicit inclusive end-date creation.
- [ ] Focused active name/end edit with save-time validation and data-stranding rejection.
- [ ] Distinct plan-end-today and End-today behavior, expired-cycle settlement, duplicate-submit guards, and same-day replacement.
- [ ] Planned/actual adaptations for Home-facing models, History bounds, week/calendar/archive/correction/repeat behavior.
- [ ] Bounded long-cycle pages/months.
- [ ] Cancel/back/repeat paths that write nothing and preserve intended state.
- [ ] Automated legacy, leap/date-boundary, >90-day, shortening, same-day, archive, correction, and backup-compatibility tests.
- [ ] Exact local checklist for native date controls, gestures, calendar usability, confirmations, same-day lifecycle, and VoiceOver labels.

## Verify

```bash
npx jest --runInBand __tests__/data/cycleRepository.test.ts
npx jest --runInBand __tests__/domain
npx jest --runInBand __tests__/components/cycleSetupNavigation.test.tsx __tests__/components/cycleHistory.test.tsx __tests__/components/cycleArchive.test.tsx
npm run typecheck
```

End with the standard cloud result format and G4 shell-wiring instructions. Do not mark M14 accepted.

