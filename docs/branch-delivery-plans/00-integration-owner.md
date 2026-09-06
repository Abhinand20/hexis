# Branch handoff: completion integration owner

**Branch:** `codex/completion-integration`  
**Authority:** [completion objective and delivery plan](../completion-objective-and-delivery-plan.md)  
**Coordinates:** [completion parallel delivery plan](../completion-parallel-delivery-plan.md)  
**Objective:** maintain the only authoritative integration line for M11–M16, freeze shared contracts, merge worker branches safely, and close gates only from verified evidence.

## Dispatch fields

- Integration base commit: `<commit>`
- Worktree: `<absolute-path>`
- Owner: `<name-or-agent>`
- Started: `<date>`
- Current gate: `G0 | G1 | G2 | G3 | G4 | G5`

## Exclusive ownership

- Merge order and dependency commits for every worker.
- Shared schema/type contracts and migration numbering whenever no worker has explicit temporary ownership.
- M14/M15 G3 persistence-contract commit.
- Root navigation, shared Home/Settings wiring, and cross-branch adapters after worker merges.
- `docs/project-overview.md`, `docs/milestones.md`, `docs/release-checklist.md`, consolidated progress and final acceptance records.
- Full-suite, cross-feature, archive/migration, and final device gate results.

Do not implement large feature slices that belong to a running worker. Make only the smallest integration adapter or conflict resolution after reading both sides.

## Delivery checklist

### G0

- [ ] Inspect `git status`; identify and preserve all existing user-owned changes.
- [ ] Record commit, Node/npm, Expo, Xcode/iOS availability, and current schema version.
- [ ] Run and record `npx jest --runInBand` and `npm run typecheck`.
- [ ] Create worker branches/worktrees from the recorded commit and fill their dispatch fields.

### G1

- [ ] Review M11 startup/recovery code, failure paths, native-file assumptions, and tests.
- [ ] Merge M11 without silently resetting data on error.
- [ ] Review Release-proof evidence/config separately; record physical proof as passed or pending.
- [ ] Run DB/provider/component intersection tests plus full typecheck.

### G2

- [ ] Freeze archive format v1 and raw-table inventory from M12.
- [ ] Freeze M13 shared practice-week and temporal mutation contracts.
- [ ] Merge M12 and M13; resolve only their declared intersections.
- [ ] Wire data-recovery entry points into Settings and recoverable startup.
- [ ] Wire readable exports to the shared M13 evaluator.
- [ ] Verify restore pauses writes, promotes safely, reopens the database, refreshes screens, and reconciles reminders.
- [ ] Run full migration/archive/correctness tests and typecheck.

### G3 — serial persistence contract

- [ ] Allocate consecutive migration versions from the actual integrated schema.
- [ ] Add cycle initial-plan/revision/actual-closure structures and legacy migration.
- [ ] Add measurement identity/revision/preferences structures for exactly weight and calories.
- [ ] Update raw backup inventory, candidate validation, data dictionary, fixtures, and round-trip checks for both.
- [ ] Freeze repository interfaces plus component callbacks for shared Home/Settings/root wiring.
- [ ] Commit this gate and use its exact hash as the base of both M14 and M15.

### G4

- [ ] Review and merge M14/M15 without accepting changes to integration-owned schema/archive files.
- [ ] Register cycle-edit and measurement routes.
- [ ] Wire cycle plan actions and optional measurement controls into Home/Settings.
- [ ] Update export adapters using implemented repository semantics.
- [ ] Test empty, active, ended, same-day replacement, measurements-enabled/disabled, backup, and restore intersections.
- [ ] Run full Jest, typecheck, installed Expo checks, and production bundle checks.

### G5

- [ ] Merge M16 performance work first if it changes queries/indexes; rerun data tests.
- [ ] Merge accessibility fixes and rerun component/type checks.
- [ ] Merge runbooks/evidence, then rebuild the final Release artifact.
- [ ] Execute or coordinate the consolidated device/recovery matrix on the same identified build.
- [ ] Reconcile all required docs and statuses; leave unperformed physical checks pending.
- [ ] Mark M11–M16 accepted only if every authority-document section 10 item has evidence.

## Verification at each merge

At minimum:

```bash
npm run typecheck
npx jest --runInBand
```

Also run focused intersection suites before the full suite. Do not add or upgrade packages merely to make an environment diagnostic green.

## Conflict policy

- Preserve both valid changes; never take an entire side of a shared file without reading it.
- Reject worker edits outside declared ownership unless the handoff explains why they are necessary.
- If a worker discovers a new schema need, pause that slice, land the contract here, then rebase/restart it from the new gate.
- Keep released migrations append-only and preserve all stable identifiers/revision ordering.
- Do not infer native behavior from mocks or command exit status.

## Final handoff

Report:

1. integration commit and merged worker commits;
2. gate-by-gate status;
3. exact automated and physical results with environment/build identity;
4. schema/archive format versions and compatibility coverage;
5. unresolved defects versus device-only pending checks;
6. links to runbooks, data format, recovery protocol, and acceptance evidence; and
7. whether section 10 is fully accepted or why it remains open.

