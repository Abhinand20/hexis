> **Document status:** implemented on `main`. Retained as historical context, not as a current description of the app. Schema version and table lists in the body predate daily weight. Device drills have not been claimed.

# Implementation plan: durable backup and restore

Specification: [durability spec](mvp-data-durability.md). Authority: [final MVP plan](mvp-final-implementation-plan.md).
Base SHA: `7fe6394`. Branch: `codex/mvp-data-durability`.

## Ownership and conflict boundary

This branch owns `package.json`, `src/db/DatabaseProvider.tsx`, `src/db/client.ts`, `src/features/backup/**`, `app/(tabs)/settings/index.tsx`, and the `dataVersion` dependency edits in the three existing read hooks.

Do **not** touch `app/_layout.tsx`, `app/cycles/**`, `app/(tabs)/index.tsx`, `app/(tabs)/history.tsx`, or `src/features/cycles/domain/**`. The wrap-up branch owns those. In particular the startup error state renders inside `DatabaseProvider`, not as a new route, specifically to avoid `app/_layout.tsx`.

Do not add a backup call-to-action to the wrap-up page. That is integration step 5, after both branches merge.

## Verified API facts

Probed on 2026-09-08 against the installed packages. The spec's "Verified API behaviour" section has the full list; these are the ones you will code against.

- `VACUUM INTO '<absolute path>'` works from the live WAL connection, writes one file with no `-wal`/`-shm` sidecars, and preserves `user_version`, `sqlite_sequence` and partial indexes. **The destination must not already exist**, and the statement **cannot run inside a transaction**.
- `openDatabaseAsync(name, options?, directory?)` resolves its first argument as a database *name* inside `directory`, defaulting to the exported `defaultDatabaseDirectory`. Passing an absolute path silently creates a new empty database. This is the single most dangerous trap in this feature: a validation routine that opens a snapshot by path will report an empty database and look like data loss.
- `ATTACH DATABASE '<absolute path>' AS src` works against a snapshot file, and `PRAGMA src.user_version`, `PRAGMA src.integrity_check`, `PRAGMA src.foreign_key_check` and `src.sqlite_master` all read correctly through it.
- Delete-then-insert across attached tables inside `db.withTransactionAsync` commits, and rolls back completely on a thrown error before commit. Verified directly.
- `backupDatabaseAsync` is **absent from `expo-sqlite-mock`**. Do not use it anywhere on the primary path.
- `expo-file-system@57` exports `File`, `Directory`, `Paths`. `File` has `copy(destination, { overwrite })`, `move`, `delete()`, `exists`, `size`, and the static `File.pickFileAsync(options)` returning `{ result: File, canceled: false } | { result: null, canceled: true }`. `Directory` has `create()`, `createFile(name, mimeType)`, `list()`.
- `expo-sharing` is not installed.

## Schema facts you must encode

Schema version 6. Six tables. Foreign keys are enabled per connection in `client.ts` and **cannot be toggled inside a transaction**, so correct ordering is mandatory rather than optional.

Dependency graph: `cycles` ← `cycle_goals` ← {`goal_revisions`, `session_logs`} ← `session_log_revisions` (which also references `cycle_goals`). `reminder_settings` is independent and is a single row pinned to `id = 1`.

Delete order: `session_log_revisions`, `session_logs`, `goal_revisions`, `cycle_goals`, `cycles`, `reminder_settings`.

Insert order: `cycles`, `cycle_goals`, `goal_revisions`, `session_logs`, `session_log_revisions`, `reminder_settings`.

`session_log_revisions.sequence` is `INTEGER PRIMARY KEY AUTOINCREMENT`. `INSERT ... SELECT *` sets `main.sqlite_sequence` to the highest *inserted* rowid, which is lower than the snapshot's recorded value whenever rows were deleted. Hexis never deletes revision rows so they are equal in practice, but copy it explicitly anyway and prove it with a test.

