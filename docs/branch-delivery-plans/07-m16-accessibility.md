# Branch handoff: M16 essential accessibility and usability

**Branch:** `codex/m16-accessibility`  
**Task:** M16.3 and its focused portion of M16.5  
**Start gate:** G4  
**Runs with:** `codex/m16-years-scale` and `codex/m16-device-handoff`  
**Authority:** [completion objective and delivery plan](../completion-objective-and-delivery-plan.md)  
**Coordinates:** [completion parallel delivery plan](../completion-parallel-delivery-plan.md)  
**Objective:** make every required existing and new flow operable with VoiceOver, large text, keyboard constraints, reduced effects, and accessible touch controls.

## Dispatch fields

- Dependency commit: `<G4-commit>`
- Worktree: `<absolute-path>`
- Assignee: `<name-or-agent>`
- Reference devices/content sizes: `<details>`

Read M16.3, the accessibility row in section 8, and all physical-evidence rules in the authority document.

## Owned files

- UI components/screens under `app/`, `src/design/`, and feature `components/`/hooks when the change is strictly accessibility/usability behavior.
- Component/accessibility tests.
- `docs/acceptance/m16-accessibility.md` with build/device/scenario evidence.

Do not edit data repositories, domain calculations, schema/migrations, archive/recovery logic, build/signing config, performance fixtures, or top-level status docs. If an accessibility fix needs a data API change, request the smallest adapter from the integrator.

## Required coverage

- Home habit logging and measurement entry in empty/active/completed cycle states.
- History day/week/cycle navigation, activity correction/delete/restore, and measurement history.
- Setup, add/edit/stop practice, cycle plan edit/end/repeat, Settings, reminders, backup/export/restore, startup recovery, and confirmations/errors.
- Long-cycle calendar or its accessible list/pager alternative.

## Work checklist

- [ ] Capture a source/device baseline for every required flow; record concrete failures before changing code.
- [ ] Add correct roles, labels, values, hints, selected/disabled/busy state, and logical focus order.
- [ ] Move focus appropriately after modal open/close, validation failure, destructive confirmation, save, and restore.
- [ ] Support large Dynamic Type without clipped required text/actions or unreachable keyboard controls.
- [ ] Ensure usable touch targets; rework 22-point calendar cells without overlapping ambiguous hit regions.
- [ ] Add non-color state cues and adequate contrast over glass surfaces.
- [ ] Respect reduced motion/transparency and avoid essential meaning encoded only by animation.
- [ ] Make back/dismiss/cancel discoverable and keep destructive consequences explicit.
- [ ] Add focused assertions without replacing physical VoiceOver verification with snapshots.

## Automated checks

Run focused component suites for changed flows, then:

```bash
npx jest --runInBand __tests__/components
npm run typecheck
```

Do not broadly rewrite components only to raise coverage.

## Physical checks

On the documented reference iPhone and smallest supported layout available:

- complete core flows using VoiceOver;
- test the largest supported Dynamic Type sizes;
- test reduced motion/transparency, light/dark contrast if supported, and keyboard reachability;
- verify calendar/date selection, unit/value announcements, error recovery, modal focus restoration, and destructive confirmations.

Record commit/build, device, iOS, setting, fixture, steps, expected result, actual result, and date. Screenshots alone are not acceptance.

## Stop and escalate

Stop for product-semantic changes, broad redesign, new navigation, new dependency, or changes owned by performance/device branches. Report any blocker that cannot be fixed at the presentation layer.

## Handoff requirements

Provide commits, changed flows/files, before/after failure list, automated results, device matrix, remaining blockers, and exact retest steps. Report `implemented — device checks pending` for any untested physical mode; do not mark M16 accepted.
