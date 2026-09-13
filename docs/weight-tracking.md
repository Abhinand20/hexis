# Feature: daily weight logging and averages

Status: implemented on `main` at `c119d17`; every automated criterion in §8 holds (44 suites / 377 tests, `tsc --noEmit` clean, `expo-doctor` 21/21). The §8 device acceptance list is untouched — nothing here has been exercised on a device, under VoiceOver, at large Dynamic Type, or through a real reinstall-and-restore.
Date: 2026-09-12. Baseline: `main` at `85f23fb`, schema version 6, 40 suites / 319 tests passing.
Task-level plan: [weight tracking tasks](weight-tracking-tasks.md).

## 1. Standing and scope

This feature is post-MVP. [The final MVP plan](mvp-final-implementation-plan.md) explicitly defers weight tracking, and its acceptance checklist is unaffected by this document: the wrap-up and durability device drills remain outstanding, and they neither block nor are blocked by this work.

This document supersedes two specific claims in [the project overview](project-overview.md): that the tab bar holds exactly three tabs, and that weight tracking is outside version one. Updating those sections is part of the work, not a follow-up.

A person should be able to record a weight once a day, correct a wrong number, fill in a day they missed, and see what their weekly and monthly averages are doing — without the app implying it knows where their weight is heading.

## 2. Decisions

### Weight is not cycle-scoped

Every existing table hangs off `cycles` through a foreign key. `daily_weights` deliberately does not. Weight is a continuous body measurement: it exists in the gaps between cycles, it does not belong to any practice, and it is not a record of effort. Keying it to a cycle would make a person's weight history disappear whenever they were between cycles.

The consequence is that weight averages are reported over calendar time, and that the cycle wrap-up, cycle archive, `historyInsights` and effective-session SQL are all untouched by this feature.

### One row per local date, replaced in place

A `UNIQUE` index on `local_date` enforces one entry per day structurally. Saving the same date again replaces the value rather than appending.

Rejected alternative: the append-only base-plus-revisions model with tombstones that `session_logs` uses. That machinery exists because corrected *effort* changes what a person achieved, so the audit trail is worth keeping. A mistyped weight is a typo with no audit value. Avoiding a second revision table also keeps `AUTOINCREMENT` out of this feature: `reconcileSqliteSequence` in `src/features/backup/data/restore.ts` is written for `session_log_revisions` specifically, and a second autoincrementing table would force it to become general.

The cost of this choice is recorded in §6: an in-place update does not move `created_at`, so the table needs `updated_at` for backup freshness to notice an edit.

Deleting an entry is a hard delete. There is no tombstone and no recovery, because there is nothing to reconstruct.

### Weight is stored as integer grams

`weight_grams INTEGER NOT NULL CHECK (weight_grams > 0)`. The schema already uses integers for measured quantities (`duration_minutes`), integer grams cannot drift the way repeated floating-point averaging can, and it makes exact assertions possible in tests.

One-decimal display round-trips safely in both units: 1 g is about 0.002 lb, far finer than the 0.1 lb a person sees.

### A single display-unit preference, owned by the weight tab

`weight_preferences` is a single-row table pinned to `id = 1`, mirroring `reminder_settings`. Absent row means kilograms; the V7 migration does not write a default, because a migration should not invent user data.

The kg/lb control lives in the weight tab, not in Settings. This keeps `app/(tabs)/settings/index.tsx` entirely out of the feature's file set, which matters because that screen already hosts the backup section.

Storing one canonical unit and one display preference is deliberate: recording the unit per entry would mean historical rows disagree about what "70.0" meant, and every average would have to resolve mixed units before summing.

### Week and month keys are date strings, never week numbers

A week key is the Monday's local date, produced by the existing `weekStart`. A month key is `YYYY-MM`.

ISO week numbering is deliberately avoided. The week-numbering year diverges from the calendar year around the turn of the year, which is a recurring source of off-by-one-week bugs, and the app has no need for a week *number* anywhere.

Monday–Sunday is not a free choice. "A week means the same thing everywhere in the app" is an existing product principle, and `weekStart` already defines weeks for targets, streaks and the wrap-up's busiest week.

## 3. Experience

A fourth tab, **Weight**, between History and Settings. Tabs stay flat and always visible, consistent with the existing navigation model.

The screen, top to bottom:

1. **Today.** The current display unit, a decimal-pad input, and a save action. When today already has an entry, the value is prefilled and the action reads **Update**, so replacing a value is never silent. Saving shows brief confirmation of what was recorded.
2. **This week and this month.** Average, coverage, range, and the change against the previous period, for both the current Monday–Sunday week and the current calendar month.
3. **Recent entries.** A dated list, most recent first, each row editable and deletable.
4. **Add an earlier day.** A date picker bounded to today and earlier.

Empty and partial states matter as much as the populated one. No entries at all says so plainly and shows only the today input. A period with one entry reports that average without a comparison. No previous period says "Your next week will have a comparison", reusing the wrap-up's phrasing.

Future dates are rejected: a weight is a measurement of something that happened, so there is nothing to record for tomorrow.