Column order for `SELECT *` copying is stable because both databases are at the same schema version after staging migration. Still, write explicit column lists: `cycle_goals` gained `active_from_date` and `inactive_from_date` via `ALTER TABLE` in V5, so its physical column order differs from a fresh `CREATE TABLE`, and an implicit `SELECT *` across two differently-built databases at the same version is a latent bug.

## Task D1 — dependencies and test scaffolding

1. `npx expo install expo-sharing` and add `expo-file-system` to `dependencies` explicitly (it is currently only transitive).
2. Add a `test` script: `"test": "jest --runInBand"`. Docs elsewhere reference `npx jest --runInBand`; keep both working.
3. Mock `expo-sharing` in tests. Prefer a per-suite `jest.mock` over a global mock in `src/test/setup.ts`, so tests can assert share invocation and cancellation.
4. Confirm `npx jest --runInBand` still reports 30 suites / 231 tests passing and `npm run typecheck` is clean before writing feature code.

A native rebuild is required before device testing but not for Jest. Note in the PR that the reviewer must rebuild.

## Task D2 — reload mechanism and busy state

Extend `src/db/DatabaseProvider.tsx`:

```ts
type DatabaseContextValue = {
  db: SQLiteDatabase | null;
  isLoading: boolean;
  error: Error | null;
  /** Increments when the underlying dataset is replaced wholesale. */
  dataVersion: number;
  /** Marks every reader stale after a restore. */
  reloadAll: () => void;
  /** True while an exclusive backup or restore holds the database. */
  isBusy: boolean;
  setBusy: (busy: boolean) => void;
  resetDatabase: () => Promise<void>;
};
```

Add `dataVersion` to the dependency array of every read path, so a bump refetches:

- `src/features/cycles/hooks/useActiveCycle.ts` — currently `[db]` only and never refetches on focus. This is the hook that would otherwise leave Settings showing pre-restore data.
- `src/features/cycles/hooks/useCycleLanding.ts` — already accepts a `reloadToken`; fold `dataVersion` in.
- `src/features/cycles/hooks/useCycleHistory.ts` — add alongside `refreshVersion`.
- `app/(tabs)/settings/index.tsx` — both the goals `useFocusEffect` and the reminder effect.

After a successful restore, call `reloadAll()` and then navigate to Home with `router.replace("/")`. The navigation reset is deliberate: the screen the owner was on may reference a cycle or session ID that no longer exists.

Rejected alternative, for the reviewer's benefit: remounting `children` under a `key={dataVersion}` would invalidate everything in one line, but the Expo Router `Stack` lives inside `DatabaseProvider`, so remounting it resets navigation state through a path Expo Router does not document. Explicit hook dependencies plus one deliberate `replace` is more predictable.

Also render the startup failure state here. When `error` is set, show a screen with the message, a **Retry** action that re-runs `openDatabase()`, and a **Restore from backup** action. It must not depend on Home, tabs, or an existing cycle.

## Task D3 — snapshot creation

New module `src/features/backup/data/snapshot.ts`.

```ts
export const BACKUP_DIRECTORY_NAME = "backups";
export const SNAPSHOT_METADATA_TABLE = "backup_metadata";

export type SnapshotResult = {
  uri: string;
  fileName: string;
  createdAt: string;   // UTC ISO
  schemaVersion: number;
  sizeBytes: number;
};

export async function createSnapshot(
  db: SQLiteDatabase,
  options: { appVersion: string; now?: Date; label?: string },
): Promise<SnapshotResult>;
```

Steps, in order:

1. Ensure `<Paths.document>/backups/` exists.
2. Compute `hexis-backup-YYYY-MM-DD.db` from the local date. If that path exists, delete it first — `VACUUM INTO` fails on an existing destination. When the owner takes two backups on one day, the second replaces the first *local* copy; it cannot affect a copy already saved to iCloud.
3. Read `PRAGMA user_version` from the live database.
4. Run `VACUUM INTO '<absolute path>'` outside any transaction.
5. `ATTACH` the new file as `snap`, `CREATE TABLE snap.backup_metadata (created_at TEXT NOT NULL, app_version TEXT NOT NULL, schema_version INTEGER NOT NULL)`, insert exactly one row, `DETACH`. Wrap so that `DETACH` runs even on failure, and delete a partially written file if metadata fails.
6. Return the result. Do not record the freshness timestamp here; the caller does that only after the share sheet is presented.

