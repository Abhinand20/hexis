> **Document status:** partially implemented later, in different form. Startup error, quarantine of an unreadable database, and a pre-migration snapshot exist as part of backup/restore, not as this M11 programme. Retained as historical context.

# Branch handoff: M11 recoverable startup and upgrades

**Branch:** `codex/m11-startup-recovery`  
**Tasks:** M11.1–M11.4 and repository portions of M11.6  
**Start gate:** G0  
**Authority:** [completion objective and delivery plan](../completion-objective-and-delivery-plan.md)  
**Coordinates:** [completion parallel delivery plan](../completion-parallel-delivery-plan.md)  
**Objective:** make startup, schema upgrades, snapshots, and overlapping writes fail safely without an endless loader or destructive reset default.

## Dispatch fields

- Dependency commit: `<G0-commit>`
- Worktree: `<absolute-path>`
- Assignee: `<name-or-agent>`
- Device access: `available | unavailable`

Read [the authority](../completion-objective-and-delivery-plan.md), especially sections 4.1, 4.6, M11, 7, and 8, before editing.

## Owned files

- `src/db/client.ts`, `src/db/DatabaseProvider.tsx`, `src/db/schema.ts`, and `src/db/migrations.ts` for M11 only.
- New narrowly scoped database write-coordination, snapshot, startup-state, and recovery modules under `src/db/`.
- `app/_layout.tsx` and a new recovery boundary/screen needed to expose startup states.
- `__tests__/db/*` and focused new startup/recovery component tests.
- A new branch-specific technical note such as `docs/acceptance/m11-startup-recovery.md`.

Do not edit Release signing configuration, M12 archive/export UI, feature repositories, top-level milestone/status docs, or the existing user-modified History/Settings files.

## Required contracts

- Provider state distinguishes `opening`, `ready`, `recoverable-error`, and `incompatible-data` rather than overloading loading/error booleans.
- A schema newer than the app-supported version is rejected before normal writes.
- Existing data gets a consistent protected copy before its first mutating migration. Fresh empty installs need no fictional pre-upgrade copy.
- Each migration advances `user_version` only in its successful transaction; released migration definitions remain unchanged.
- The prior complete database or last known-good copy remains accessible after failure.
- A small scoped write coordinator supports normal mutations and later restore quiescence without allowing unrelated async work to join one transaction.
- Successful UI state appears only after commit. Retry after an uncertain result cannot silently duplicate a write.

## Work checklist

- [ ] Record the G0 baseline and reproduce current startup/provider behavior.
- [ ] Add explicit startup/recovery state modeling and reachable retry/preserved-file actions.
- [ ] Add supported-version guard before the migration loop.
- [ ] Implement consistent snapshot creation, validation, retention primitives, and failure reporting reusable by M12.
- [ ] Preserve a pre-upgrade copy, clean up connections, and support reopen/retry after injected migration failure.
- [ ] Add scoped mutation coordination and test overlapping save/stop/end/restore-style locks.
- [ ] Document journal/synchronous settings actually used and any native-file behavior still requiring proof.

## Automated acceptance

Cover:

- fresh install and populated V1–V6 fixtures;
- idempotent reopen and per-migration injected failure/retry;
- future `user_version` refusal with no normal writes;
- invalid constraints/foreign keys and open failure UI;
- snapshot failure without loss of current history;
- deterministic retention without replacing a known-good copy with a bad one;
- connection cleanup and retry; and
- overlapping operations without duplicates or accidental transaction sharing.

Run at minimum:

```bash
npx jest --runInBand __tests__/db
npx jest --runInBand __tests__/components/app.test.tsx
npm run typecheck
```

Add the exact new test paths to the handoff. Native promotion/interruption claims must not rely solely on `expo-sqlite-mock`.

## Physical checks

When a disposable seeded device installation is available: upgrade, interrupt in a controlled test, reopen offline, exercise recovery actions, and simulate feasible storage failure. Never perform destructive experiments against the owner's only personal database.

If device access is unavailable, finish all repository work, provide the exact seed/build/interruption procedure, and report `implemented — device checks pending`.

## Stop and escalate

Stop for integration-owner direction if completing the task requires:

- a migration-number allocation that conflicts with current integrated work;
- a new dependency or native config/plugin change;
- changing backup/archive format decisions reserved for M12; or
- deleting, replacing, or silently repairing an existing database.

## Handoff requirements

Provide commit(s), changed files, startup-state API, snapshot/write-coordinator API, supported schema version, test commands/results, native assumptions, risks, and exact pending device checks. Do not mark M11 accepted.
