# Cloud handoff: M15 measurements

**Cloud branch:** `codex/cloud-m15-measurements`  
**Base:** `<pushed-G3-SHA>`  
**Runs with:** `codex/cloud-m14-cycles`  
**Authority:** [completion objective](../completion-objective-and-delivery-plan.md)  
**Cloud plan:** [cloud execution handoff](../cloud-execution-handoff-plan.md)  
**Cloud completion state:** feature implementation and automated evidence complete; native input/accessibility/restore checks pending.

## Objective

Implement M15 using the frozen G3 persistence contract: optional weight/calorie logging, append-only daily corrections, bounded history, unit-safe storage, sparse averages/trends, and cycle-independent behavior.

## Own

- New `src/features/measurements/` data/domain/hooks/components.
- New measurement routes outside shared root/tab shells.
- Measurement data/domain/component tests and cloud evidence.

Do not edit schema/migrations, archive inventory/validation, cycle files, `app/_layout.tsx`, shared Home/Settings tab files, or milestone/status docs. Expose callback-driven Home and Settings components for G4 integration.

## Deliver

- [ ] Typed create/read/correct/delete/restore/date-move/preference APIs for exactly weight and calories.
- [ ] One effective daily value per kind/date with ordered append-only audit history.
- [ ] Atomic date move with destination collision and failure behavior.
- [ ] Original weight decimal/unit plus fixed-precision canonical storage; display conversion never rewrites observations.
- [ ] Locale parsing, generous technical bounds, positive weight, nonnegative integer kcal, explicit zero versus missing.
- [ ] Monday–Sunday observed-day averages/coverage and adjacent seven-day comparisons requiring at least three observations in each window.
- [ ] Compact callback-driven Home entry, Today editor, bounded recent history/list, correction/delete/restore, and preference controls.
- [ ] Empty/active/completed/no-cycle and hidden/re-enabled behavior tests.
- [ ] Verification that G3 backup/CSV adapters include revisions, units, preferences, and disabled data.
- [ ] Exact local checklist for keyboards, units, midnight/travel, VoiceOver, Dynamic Type, offline relaunch, and Files restore.

## Verify

```bash
npx jest --runInBand __tests__/db __tests__/data __tests__/domain __tests__/components
npm run typecheck
```

Run every new measurement suite explicitly. End with the standard cloud result format and G4 shell-wiring instructions. Do not mark M15 accepted.

