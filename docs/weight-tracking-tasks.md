# Implementation plan: daily weight logging and averages

Specification: [weight tracking spec](weight-tracking.md).
Base SHA: `85f23fb` (pushed to origin). Branch: `codex/weight-tracking`.
Baseline to preserve: 40 suites / 319 tests passing, `npm run typecheck` clean, `npx expo-doctor` 21/21.

Read the specification first. It records *why* the data model diverges from the session-log model; this document records *how* to build it and which parts of the existing code will bite you.

No native module is added, so no native rebuild is required. Do not add one.

## Ownership and execution model

This feature is small enough, and coupled tightly enough to the backup path, that **one agent working through W1–W9 in order is the recommended shape**. Two agents would both need `src/features/backup/data/tables.ts`, `src/db/schema.ts` and the shared domain types, which is where a merge conflict would land.

If you do split it, W1 and W2 must be finished and pushed first, because everything else compiles against the types and repository they create. After that fork point, the file sets are disjoint:

| Track | Owns |
| --- | --- |
| Data and durability | `src/features/weight/data/**`, `src/features/backup/**`, `__tests__/backup/**`, `__tests__/db/migrations.test.ts`, `docs/owner-backup-runbook.md` |
| Domain and UI | `src/features/weight/domain/weightAverages.ts`, `src/features/weight/hooks/**`, `src/features/weight/components/**`, `app/(tabs)/weight.tsx`, `app/(tabs)/_layout.tsx`, `src/features/cycles/domain/date.ts`, `__tests__/domain/**`, `__tests__/components/**` |

Do not touch `app/(tabs)/settings/index.tsx`, `app/(tabs)/index.tsx`, `app/(tabs)/history.tsx`, `app/cycles/**`, or anything under `src/features/cycles/domain/` other than the month helpers added to `date.ts` in W4.

## Verified facts

Probed on 2026-09-12 against the installed packages and this checkout. Re-verify before relying on anything else; these replace assumptions, they do not remove the obligation to read the code.

- Schema is at version 6. `SUPPORTED_SCHEMA_VERSION` in `src/db/migrations.ts` is derived from `MIGRATIONS.length`, so appending `SCHEMA_V7` is the only version bookkeeping needed. **Do not hard-code 7 anywhere.**
- A `UNIQUE` index on `local_date` **does** reject a duplicate insert under `expo-sqlite-mock`. Confirmed by probe.
- `INSERT … ON CONFLICT(local_date) DO UPDATE SET …` **works** under `expo-sqlite-mock`, keeps the original row's `id` and `created_at`, updates the targeted columns, and leaves the row count at one. Confirmed by probe. This is the upsert primitive to use.
- `substr(local_date, 1, 7)` grouping with `AVG()` works in SQL, and scalar `MAX(created_at, updated_at)` works inside an `EXISTS` subquery. Confirmed by probe. Grouping still belongs in the domain layer (see W4); these were probed because the freshness query in W5 needs the scalar `MAX`.
- `openDatabase(":memory:")` from `src/db/client.ts` runs the full migration chain and is how every repository test opens a database. `__tests__/backup/helpers.ts` already wraps it as `openLiveDatabase()`.
- `generateId(prefix)` in `src/db/id.ts` is the only id generator: `` `${prefix}_${base36 time}_${base36 random}` ``. There is no uuid dependency.
- `src/features/cycles/domain/date.ts` exports `addLocalDays`, `weekStart`, `todayLocalDate`, `localDateForInstant` and `cycleEndDate`. There are **no** month helpers; W4 adds them.
- `@react-native-community/datetimepicker` in this repo takes **`onValueChange`**, not `onChange`. Commit `ef0d155` fixed exactly that mistake. Copy the working usage from the reminder row in Settings.
- All of `scale-outline`, `body-outline`, `barbell-outline`, `trending-up-outline`, `analytics-outline`, `fitness-outline` and `speedometer-outline` exist in the installed Ionicons glyph map. Confirmed by probe against the glyph JSON.
- `snapshotValidation.validateSnapshot` calls `runMigrations(stagingDb)` whenever the snapshot's `user_version` is below supported, **before** the missing-table check, and `stageAndValidate` hands `replaceLiveData` that same migrated staging file to `ATTACH`. This is why a pre-V7 backup restores cleanly. Verified by reading the code, **not** by execution — prove it with the test in W8.
- `reconcileSqliteSequence` in `restore.ts` is hardcoded to `session_log_revisions`. Neither new table uses `AUTOINCREMENT`, so leave that function alone.