Prune `backups/` to the two most recent local snapshots, plus any `pre-restore-*` file from the current session.

## Task D4 — validation

New module `src/features/backup/data/snapshotValidation.ts`. It runs against an **opened staging connection**, where the snapshot is `main`. Never against an attached alias, and never against a path passed to `openDatabaseAsync`.

```ts
export type SnapshotPreview = {
  createdAt: string | null;      // null when backup_metadata is absent
  appVersion: string | null;
  schemaVersion: number;
  cycleCount: number;
  sessionCount: number;
  correctionCount: number;
  hasActiveCycle: boolean;
};

export type SnapshotProblem =
  | { kind: "not_a_database" }
  | { kind: "unsupported_schema_version"; found: number; supported: number }
  | { kind: "missing_table"; table: string }
  | { kind: "integrity"; detail: string }
  | { kind: "foreign_key"; detail: string }
  | { kind: "invariant"; detail: string }
  | { kind: "too_large"; sizeBytes: number };

export async function validateSnapshot(
  stagingDb: SQLiteDatabase,
): Promise<{ preview: SnapshotPreview; problems: SnapshotProblem[] }>;
```

Checks:

- All six expected tables present in `sqlite_master`.
- `PRAGMA integrity_check` returns exactly `ok`; `PRAGMA foreign_key_check` returns no rows.
- At most one `cycles` row with `status = 'active'`.
- `cycles.status IN ('active','completed','ended_early')`, `duration_days IN (30,60,90)`, `end_date >= start_date`.
- Every `local_date`, `start_date`, `end_date`, `active_from_date` and `effective_date` matches `GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]'`. `cycle_goals.active_from_date` allows the legacy empty string only if such rows exist in the wild; prefer rejecting and say so in the message.
- `inactive_from_date IS NULL OR inactive_from_date > active_from_date`.
- `duration_minutes IS NULL OR duration_minutes > 0` in both session tables.
- `weekly_target_count > 0` in `cycle_goals` and `goal_revisions`.
- `session_log_revisions.tombstone IN (0,1)`.
- `reminder_settings` has at most one row, `id = 1`, `hour` 0–23, `minute` 0–59.
- Referential closure, even though `foreign_key_check` covers it, because the message should name the table.

`foreign_key_check` and referential closure only hold if foreign keys were enforced when the staging connection opened; open staging through the same helper that sets `PRAGMA foreign_keys = ON`.

Schema version handling: reject `found > MIGRATIONS.length`. When `found < MIGRATIONS.length`, run the existing `runMigrations` against the staging connection and re-validate. Export the supported version from `src/db/migrations.ts` rather than hard-coding 6.

## Task D5 — staging and replacement

New module `src/features/backup/data/restore.ts`.

Staging must live in `defaultDatabaseDirectory` so it can be opened by name. Use a fixed name such as `hexis-restore-staging.db`; delete any leftover before copying.

```ts
export type StagedSnapshot = {
  databaseName: string;
  absolutePath: string;   // for ATTACH
  preview: SnapshotPreview;
};

export async function stageAndValidate(picked: File): Promise<
  { ok: true; staged: StagedSnapshot } | { ok: false; problems: SnapshotProblem[] }
>;

export async function replaceLiveData(
  liveDb: SQLiteDatabase,
  staged: StagedSnapshot,
): Promise<void>;

export async function discardStaging(staged: StagedSnapshot): Promise<void>;
```

