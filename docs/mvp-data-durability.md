> **Document status:** implemented on `main`. Retained as historical context, not as a current description of the app. The clean-install device drill in this specification has not been claimed.

# MVP feature: durable backup and restore

Authority: [final MVP plan](mvp-final-implementation-plan.md). Originally a specification.

Decisions taken on 2026-09-08 by the owner: the backup artifact is a SQLite snapshot, not a JSON archive; backup status is a plain creation timestamp rather than a verified-state machine, with explicit instruction to save into iCloud Drive; failure handling covers the MVP subset below, not a generalized durable-marker protocol; the clean-install drill runs on a single iPhone by deleting and reinstalling the app.

## Verified API behaviour

Probed against installed `expo-sqlite@57.0.1` under the `expo-sqlite-mock` test harness on 2026-09-08. Re-verify on device before relying on any of it.

- `VACUUM INTO '<path>'` succeeds from the live WAL connection and writes a single self-contained file with no `-wal` or `-shm` sidecars. It preserves `user_version`, `sqlite_sequence`, partial indexes and row contents, and reports `integrity_check = ok`. The destination must not already exist, and the statement cannot run inside a transaction.
- `backupDatabaseAsync` is **not implemented** by `expo-sqlite-mock` and therefore cannot be unit-tested. Do not build the primary path on it.
- `ATTACH DATABASE '<path>' AS src` works, including from a snapshot file, and is the only supported way to inspect a snapshot at an arbitrary path. `openDatabaseAsync` resolves its argument as a database *name* within a database directory, not as a filesystem path: passing an absolute path silently creates a new empty database. Never validate a snapshot by opening it as a name.
- A delete-then-insert replacement across attached tables inside `withTransactionAsync` commits correctly and rolls back completely on an injected pre-commit failure.
- `INSERT INTO main.t SELECT * FROM src.t` leaves `main.sqlite_sequence` at the highest *inserted* rowid, which can be lower than the snapshot's recorded sequence when rows were deleted. Hexis never deletes revision rows, so the two are equal in practice, but the replacement must still copy `sqlite_sequence` explicitly and prove it with a test.
- `expo-file-system@57` provides `File.pickFileAsync()`; `expo-document-picker` is unnecessary. `expo-sharing` is the only new native module and requires one local rebuild.

## Backup artifact

A backup is one SQLite database file named `hexis-backup-YYYY-MM-DD.db`. It is the whole database at its current schema version. There is no bespoke serialization format, no checksum contract and no version converters: fidelity comes from SQLite, and an older snapshot is brought forward by the existing migration chain rather than by hand-written adapters.

Write a `backup_metadata` table into the snapshot only, through the attached connection, holding UTC creation time, app version and schema version. `user_version` already carries the schema version; the metadata table exists because creation time and app version are not otherwise recoverable once a file is renamed. Restore must tolerate its absence and must not copy it into live data.

The file is readable personal data in cleartext. It is not encrypted or authenticated. Say so in the UI and the runbook, and tell the owner to keep it somewhere private.

Pick a file with `mimeTypes: ['*/*']` so iOS offers arbitrary documents; this avoids declaring a document type in `app.json`. Confirm on device that the picker lists the saved file, and that "Save to Files" accepts the `.db` extension.

## User flow

Settings gains a "Data & backup" section, reachable with or without an active cycle.

**Create backup** takes the snapshot, writes metadata, records the creation timestamp and opens the native share sheet. Before the sheet appears, instruct the owner in plain words to save the file to **iCloud Drive**, not "On My iPhone", because a copy that stays on the phone does not survive losing it. Repeat that instruction in the success state.

Status shows "Last backup created <date>" plus honest copy that Hexis cannot confirm the file reached iCloud or that iCloud finished uploading it — completing the share sheet is not proof of anything. Show "You have changes since then" when any personal row carries a `created_at` later than the recorded backup time; a boolean is enough, do not compute a count. Cancellation or failure must not record a timestamp.

Store the backup timestamp in a small JSON file in `Paths.document`, deliberately outside the database. A snapshot then cannot carry the source phone's freshness claim into a restored installation, and a clean install starts with no claim at all. No reset logic is needed.

Offer **Check a backup file** to pick any file and validate it, reporting what it contains. This gives the owner real confidence in a saved copy without Hexis persisting a "verified" status it cannot honestly maintain.

Show a quiet prompt in Settings when the last backup is missing or older than seven days, and offer the backup action from the wrap-up page. No push notification permission is required. Keep the last two local snapshots for recovery and prune older ones; never overwrite the owner's only known-good external file.

**Restore backup** is reachable from Settings, from an empty installation, and from the database startup error state without passing through Home.

## Restore protocol