## Known traps

- **`.expo/types/router.d.ts` is gitignored and stale.** Expo generates typed routes there and `tsconfig.json` includes it, so a fresh checkout has no typed-route checking at all and a stale one rejects new routes. A clean `npm run typecheck` in a fresh worktree therefore does **not** verify route correctness. After adding the weight tab, run `npx expo start` once to regenerate the file, kill it, then re-run typecheck. This cost real debugging time on the last feature.
- **The tab layout has two documented crash modes.** Read the comments at the top of `app/(tabs)/_layout.tsx` before editing it. Using a distinct filled/outline icon pair races `getImageSource` and makes RNScreens throw; setting `tintColor` without the paired `iconColor` default/selected entries trips "icon and selectedIcon must be same type." Use the existing `tabIcon()` helper and `ICON_COLOR` unchanged.
- **Several component suites mock `useDatabase` partially.** If a new hook destructures a context field those mocks omit, the suite fails with "not a function". Follow the existing idiom and default the field (`const { dataVersion = 0 } = useDatabase()`), or add the field to the mock.
- **`jest.mock` factories cannot reference out-of-scope variables** unless the identifier starts with `mock`. A fixture named `readyState` referenced from a factory fails to load the suite; `mockReadyState` works.

## Schema facts to encode

`SCHEMA_V7` in `src/db/schema.ts`:

```sql
CREATE TABLE daily_weights (
  id TEXT PRIMARY KEY NOT NULL,
  local_date TEXT NOT NULL,
  weight_grams INTEGER NOT NULL CHECK (weight_grams > 0),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
)
```
```sql
CREATE UNIQUE INDEX daily_weights_local_date ON daily_weights(local_date)
```
```sql
CREATE TABLE weight_preferences (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  unit TEXT NOT NULL CHECK (unit IN ('kg', 'lb'))
)
```

Neither table has a foreign key, so both are leaves in the dependency graph. The migration writes no rows: an absent `weight_preferences` row means kilograms.

## Task W1 — schema and migration

Append `SCHEMA_V7` to `src/db/schema.ts` and to the `MIGRATIONS` array in `src/db/migrations.ts`. Nothing else in `migrations.ts` changes.

Extend `__tests__/db/migrations.test.ts`: a database at V6 containing cycles, goals, sessions and corrections upgrades to V7 with every prior row intact, `PRAGMA user_version` reporting 7, both tables present, and the unique index rejecting a duplicate date.

**Gate:** existing 40 suites still pass. A schema change that breaks an existing suite means the migration is wrong, not the suite.

## Task W2 — types, units, repository

`src/features/weight/domain/types.ts`:

```ts
export type WeightUnit = "kg" | "lb";

export type WeightEntry = {
  id: string;
  localDate: string;    // local YYYY-MM-DD
  weightGrams: number;  // canonical integer grams
  createdAt: string;    // UTC ISO
  updatedAt: string;    // UTC ISO
};
```

`src/features/weight/domain/units.ts` — pure, no I/O:

```ts
export const GRAMS_PER_KG = 1000;
export const GRAMS_PER_LB = 453.59237;
export const PLAUSIBLE_MIN_GRAMS = 20_000;
export const PLAUSIBLE_MAX_GRAMS = 500_000;

export function unitToGrams(value: number, unit: WeightUnit): number;   // rounds to integer grams
export function gramsToUnit(grams: number, unit: WeightUnit): number;   // one decimal
export function formatWeight(grams: number, unit: WeightUnit): string;  // "69.5 kg"
export function isPlausibleWeight(grams: number): boolean;
```

`src/features/weight/data/weightRepository.ts`, following the shape of the existing repositories (a `create…Repository(db)` factory returning an interface):