`stageAndValidate`: reject over 50 MiB using `picked.size` before opening anything; `copy()` into the SQLite directory, which also forces an iCloud download; open by name with foreign keys on; migrate forward if older; validate; close the connection before returning, keeping the path.

`replaceLiveData`, all on the live connection:

1. `ATTACH DATABASE '<staged.absolutePath>' AS src`.
2. `withTransactionAsync`: delete in the documented order, insert in the documented order with explicit column lists, then reconcile `sqlite_sequence`:

```sql
DELETE FROM main.sqlite_sequence WHERE name = 'session_log_revisions';
INSERT INTO main.sqlite_sequence (name, seq)
SELECT name, seq FROM src.sqlite_sequence WHERE name = 'session_log_revisions';
```

   Guard the case where `src.sqlite_sequence` has no such row, which is normal for a snapshot with no corrections. Do not copy `backup_metadata` into `main`.
3. Still inside the transaction, re-run `PRAGMA main.foreign_key_check` and the invariant queries against `main`. Throw to roll back on any failure. `PRAGMA integrity_check` inside the transaction is not meaningful for uncommitted pages; run it after commit instead.
4. Commit, then `DETACH`. Use `try`/`finally` so `DETACH` always runs.
5. After commit, run `PRAGMA integrity_check` and confirm counts match `staged.preview`. A mismatch here is a bug to surface loudly, not to swallow.

Take the automatic pre-restore snapshot *before* calling `replaceLiveData`, via `createSnapshot` with a `pre-restore-<timestamp>` label. If `replaceLiveData` throws, the transaction has already rolled back, so the pre-restore snapshot is insurance against a bug rather than a routine recovery step; say exactly that in the UI.

Unreadable live database: rename `hexis.db` and any `-wal`/`-shm` sidecars to `hexis-unreadable-<timestamp>.db`, open a fresh database, and run the normal restore into it. Never delete the original. This lives in `src/db/client.ts` beside `openDatabase`.

## Task D6 — mutex, freshness, hooks

`src/features/backup/data/backupMutex.ts` — a module-level promise-chaining mutex with `runExclusive<T>(fn)`. Both create and restore acquire it; it also drives `setBusy` so logging and editing show a pending state. Release on every path, including throws.

`src/features/backup/data/backupStatus.ts` — freshness lives in `<Paths.document>/backup-status.json`, deliberately outside the database so a snapshot cannot carry the source phone's freshness claim into a restored installation, and a clean install starts with no claim.

```ts
export type BackupStatus = {
  lastBackupCreatedAt: string | null;  // UTC ISO
  lastBackupFileName: string | null;
};
```

Treat a missing, unreadable or malformed file as "no backup recorded". Never throw from a read.

`src/features/backup/domain/backupFreshness.ts` — pure, therefore easily tested:

```ts
export const BACKUP_STALE_AFTER_DAYS = 7;
export function isBackupStale(lastBackupCreatedAt: string | null, now: Date): boolean;
export function describeBackupAge(lastBackupCreatedAt: string | null, now: Date): string;
```

"Changes since backup" is a boolean from one query, not a count:

```sql
SELECT EXISTS (
  SELECT 1 FROM cycles WHERE created_at > ?
  UNION ALL SELECT 1 FROM cycle_goals WHERE created_at > ?
  UNION ALL SELECT 1 FROM goal_revisions WHERE created_at > ?
  UNION ALL SELECT 1 FROM session_logs WHERE created_at > ?
  UNION ALL SELECT 1 FROM session_log_revisions WHERE created_at > ?
) AS changed
```

`created_at` is UTC ISO text and lexicographically comparable, so this is sound. Note in a comment that ending a cycle early updates a row without changing `created_at`, so a lifecycle-only change is not detected; the spec asks for honest freshness, so also compare against the most recent `cycles.end_date` transition if a cheap signal exists, otherwise state the limitation in the runbook rather than implying it is covered.

