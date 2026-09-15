> **Document status:** never built as specified. CSV export and deleted-activity recovery were not built; SQLite backup/restore later shipped under a different plan. Retained as historical context.

# Branch handoff: M12 backup, restore, and portability

**Branch:** `codex/m12-backup-restore`  
**Tasks:** M12.1–M12.5  
**Start gate:** G1  
**Runs with:** `codex/m13-correctness-reliability`  
**Authority:** [completion objective and delivery plan](../completion-objective-and-delivery-plan.md)  
**Coordinates:** [completion parallel delivery plan](../completion-parallel-delivery-plan.md)  
**Objective:** create one complete machine archive, readable CSV exports, staged replace-only restore, and append-only deleted-activity recovery.

## Dispatch fields

- Dependency commit: `<G1-commit>`
- Worktree: `<absolute-path>`
- Assignee: `<name-or-agent>`
- M11 snapshot/write APIs: `<module-and-contract>`
- Device access: `available | unavailable`

Read authority sections 4.1, 4.6, M12, 7, and the backup/restore rows of section 8.

## Owned files

- New `src/features/data-recovery/` domain, data, native-file, manifest, validation, promotion, export, hooks, and components.
- A new dedicated recovery route under `app/` that does not require editing `app/_layout.tsx` or the tab Settings file.
- New deleted-activity recovery repository/component modules that append restoration revisions without changing the normal session editor contract.
- Focused data-recovery, archive, CSV, restore, promotion, and component tests/fixtures.
- New data-format/recovery documentation and branch evidence, for example `docs/data-backup-format.md`, `docs/recovery-protocol.md`, and `docs/acceptance/m12-backup-restore.md`.

Do not edit:

- `app/_layout.tsx`, `app/(tabs)/settings/index.tsx`, or other shared app shells;
- `src/features/logging/data/sessionRepository.ts` while M13 owns temporal correction behavior—add a recovery-specific API/module or request a small integrator-owned adapter;
- M13's shared week evaluator;
- `src/db/schema.ts` or `src/db/migrations.ts` without explicit integration-owner reassignment; or
- top-level milestone/status docs.

## Frozen behavior

- One versioned machine archive contains a SQLite-consistent snapshot plus manifest; no second JSON restore format.
- Manifest includes format/schema/app versions, export time, payload size/checksum, and raw table counts.
- Archive includes all raw personal tables, stable IDs, revisions/tombstones/order, and preferences—not only effective rows.
- CSV is readable effective data plus a dictionary; it is never an import or complete audit substitute.
- Restore is replace-only: validate/stage/migrate/preview/confirm/protect/quiesce/promote/reopen/refresh.
- At interruption, next launch selects the prior complete database or validated replacement, never a mixture.
- Invalid/cancelled input never alters current data. Prior data remains protected until replacement reopens successfully.
- An expired formerly active cycle is accepted as raw backup data and settles through ordinary lifecycle behavior after restore.
- Reminder intent/time is restored, but foreign OS schedule identifiers are discarded and reconciled after permission review.

## Work checklist

- [ ] Freeze archive extension/container, manifest schema, bounded sizes, raw-table inventory, and fixture contract before UI work.
- [ ] Implement consistent archive creation using M11 snapshot primitives and checksum/count metadata.
- [ ] Generate all CSVs from the same snapshot; escape formulas and RFC-compatible quoting correctly.
- [ ] Implement Save to Files/share with truthful create/export/cancel/failure states.
- [ ] Validate candidates in staging: container, size, checksum, supported versions, schema structure, dates/numbers, identities, references, order, lifecycle invariants, integrity, and foreign keys.
- [ ] Add preview and explicit Replace confirmation; cancel writes nothing.
- [ ] Implement write quiescence and interruption-safe promotion with a journal/marker; preserve prior copy until reopen succeeds.
- [ ] Make restore available from recoverable startup through an exported component/callback contract; integrator performs shell wiring at G2.
- [ ] Implement deleted-session restoration by appending a restoration revision and preserving later unrelated work.
- [ ] Reconcile reminder intent without trusting imported schedule IDs.
- [ ] Write weekly external-backup, restore, damaged-original, and reinstall drill instructions.

## M13 intersection contract

M12 owns archive creation and CSV modules. M13 owns the shared week evaluator. Define an injected or narrow adapter interface for target-evaluation fields, then let the integration owner connect the final M13 evaluator at G2. Do not copy M13 calculations into the exporter.

M12 must refresh the provider/repositories after replacement, but the integrator owns final app-shell wiring. Expose a single success signal or database-generation change rather than reaching into unrelated hooks.

## Automated acceptance

Cover:

- full raw round trip and fixed-clock effective-summary equivalence;
- every supported old schema, current schema, elapsed-active-cycle behavior, and repeated restore;
- duplicate IDs, missing parents, invalid dates/numbers/order, active-cycle conflicts, unsupported versions, unexpected entries, checksum mismatch, truncation, and compressed/uncompressed size limits;
- cancellation at selection, preview, and confirmation;
- snapshot and unavailable-file failures;
- promotion interruption at every marker stage and launch recovery selection;
- reminder identifier reset/reconciliation; and
- deleted-activity restore with later unrelated records intact.

Run at minimum:

```bash
npx jest --runInBand __tests__/db __tests__/data
npx jest --runInBand __tests__/components/activityHistoryIntegration.test.tsx
npm run typecheck
```

Also run all new recovery suites explicitly. Mock-only file tests are insufficient for native promotion acceptance.

## Physical checks

Use disposable seeded data to create and reopen an external Files archive, cancel share/import, import in airplane mode, handle cloud-only unavailable content, restore reminders after permission check, interrupt replacement, and delete/reinstall only after verifying the external file. Never claim archive creation proves off-device protection.

## Stop and escalate

Stop for: a required archive-format change after freeze, schema migration not already assigned, silent repair/drop of incoming facts, merge semantics, arbitrary SQL/text import, custom encryption, or a destructive test against the owner's only history.

## Handoff requirements

Provide commits, chosen archive format/version/limits, raw inventory, exported APIs, changed files, tests/results, native drill results, known failure windows, and exact integration steps for Settings/startup/export evaluator wiring. Do not mark M12 accepted.