```ts
export type SaveWeightInput = { localDate: string; weightGrams: number };

export interface WeightRepository {
  save(input: SaveWeightInput): Promise<WeightEntry>;          // upsert on local_date
  deleteByDate(localDate: string): Promise<void>;
  getByDate(localDate: string): Promise<WeightEntry | null>;
  listRange(startDate: string, endDate: string): Promise<WeightEntry[]>;  // inclusive, ascending
  listRecent(limit: number): Promise<WeightEntry[]>;                      // descending by date
  getUnit(): Promise<WeightUnit>;                                         // "kg" when no row
  setUnit(unit: WeightUnit): Promise<void>;                               // upsert on id = 1
}

export function createWeightRepository(db: SQLiteDatabase): WeightRepository;
```

`save` must reject a future `localDate` and an implausible `weightGrams` before touching the database, with messages a person can read. Use `ON CONFLICT(local_date) DO UPDATE` so `created_at` survives an edit and `updated_at` moves.

Tests in `__tests__/weight/weightRepository.test.ts` against real SQLite: insert then update the same date leaves one row with the original `id` and `created_at` and a newer `updated_at`; delete removes only the target date; `listRange` is inclusive at both ends and ascending; `listRecent` respects its limit and ordering; `getUnit` returns `"kg"` with no row and round-trips through `setUnit`; future dates and implausible weights are rejected.

## Task W3 — month helpers

Add to `src/features/cycles/domain/date.ts`, built from the same UTC-component arithmetic as its neighbours:

```ts
export function monthStart(date: string): string;  // YYYY-MM-01
export function monthEnd(date: string): string;    // last day of that month
export function monthKey(date: string): string;    // YYYY-MM
```

Implement `monthEnd` as the day before the next month's start. Do not divide milliseconds anywhere.

Extend `__tests__/domain/date.test.ts`: 31-, 30- and 28-day months, a February in a leap year, December rolling into January, and dates inside both DST transitions.

## Task W4 — averages selector

`src/features/weight/domain/weightAverages.ts`, pure and I/O-free:

```ts
export type WeightPeriod = {
  key: string;                    // week: the Monday's date. month: YYYY-MM
  startDate: string;
  endDate: string;
  averageGrams: number | null;    // null when the period has no entries
  recordedDays: number;
  periodDays: number;
  lowestGrams: number | null;
  highestGrams: number | null;
  firstGrams: number | null;
  lastGrams: number | null;
  isPartialPeriod: boolean;
};

export type WeightPeriodComparison = {
  period: WeightPeriod;
  previous: WeightPeriod | null;
  averageDifferenceGrams: number | null;  // null when either side has no average
};

export function buildWeeklyPeriods(entries: WeightEntry[], today: string): WeightPeriod[];
export function buildMonthlyPeriods(entries: WeightEntry[], today: string): WeightPeriod[];
export function compareWithPrevious(
  periods: WeightPeriod[],
  key: string,
): WeightPeriodComparison;
```

Week buckets come from `weekStart`; month buckets from `monthKey`. Both return periods in ascending order and include only periods that contain at least one entry, plus the period containing `today` even when empty — a person opening the tab on a Monday should see this week, not last week.

`averageGrams` divides by `recordedDays`, never by `periodDays`. Round to the nearest gram at the boundary only, so repeated averaging cannot drift.

Tests in `__tests__/domain/weightAverages.test.ts` with hand-calculated fixtures, asserted independently of any UI: a full seven-day week; a week with three recorded days reporting coverage 3 of 7; a single-entry period whose average equals that entry and whose comparison is null; an empty current period; a week spanning a month boundary appearing in one week bucket and two month buckets; a month containing a DST transition with the correct `periodDays`; consecutive periods producing a signed absolute difference; a period whose predecessor has no entries yielding a null difference; and entries arriving unsorted still bucketing correctly.

## Task W5 — durability registration

This task is the reason the feature is not just a new tab. Work through `src/features/backup/`:

1. `data/tables.ts` — add `daily_weights` and `weight_preferences` to `LIVE_TABLES`, append both to `DELETE_ORDER` and `INSERT_ORDER`, and add explicit `TABLE_COLUMNS` entries. Keep the column lists in physical order.
2. `data/snapshotValidation.ts` — add `weightEntryCount` to `SnapshotPreview` and populate it. Add invariants: `daily_weights.local_date` matches the date glob; `weight_grams > 0`; `COUNT(*) = COUNT(DISTINCT local_date)` so a corrupt file gives a readable message instead of a raw constraint error; `weight_preferences` has at most one row with `id = 1` and a unit in `('kg','lb')`. Guard each behind the existing `tables.has(...)` pattern.
3. `data/restore.ts` — include the weight count in `assertPostCommit`'s row-count comparison.
4. `data/backupStatus.ts` — add `UNION ALL SELECT 1 FROM daily_weights WHERE MAX(created_at, updated_at) > ?` to `hasChangesSinceBackup`, with the matching extra bind parameter. Extend the existing comment to record that a deleted entry and a unit change are both invisible to freshness.
5. `components/BackupPreviewCopy.tsx` — report the weight entry count alongside cycles, sessions and corrections.