Hooks in `src/features/backup/hooks/`: `useBackupStatus`, `useCreateBackup`, `useRestoreBackup`. Keep native calls (`Sharing.shareAsync`, `File.pickFileAsync`) in the hooks so the data modules stay unit-testable without native mocks.

## Task D7 — Settings UI

Add a "Data & backup" section to `app/(tabs)/settings/index.tsx`, above the existing `__DEV__` reset block and visible with or without an active cycle.

- Status line: "Last backup created &lt;relative date&gt;", or "No backup yet". Add the honest qualifier that Hexis cannot confirm the file reached iCloud or finished uploading. Show "You have changes since then" when applicable, and a quiet stale prompt past seven days.
- **Create backup** → snapshot, then share sheet. Show the iCloud Drive instruction *before* the sheet and repeat it in the success state: save to iCloud Drive, not "On My iPhone", because a copy that stays on the phone does not survive losing the phone. Record the freshness timestamp only when the sheet was presented without error; cancellation records nothing.
- **Check a backup file** → pick, stage, validate, report contents. No persisted "verified" status.
- **Restore backup** → pick, stage, validate, then a preview requiring explicit confirmation. The preview shows snapshot creation date, source app and schema version, cycle and session counts, and whether it contains an active cycle, and states that this replaces all data and does not merge. Offer, but do not force, a backup of current data first when the installation is non-empty.
- After success: discard the restored `notification_identifier`, reconcile reminder scheduling against current permissions, report a scheduling failure separately from the data restore, then `reloadAll()` and `router.replace("/")`.

Do not reuse the `__DEV__` reset helper anywhere in this flow.

## Task D8 — tests

Real SQLite through `expo-sqlite-mock`; inspect snapshots by `ATTACH` or by a staging connection opened by name, never by path.

`__tests__/backup/snapshot.test.ts` — creation writes one file with no sidecars; metadata row correct; `user_version` and `sqlite_sequence` preserved; existing destination replaced; pruning keeps two; metadata failure leaves no partial file.

`__tests__/backup/snapshotValidation.test.ts` — a valid populated snapshot; empty database; missing table; non-SQLite bytes; truncated file; newer schema rejected with the found and supported versions; older snapshot migrated forward then valid; two active cycles; broken references; bad dates; non-positive durations; oversized input.

`__tests__/backup/restore.test.ts` — round-trip equality of raw rows for every table across empty, active, completed and early-ended cycles, membership and configuration changes, corrections, moves, tombstones and null durations; `sqlite_sequence` continuity proven by appending a correction after restore and asserting the new sequence exceeds the restored maximum; `backup_metadata` not copied into `main`; failure injected before the transaction, during delete, during insert and before commit each leaves the original dataset exactly intact; after-commit verification failure is surfaced; the mutex releases on every path; staging is cleaned up.

`__tests__/backup/backupFreshness.test.ts` — pure boundary cases at six, seven and eight days, and the no-backup case.

`__tests__/components/settingsBackup.test.tsx` — status rendering; the iCloud instruction is present; a cancelled share records no timestamp; a cancelled pick changes nothing; the restore preview requires confirmation; error states are readable and retryable.

`__tests__/db/databaseProviderReload.test.tsx` — `reloadAll()` causes every dependent hook to refetch, `useActiveCycle` included; the startup error state offers Retry and Restore.

## Task D9 — runbook

Write `docs/owner-backup-runbook.md`: weekly backup saved to iCloud Drive, checking a saved copy, recovering after deleting or resetting the phone, backing up before an upgrade, the snapshot-date recovery limit, that "On My iPhone" is insufficient, that restore replaces rather than merges, that the file is unencrypted personal data, in-place signing renewal, and what to do when the app cannot open its database.

## Definition of done for this branch

`npx jest --runInBand` and `npm run typecheck` both clean, with the new suites included and no existing suite regressed. Every automated case above covered. PR body lists changed files, the new dependency and the required native rebuild, commands run with results, and the device checks still outstanding. Do not claim device or iCloud verification: this branch cannot perform it.