1. Acquire the exclusive backup/restore mutex and set a visible busy state that blocks logging and editing. A module-level async mutex plus a busy flag on `DatabaseProvider` is sufficient; do not route every existing repository write through a new coordinator. Snapshot consistency is guaranteed by SQLite, so no read-transaction coordination is needed.
2. Pick the file and copy it into bounded local staging, which also forces an iCloud download. Reject anything over 50 MiB before opening it.
3. `ATTACH` the staged copy. Confirm it is a SQLite database with the expected tables. Read its schema version: reject a version newer than this build supports; run the existing migration chain forward on the staged copy when it is older. Migrate the staged copy, never the file the owner picked.
4. Validate before touching live data: `integrity_check`, `foreign_key_check`, and the repository invariants — at most one active cycle, resolvable goal and session references, revision sequence ordering, membership constraints, parseable dates and finite numbers. Count rows for the preview.
5. Show a concrete preview: snapshot creation date, source app and schema version, cycle and session counts, and whether it contains an active cycle. State plainly that **this replaces all data on this phone and does not merge**. Require explicit confirmation on that preview. Cancel leaves everything unchanged.
6. On confirm, take an automatic local pre-restore snapshot of the current database into `Paths.document`. Label it clearly as local-only insurance, not phone-loss protection. A non-empty installation is also offered an external backup first, but completing one is not forced.
7. Replace in one transaction on the live connection: delete dependent rows before parents, insert parents before dependents, copy `sqlite_sequence` explicitly, and preserve revision order. Re-run integrity and invariant checks before commit. Any failure rolls back the whole replacement. Never use the `__DEV__` reset helper.
8. Commit before reporting success. Then bump a `dataVersion` counter on `DatabaseProvider` and remount the consuming subtree by key so every screen re-reads. This is the mechanism the plan previously assumed existed; there is no query cache to invalidate, and `useActiveCycle` never refetches on focus, so per-screen refresh is not sufficient. Release the mutex on every path.
9. Discard the restored `notification_identifier`, then reconcile reminder scheduling against current permissions. Report a scheduling failure separately from a successful data restore, and do not request permission outside the normal user flow.

If the process dies before commit, relaunch shows the original dataset; after commit, the complete restored dataset. Verify this on device for the chosen APIs.

## Failure handling in scope

- The database startup error state shows Retry and Restore, never an indefinite spinner and never automatic deletion.
- A schema version newer than the build supports is rejected before any migration write.
- Take an automatic snapshot before running migrations. `VACUUM INTO` makes this nearly free. Keep the prior copy when a migration fails and surface recovery. This protects upgrades; it is not an external backup.
- If the live database cannot be opened at all, rename it and its sidecars aside as `hexis-unreadable-<timestamp>.db`, create a fresh database, and run the normal restore into it. Never repair corruption by erasing it.

Explicitly out of scope: a generalized crash-safe durable selection marker, interrupted-file-swap recovery, and a migration framework. The replacement is a single SQLite transaction, so there is no file swap to interrupt.

## Tests

Run with `npx jest --runInBand`. Exercise real SQLite through `expo-sqlite-mock` rather than mocking repositories, and inspect snapshots by `ATTACH` only.

Round-trip exact raw rows and derived wrap-up metrics for: empty, active, completed and early-ended cycles; membership and configuration changes; session edits, moves and tombstones; null durations; reminder preferences. Assert `sqlite_sequence` continuity by appending a new correction after restore.

Rejection and safety cases: unsupported newer schema version; an older snapshot migrated forward; a non-SQLite and a truncated file; duplicate IDs; broken references; two active cycles; out-of-range dates; oversized input; a cancelled pick, share or preview.

Failure injection before the transaction, during delete, during insert, before commit and after commit but before refresh. Assert the dataset is either wholly original or wholly replaced, never mixed; that the mutex releases; that no duplicate snapshot is written; and that failures are retryable. Assert that completing the share sheet records only a creation timestamp and claims nothing about iCloud. Assert freshness stays honest after later edits, deletions and lifecycle changes.

## Device drill on a single iPhone

Use disposable representative data. Record the implementation SHA, build, iOS version, fixture and result for each step.

1. Create a backup, save it to iCloud Drive, confirm it appears in the Files app, and validate it with **Check a backup file**. Test cancellation and a not-yet-downloaded iCloud file.
2. Record raw counts and wrap-up values. Restore over disposable existing data; test an invalid file and an interrupted restore followed by relaunch, confirming rollback or complete restore.
3. Delete the app, reinstall it, and restore the iCloud copy into the clean installation with no access to the old sandbox. Compare records and metrics against step 2, then append a correction to prove sequence continuity.
4. Verify historical corrections, repeat-cycle setup, reminder reconciliation and every refreshed screen after restore.

A second device is not required. Record that the replacement-device path was demonstrated by delete-and-reinstall rather than separate hardware.

## Owner runbook to deliver

Document the exact screen steps for a weekly backup saved to iCloud Drive, for checking a saved copy, for recovering after deleting or resetting the phone, and for backing up before an app upgrade or deletion. Explain that recovery reaches only as far as the last saved snapshot, that "On My iPhone" alone is insufficient, that restore replaces rather than merges, that the file is unencrypted personal data, and that signing renewal should install over the same app without deleting it. Include what to do when the app cannot open its database. Do not declare durability complete until the clean-install drill in step 3 passes.