Do not change the snapshot creation path; `VACUUM INTO` copies whole databases and needs nothing.

## Task W6 — hooks

`src/features/weight/hooks/useWeightLog.ts` and `useWeightAverages.ts`, or one hook if that reads better. Follow the existing conventions: read through `useDatabase()`, include `dataVersion` in every dependency array so a restore refreshes the tab, refetch on focus via `useFocusEffect`, and default any context field you destructure.

Load bounded data: the recent-entries list and the ranges needed for the current and previous week and month. Do not load the entire weight history to compute two averages.

Declare every hook **above** any early return. Home and History carry a hook-order fix for exactly this reason.

## Task W7 — the tab

`app/(tabs)/weight.tsx` plus a fourth `NativeTabs.Trigger` named `weight`, placed between `history` and `settings/index` in `app/(tabs)/_layout.tsx`.

Re-read the trap list before editing the layout. Use `tabIcon()` with one of the verified glyph names and leave `ICON_COLOR` alone.

Build the screen in the order the specification gives, reusing `colors`/`spacing` from `src/design/tokens.ts` and `GlassSurface` only where the existing screens use it. The date picker for backfill uses `onValueChange` and is bounded to today and earlier.

Then regenerate typed routes (`npx expo start`, wait for `.expo/types/router.d.ts` to be written, kill it) and re-run `npm run typecheck`.

## Task W8 — tests

Beyond the per-task suites above:

`__tests__/components/weightTab.test.tsx` — empty state shows only the today input; saving today's weight records it and the action becomes **Update** with the value prefilled; updating replaces rather than appends; backfilling an earlier date works and a future date is refused; an implausible value is refused with a readable message; deleting an entry updates the averages; the kg/lb toggle changes displayed values and the input together; coverage appears for an incomplete period and "Your next week will have a comparison" appears with no prior period.

`__tests__/components/tabShell.test.tsx` — extend the existing three-tab assertion (around lines 197–199) to include **Weight**.

`__tests__/backup/weightRoundTrip.test.ts` — a populated V7 database round-trips every `daily_weights` and `weight_preferences` row exactly through snapshot and restore; a snapshot taken at V6 restores into a V7 app with zero weight entries and every cycle, session and correction intact; the restore preview reports the weight entry count; `hasChangesSinceBackup` flips from false to true after editing a weight and nothing else; restoring does not disturb `sqlite_sequence` continuity for corrections.

Use real SQLite through `expo-sqlite-mock` rather than mocking repositories, per the existing backup suites.

## Task W9 — documentation

- `docs/owner-backup-runbook.md` — state that a backup now contains weight history and the display-unit preference, and that restoring replaces both.
- `docs/project-overview.md` — the tab bar is now four tabs (Home, History, Weight, Settings); add `DailyWeight` to the data-model table; move weight tracking out of the excluded list; and note that weight is calendar-scoped rather than cycle-scoped.
- `docs/weight-tracking.md` — flip the status line from "specification only" to implemented, with the SHA.

## Definition of done

`npx jest --runInBand` and `npm run typecheck` both clean with no existing suite regressed, and `npx expo-doctor` still at 21/21. Typecheck must be run *after* regenerating `.expo/types/router.d.ts`, or it has not actually checked the new route.

Every automated case in the specification's acceptance section covered, with selector values asserted against hand-calculated fixtures independently of the UI.

Focused commits whose messages explain why, then a pull request against `main` whose body lists the changed files, states that schema version 7 was added and that no native rebuild is required, gives the exact commands run with their results, and lists the device checks that remain outstanding.

Do **not** claim device, iOS, VoiceOver or large-text verification, and do not claim the backup round trip was verified on a phone. State plainly that the restore path is verified only under the Jest harness and that the specification's device acceptance list is untouched.