Implausible values are rejected with a readable message rather than stored, because a typo of 700 kg silently distorts every average it touches. The accepted range is 20–500 kg equivalent.

No charts in this version. The wrap-up shipped text-only so that no chart needed a text equivalent; the same reasoning applies here. Every value on the screen is already text.

Accessibility is not optional: Dynamic Type, VoiceOver labels on every value and control, and no meaning carried by colour alone.

## 4. Metric contract

One pure selector produces every figure below from a list of entries and today's local date. Inputs are already-resolved entries; the selector performs no I/O.

| Metric | Definition |
| --- | --- |
| Weekly average | Mean of recorded entries whose local date falls in a Monday–Sunday bucket |
| Monthly average | Mean of recorded entries whose local date falls in a calendar month |
| Coverage | Recorded days out of days in the period, shown whenever the period is incomplete |
| Range | Lowest and highest recorded entry in the period |
| Period change | Average of this period minus average of the immediately preceding period, as an absolute difference in the display unit |
| Movement within a period | First and last recorded entry in the period, labelled as such rather than as a trend |
| Partial period | A period whose start or end falls outside the recorded range, or that contains today |

All date arithmetic goes through `addLocalDays`, `weekStart` and the new month helpers. Never divide milliseconds; it breaks across DST.

## 5. Honesty rules

These are product requirements, not style preferences. Each mirrors a rule the app already enforces elsewhere.

- **Averages cover recorded days only.** A missing day is unknown and is never interpolated, carried forward, or treated as zero. This is the direct analogue of the existing rule that a missing session duration is unknown rather than inferred from a practice's target.
- **Coverage is always available** when a period is incomplete, so an average over two days is never presented as if it described a week.
- **Differences are absolute**, in the display unit. No percentages.
- **No projections, goal weights, or recommendations.** The app describes the observed pattern, consistent with the existing principle against adaptive advice. It does not say a person is on track for anything.
- **An empty period says so.** It does not show a zero average.

## 6. Durability contract

Adding tables without registering them in the backup path would mean backups silently omit every weight entry while still reporting success. That is precisely the dishonesty [the durability spec](mvp-data-durability.md) forbids, so the following are requirements of this feature, not follow-ups.

- Both new tables are registered in `LIVE_TABLES`, `DELETE_ORDER`, `INSERT_ORDER` and the explicit `TABLE_COLUMNS` lists in `src/features/backup/data/tables.ts`. Neither has a foreign key, so ordering is unconstrained; append them for determinism.
- The restore preview reports how many weight entries a snapshot contains, so the confirmation honestly describes what is about to be replaced.
- Backup freshness must notice a weight edit. Because an in-place update leaves `created_at` untouched, the change query compares `MAX(created_at, updated_at)` for this table.
- Restoring a backup replaces the display-unit preference along with everything else, exactly as it already replaces reminder settings. This is stated rather than hidden.

Two limitations are documented rather than papered over, both the same class as the already-recorded gap for early-ended cycles:

- A **deleted** weight entry leaves no timestamp behind, so a deletion-only change is invisible to backup freshness.
- `weight_preferences` has no timestamp, so changing the display unit alone is invisible to backup freshness.

Restoring a pre-V7 backup into a V7 app is expected to succeed and produce zero weight entries with cycle data intact. This works because snapshot validation migrates the staging copy forward before the replacement reads from it, and it must be proven by test rather than assumed.

## 7. Out of scope

Deferred deliberately, and not to be added opportunistically: charts and sparklines; a weight reminder (the app has one app-level reminder and per-practice reminders are already excluded); goal weights and projections; body-composition fields; calorie or nutrition tracking; Apple Health or HealthKit; weight figures inside the cycle wrap-up or History; CSV export; and per-entry notes.

An average weight for a finished cycle is the most plausible next step, but it belongs to the wrap-up's contract and should be specified there.

## 8. Acceptance

Automated, all of which must hold before the feature is considered complete:

- `npx jest --runInBand` and `npm run typecheck` clean, with no existing suite regressed, plus `npx expo-doctor` at 21/21.
- A V6 database upgrades to V7 with existing cycles, sessions and corrections intact.
- Saving the same date twice updates one row rather than inserting two, proven against the unique index.
- Averages match hand-calculated fixtures, including a period with missing days, a single-entry period, an empty period, a month containing a DST transition, and a week spanning a month boundary.
- Unit conversion round-trips to one decimal in both directions.
- Future dates and implausible values are rejected.
- A V7 backup round-trips weight entries exactly; a pre-V7 backup restores with zero entries and intact cycles; freshness flips after a weight edit.

Device acceptance, which cannot be claimed from Jest:

- Log today, correct it, backfill an earlier day, and delete an entry, confirming averages and coverage update each time.
- Confirm a weight logged near midnight lands on the expected local date.
- Toggle kg/lb and confirm displayed values and the input agree.
- Read the whole tab with large Dynamic Type and VoiceOver.
- Create a backup, delete and reinstall the app, restore, and confirm weight history returns alongside cycle history.
