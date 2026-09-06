# M11–M16 Codex cloud execution handoff plan

**Authority:** [completion-objective-and-delivery-plan.md](completion-objective-and-delivery-plan.md)  
**Derived from:** [completion-parallel-delivery-plan.md](completion-parallel-delivery-plan.md)  
**Purpose:** isolate work that can be implemented and automatically verified in Codex cloud from work that requires the local Mac or a physical iPhone.  
**Status:** dispatch plan only; cloud completion does not by itself accept a milestone.

Codex cloud creates an isolated container, checks out the selected remote branch or commit SHA, runs the configured setup script, and returns a diff for review. It cannot see this machine's uncommitted working tree. See the official [Codex cloud](https://learn.chatgpt.com/docs/cloud) and [cloud environment](https://learn.chatgpt.com/docs/environments/cloud-environment) documentation.

## Before any cloud handoff

The current local working tree contains uncommitted implementation and planning files. An integration owner must do all of the following first:

1. Review and commit the intended current changes without resetting or discarding them.
2. Push the authoritative completion plan, this cloud plan, and every referenced cloud handoff to the connected remote repository.
3. Record the exact remote base SHA for the first cloud task.
4. Configure a Codex cloud environment for this repository.
5. Pin the Node version to the locally verified project version; no version is currently declared in `.nvmrc` or `package.json`.
6. Use `npm ci` as the setup script because `package-lock.json` is present.
7. Leave agent internet access off unless a task demonstrates a specific need. No task below needs external accounts or secrets.
8. Treat each returned cloud diff as unmerged until reviewed, tested on the integration branch, committed, and pushed.

Cloud tasks must not create local worktrees, depend on an absolute workstation path, sign an app, access personal data, or report physical-device evidence.

## Cloud capability matrix

`Complete in cloud` means the implementation slice and automated evidence can be finished there. It does not mean the parent milestone is accepted when the authority requires native evidence.

| Original task | Cloud disposition | Required local remainder |
| --- | --- | --- |
| M11.1 startup states | Complete in cloud | Confirm recovery presentation on device |
| M11.2 snapshot/integrity service | Partial | Native SQLite snapshot, WAL/file behavior, storage-pressure and interruption checks |
| M11.3 migration compatibility/recovery | Complete code and fixture tests | Seeded native upgrade/interruption/reopen |
| M11.4 mutation coordination | Complete code and automated overlap tests | Representative native overlap/relaunch check |
| M11.5 early installation proof | Not cloud-capable | Xcode, free signing, iPhone install, offline cold launch |
| M11.6 repository evidence | Complete in cloud | Add native results later |
| M12.1 backup format | Complete in cloud | Reconfirm installed native API behavior locally |
| M12.2 archive/CSV/UI | Complete code and automated tests | Files/share sheet, external reopen, cancellation on iPhone |
| M12.3 staged replacement | Partial | Native handle closing, file promotion, interruption, unavailable Files content |
| M12.4 deleted-activity restore | Complete in cloud | Device discoverability/refresh check |
| M12.5 fixtures/runbook | Complete automated fixtures and draft runbook | Clean-install, external-file, reminder, deletion/reinstall drills |
| M13.1–M13.5 | Complete implementation and automated tests | Foreground/midnight/timezone/reminder/keyboard device checks |
| M14.1–M14.5 | Complete implementation and automated tests | Native date input, navigation, long calendar, VoiceOver and lifecycle device checks |
| M15.1–M15.5 | Complete implementation and automated tests | Native keyboards, units, midnight/travel, accessibility, offline and Files checks |
| M16.1 Release build | Not cloud-capable | Xcode Release build/install and final bundle proof |
| M16.2 renewal | Runbook draft only | Same-identity renewal, notifications, real profile-expiry evidence |
| M16.3 accessibility | Complete source fixes and component tests | VoiceOver, Dynamic Type, reduced-effects and touch checks |
| M16.4 years-scale | Complete deterministic fixture, query work, host metrics | Required Release measurements on the reference iPhone |
| M16.5 device/recovery pass | Not cloud-capable | Entire identified-build physical matrix |
| M16.6 documentation | Draft and consistency audit in cloud | Insert final native evidence and make acceptance decision |

## Cloud delivery waves

| Wave | Remote base requirement | Cloud tasks that may run together | Integration action before next wave |
| --- | --- | --- | --- |
| C1 | C0 committed/pushed baseline | `codex/cloud-m11-startup-core` | Review/merge; run G1 automated gate; push G1 SHA |
| C2 | G1 SHA | `codex/cloud-m12-recovery-core` + `codex/cloud-m13-correctness` | Review/merge; wire intersections; run G2; push G2 SHA |
| C3 | G2 SHA | `codex/cloud-m14-m15-contracts` | Review migration/archive contract; merge; push G3 SHA |
| C4 | G3 SHA | `codex/cloud-m14-cycles` + `codex/cloud-m15-measurements` | Review/merge; wire shared shells; run G4; push G4 SHA |
| C5 | G4 SHA | `codex/cloud-m16-accessibility-code` + `codex/cloud-m16-scale-harness` + `codex/cloud-m16-docs-audit` | Review/merge; run all automated gates; begin local/native acceptance |

