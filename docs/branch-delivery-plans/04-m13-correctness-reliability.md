# Branch handoff: M13 truthful history and reliable actions

**Branch:** `codex/m13-correctness-reliability`  
**Tasks:** M13.1–M13.5, excluding M12-owned export implementation  
**Start gate:** G1  
**Runs with:** `codex/m12-backup-restore`  
**Authority:** [completion objective and delivery plan](../completion-objective-and-delivery-plan.md)  
**Coordinates:** [completion parallel delivery plan](../completion-parallel-delivery-plan.md)  
**Objective:** make every current consumer tell the same historical story and make everyday actions refresh and fail safely without altering unrelated facts.

## Dispatch fields

- Dependency commit: `<G1-commit>`
- Worktree: `<absolute-path>`
- Assignee: `<name-or-agent>`
- Current known user changes included in base: `<commit-or-list>`
- Device access: `available | unavailable`

Read authority sections 4.1–4.3, M13, 7, and the matching section 8 scenarios.

## Owned files

- Shared cycle-domain evaluation modules under `src/features/cycles/domain/`, including one practice-week evaluator and adapters for Home, History, cycle/archive summaries, and streaks.
- Goal/session repository guard and correction behavior in `src/features/goals/data/goalRepository.ts` and `src/features/logging/data/sessionRepository.ts`.
- Logging/goal mutation hooks and editor components.
- Cycle refresh hooks: `useActiveCycle.ts`, `useCycleLanding.ts`, and `useCycleHistory.ts`.
- Home, History, and Settings tab screens during Wave 2 only.
- Reminder reconciliation in `src/features/reminders/reminderService.ts`.
- Focused domain/repository/component/reminder tests and a branch evidence note.

Do not edit M12 data-recovery/archive/export modules, root layout/recovery boundary, schema/migrations without explicit reassignment, Release config, or top-level status docs. Do not overwrite the known History/Settings/test changes already present in the G0/G1 base.

## Shared evaluation contract

Implement one Monday–Sunday evaluator used by all in-app consumers and exposed to the M12 exporter through a narrow pure API:

- raw effort always includes effective in-bounds sessions;
- only a full in-cycle week with full membership and stable cadence/target/duration is target-eligible;
- shortened or midweek-changed practice-weeks receive neutral reason labels and are excluded from met/missed, remaining-target, and normalized ratios;
- name-only changes do not invalidate a week;
- aggregate names resolve at the bounded-end/as-of date;
- unfinished eligible weeks show progress, not a miss;
- zero eligible targets yield unavailable/neutral, not zero-percent failure; and
- cadence changes start a new streak segment; excluded units neither award nor penalize it.

The required fixture changes 3 × 60 to 2 × 45 on Wednesday with two sessions. Home, Week, Cycle, archive adapter, and exported evaluator output must agree on raw effort and changed-target status.

## Temporal/mutation contract

- Goal configuration/membership mutations revalidate active cycle, membership, local today, and bounds at repository mutation time.
- Forms crossing midnight cannot save stale assumptions.
- Non-time activity edits preserve stored reporting date and the exact original UTC instant/precision.
- Explicit time edits reject nonexistent spring-forward times and disambiguate repeated fall-back times consistently.
- Legacy timezone context remains unknown rather than reconstructed from the current phone.
- Success follows commit; pending guards prevent duplicate taps; input remains on failure.

## Work checklist

- [ ] Reproduce existing cross-consumer differences with deterministic fixtures.
- [ ] Implement the shared practice-week evaluator and replace in-app divergent calculations.
- [ ] Expose a pure export adapter contract without editing M12 files.
- [ ] Enforce mutation-time active/today/membership checks in repositories.
- [ ] Preserve instant/date/seconds on unrelated corrections; cover DST and travel.
- [ ] Refresh current cycle/day/membership on focus, foreground, and visible-day rollover while preserving intentional History selection.
- [ ] Add caught errors, pending guards, retry state, and input preservation across log/edit/goal/cycle/settings actions in scope.
- [ ] Reconcile reminder permission, intent, and OS schedule after partial failure; prevent orphan schedules during rapid changes.
- [ ] Correct duration-only, Week-tab, and forward-only claims in branch-owned technical docs or provide exact changes for the integrator-owned overview/checklist.

## M12 intersection contract

Do not implement or edit CSV/archive code. Commit the pure evaluator and its tests separately where practical, so the integrator can connect it to M12 before the rest of M13 if merge order requires. Do not edit the M12 recovery Settings entry; the integrator adds it after this branch merges.

If new persisted timezone metadata proves essential, stop and provide the minimal schema/legacy/archive contract to the integrator. Continue all schema-independent M13 work.

## Automated acceptance

Cover:

- required midweek target/duration/cadence scenario in every in-app consumer plus export adapter output;
- stable full weeks, boundary-short weeks, membership changes, same-day and name-only revisions, zero eligible targets, unfinished weeks, and cadence streak transitions;
- leap day, DST gap/fold, travel, correction precision, and forms spanning midnight;
- mounted-tab, foreground, selected-archive, and cycle start/end/repeat refresh;
- write/schedule/preference failures, denied/revoked notification permission, rapid time changes, and repeated taps; and
- fixed-clock stability for all wall-clock-sensitive fixtures.

Run at minimum:

```bash
npx jest --runInBand __tests__/domain __tests__/data __tests__/reminders
npx jest --runInBand __tests__/components
npm run typecheck
```

## Physical checks

Exercise background/foreground, midnight, disposable timezone changes, non-time activity edit precision, Settings mounted across start/end/repeat, denied/revoked reminders, actual notification firing, keyboard/error recovery, and the target-change fixture.

## Stop and escalate

Stop for: schema/archive changes, a new score or goal semantic, standalone minute-only targets, backdated goal editing, shared recovery/root-shell edits, or any fix that rewrites immutable source activity facts.

## Handoff requirements

Provide commits, evaluator API and reference outputs, changed files, repository invariants, test commands/results, known user-change reconciliation, integration instructions for M12 exports/recovery Settings, and pending device checks. Do not mark M13 accepted.