The integration owner is outside these cloud tasks. A cloud worker must not merge another worker's branch, allocate an unassigned migration, or launch a dependent wave.

## Standalone cloud handoffs

Each linked document can be pasted into a separate cloud task after replacing its remote base SHA placeholder.

| Cloud branch | Handoff | Cloud-completable output |
| --- | --- | --- |
| `codex/cloud-m11-startup-core` | [M11 startup core](cloud-branch-delivery-plans/01-m11-startup-core.md) | Provider states, guards, coordination, snapshot abstraction and tests |
| `codex/cloud-m12-recovery-core` | [M12 recovery core](cloud-branch-delivery-plans/02-m12-recovery-core.md) | Archive/CSV/validation/restore state machine and mock-backed tests |
| `codex/cloud-m13-correctness` | [M13 correctness](cloud-branch-delivery-plans/03-m13-correctness.md) | Shared history evaluator, temporal guards, refresh/reliability tests |
| `codex/cloud-m14-m15-contracts` | [M14/M15 persistence contracts](cloud-branch-delivery-plans/04-m14-m15-contracts.md) | Ordered migrations and archive compatibility for both features |
| `codex/cloud-m14-cycles` | [M14 cycle implementation](cloud-branch-delivery-plans/05-m14-cycles.md) | Flexible-cycle data/domain/UI code and automated tests |
| `codex/cloud-m15-measurements` | [M15 measurement implementation](cloud-branch-delivery-plans/06-m15-measurements.md) | Measurement data/domain/UI code and automated tests |
| `codex/cloud-m16-accessibility-code` | [M16 accessibility code](cloud-branch-delivery-plans/07-m16-accessibility-code.md) | Source-level accessibility fixes and component assertions |
| `codex/cloud-m16-scale-harness` | [M16 scale harness](cloud-branch-delivery-plans/08-m16-scale-harness.md) | Ten-year fixture, correctness/query tests, justified optimizations |
| `codex/cloud-m16-docs-audit` | [M16 documentation audit](cloud-branch-delivery-plans/09-m16-docs-audit.md) | Final documentation drafts, consistency findings, evidence placeholders |

## Cloud dispatch prompt

Select the configured Hexis environment and the exact pushed base branch/SHA from the wave table, then use this prompt with the relevant handoff path substituted:

```text
Implement the cloud task in docs/cloud-branch-delivery-plans/<handoff>.md.
Treat docs/completion-objective-and-delivery-plan.md as the product authority and
docs/cloud-execution-handoff-plan.md as the execution authority. Inspect the
selected base before changing code, stay within the handoff's file ownership,
run its focused tests and npm run typecheck, and return a reviewable diff plus
the required result report. Do not attempt or claim any local Mac, Xcode,
personal-signing, Files, notification, VoiceOver, or physical-iPhone evidence.
```

Do not paste a local absolute path into a cloud task. The selected remote SHA and repository-relative documentation paths are the complete starting reference.

## Standard cloud task rules

Every cloud task must:

- start from the exact pushed SHA named in its handoff;
- read the authority document and its standalone cloud handoff before editing;
- inspect current code and preserve already-correct work;
- edit only declared files and avoid unrelated formatting/dependency churn;
- use the checked-in lockfile and existing dependencies by default;
- run focused Jest suites and `npm run typecheck`;
- make scoped commits or return a clean reviewable diff, depending on the cloud workflow;
- report exact commands/results, changed files, contracts, risks, and local follow-up;
- label all native/device requirements `local verification pending`; and
- never mark M11–M16 or “Hexis is finished” accepted.

## Standard cloud result format

```text
Base SHA:
Cloud branch/task:
Implemented:
Not implemented because local/native-only:
Changed files:
Schema/archive impact:
Commands and results:
Known risks:
Required integration steps:
Required local Mac/iPhone checks:
Suggested merge order:
```

## Local/native queue after cloud work

Cloud delivery is complete only when its diffs are reviewed and merged. Product acceptance still requires a local queue covering:

1. native SQLite snapshots, handle shutdown, file promotion, interruption, low-storage behavior, and Files/iCloud placeholders;
2. Xcode Release build, personal signing, offline cold launch, in-place renewal, and real profile expiry;
3. clean-install/external restore and disposable uninstall/reinstall;
4. actual notifications and permission reconciliation;
5. foreground, midnight, timezone, DST, keyboard, and ordinary-use scenarios;
6. VoiceOver, Dynamic Type, reduced effects, contrast, focus, and touch targets; and
7. ten-year fixture performance measurements on the identified reference iPhone.

Only the integration owner updates milestone acceptance after this queue and all automated gates pass against a specific final build.
