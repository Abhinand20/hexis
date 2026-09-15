> **Document status:** implemented in code for the two features this plan required (cycle wrap-up and backup/restore). Device drills here have not been claimed. Weight, deferred in this plan, later shipped. Retained as historical context, not as a current description of the app.

# Hexis final MVP implementation plan

Status: originally an implementation specification. See the document status line above.
Date: 2026-09-08. Product authority: the owner's request to finish with cycle wrap-up and durable data.

## 1. Finish line and authority

Hexis is usable when the owner can finish a cycle, understand what happened and how it compares with previous cycles, start another cycle, and recover their complete history after losing, resetting, or changing phones.

This plan supersedes the mandatory M11–M16 scope in `completion-objective-and-delivery-plan.md` and its branch/cloud handoffs. M0–M10 remain implementation history. Old plans are reference material, not additional release gates. Only defects that prevent these two outcomes or break existing core logging belong in this MVP.

Deliver two features:

1. A permanent cycle wrap-up page with descriptive metrics and comparisons.
2. Complete portable backup and safe replacement restore, demonstrated from an external copy.

Keep existing cycle lengths, practice model, local SQLite runtime, and account-free use. Defer custom cycle dates, weight/calorie tracking, new target types, deleted-activity recovery UI, CSV export, automatic cloud sync, social features, AI insights, and the broader ten-year optimization program. Preserve correction history in backups even though a new recovery UI is deferred.

## 2. Durability decision

The backup artifact is a **SQLite snapshot** produced by `VACUUM INTO`, named `hexis-backup-YYYY-MM-DD.db`, which the owner saves to iCloud Drive through the share sheet. The owner chose this on 2026-09-08 over the previously specified JSON archive. Fidelity comes from SQLite instead of hand-written serialization, older snapshots migrate forward through the existing migration chain instead of bespoke converters, and the file stays readable in any SQLite tool. This removes the checksum contract, the archive-version allowlist, the per-table export and insert code and the converter fixtures from scope. Restore replaces live data through one `ATTACH` plus transaction, so there is no file swap and no promotion of a copied WAL database.

SQLite persistence and a backup left in “On My iPhone” alone do not satisfy phone-loss protection. The MVP requires a copy in iCloud Drive and a successful clean-install restore drill. Recoverability covers the latest saved snapshot; subsequent entries can be lost. Ordinary logging remains offline. Hexis cannot confirm that iCloud finished uploading, so it reports only that a file was created and instructs the owner where to save it.

Offer backup at cycle completion, a quiet Settings prompt when the last backup is over seven days old or missing, and a permanent Settings entry. Recommend a backup before reset, phone transfer, deletion, upgrade, or signing renewal. Do not add background sync or an account system to meet this contract.

## 3. Implementation baseline

At planning time, local and remote main are `eba9576`. Five uncommitted code files carry a History hook-order fix (`useCallback` declared after early returns), a DateTimePicker `onChange` → `onValueChange` API correction, and their regression tests. Commit these as the implementation baseline before feature work; they are defect fixes, not scope. No feature delivery is implied by the earlier cloud handoff documents.

### Verified facts

Checked against installed code on 2026-09-08. Re-verify before editing; these replace assumptions, they do not remove the obligation to read the code.

- Schema is version 6 with six tables: `cycles`, `cycle_goals`, `goal_revisions`, `session_logs`, `session_log_revisions`, `reminder_settings`. No triggers, views or generated columns. `session_log_revisions.sequence` is `INTEGER PRIMARY KEY AUTOINCREMENT`, so `sqlite_sequence` is part of persisted state. A partial unique index enforces one active cycle. `reminder_settings.notification_identifier` is the only device-specific column.
- Effective-session resolution already exists in SQL (`sessionRepository.effectiveSessionSql`): latest revision wins, tombstones excluded. Domain code receives already-resolved sessions.
- There is no query cache. Every screen reads through `useDatabase()` plus `useState`/`useEffect`. Home and History refetch on focus via a local counter; `useActiveCycle` depends only on `[db]` and never refetches. "Invalidate all query state" has no existing mechanism and must be designed, not assumed.
- There is no write coordinator, mutex or busy state. `createCycle`, `stopTracking`, `correct` and `deleteById` use transactions; `reminderService` writes directly; Settings calls `endCycleEarly` from the screen.
- `expo-file-system@57.0.5` is already installed transitively and exposes `File`, `Directory`, `Paths` and `File.pickFileAsync()`. `expo-document-picker` is not needed. `expo-sharing` is not installed and is the only genuinely new native module; adding it costs one local rebuild.
- `expo-sqlite@57.0.1` exposes `backupDatabaseAsync` (SQLite online backup API), `serializeAsync`/`deserializeDatabaseAsync`, and `addDatabaseChangeListener`. The durability specification must choose against these concrete APIs rather than deferring the question.
- Tests run with `npx jest --runInBand`; there is no `test` script. 30 suites and 231 tests pass today against real SQLite through `expo-sqlite-mock`. No backup, restore or wrap-up tests exist.
- `app/cycles/[cycleId]/` has no `_layout.tsx`; routes are registered individually in `app/_layout.tsx`. `app/cycles/[cycleId]/summary.tsx` does not exist.
- Settings has no data section. Its only destructive helper is the `__DEV__` "Reset all data" button.
- iOS will not reliably offer a file with a custom double extension in the system picker unless a document type is declared in `app.json`. Choose a system-recognized extension or declare the type.

Existing foundations:

- `src/features/cycles/domain/cycleSummary.ts`: basic completion totals and highlights.
- `cycleArchive.ts` in the same directory: archive totals and activity-day ratios.
- `app/(tabs)/index.tsx`: completed-cycle card.
- `app/(tabs)/history.tsx`: archive and effective historical corrections.
- Cycle/goal/session repositories: finite cycles, dated membership, original sessions and append-only revisions.
- `src/db/schema.ts`: V1–V6, including reminders, revision sequences, and single-active-cycle protection.
- `src/db/client.ts`, `DatabaseProvider.tsx`, and `migrations.ts`: initialization and migration boundaries to harden for restore.

Inspect actual code before editing. The snapshot copies raw tables, so domain projection types and effective-session queries are irrelevant to backup fidelity; do not route backup through either.

## 4. Delivery order

| Step | Deliverable | Gate |
| --- | --- | --- |
| 0 | Commit the pending History hook-order and DateTimePicker fixes as the baseline; add `expo-sharing` and a direct `expo-file-system` dependency; rebuild locally | Exact SHA recorded; 30 suites still pass; app launches from the new native build |
| 1 | `dataVersion` reload mechanism on `DatabaseProvider` and the backup/restore mutex | Every screen re-reads after a forced bump, including Settings via `useActiveCycle` |
| 2 | Snapshot creation, metadata, validation by `ATTACH`, and transactional replacement | [Durability specification](mvp-data-durability.md) automated criteria pass |
| 3 | Settings data section, restore preview and confirmation, startup error recovery | Corrupt, cancelled and interrupted paths leave data intact |
| 4 | Wrap-up selector, comparison rules, thin route and navigation from Home/History/early end | [Wrap-up specification](mvp-cycle-wrap-up.md) automated criteria pass |
| 5 | Backup CTA and freshness on wrap-up | Both features operate together without stale data |
| 6 | Signed Release build, single-phone backup/clean-install recovery drill, core regression checks | Device evidence below recorded |
| 7 | Update runbook and implementation status | All required gates pass; close MVP |

Durability now leads, because the `dataVersion` reload mechanism from step 1 is what makes restore correct and the wrap-up's backup CTA depends on the durability service. Steps 1–3 and step 4 are otherwise independent enough to split if desired.

Task-level plans: [durability tasks](mvp-durability-tasks.md) and [wrap-up tasks](mvp-wrap-up-tasks.md). Both are scoped to disjoint file sets so they can run in parallel from base `7fe6394`. The wrap-up branch deliberately omits the backup call-to-action and the early-end redirect; both are integration step 5.

Suggested scoped branches are `codex/mvp-cycle-wrap-up` and `codex/mvp-data-durability`; these are handoff boundaries, not an instruction to launch agents. Durability owns the snapshot/restore modules, `DatabaseProvider` changes and the Settings data section. Wrap-up owns selectors and its route. One integration owner resolves Home, History, provider and navigation intersections.

A cloud handoff must name the exact pushed base SHA, this plan, and the relevant feature specification. Cloud output is a reviewable implementation diff and automated evidence. Native file, provider, signing and physical-device claims require local verification. Return changed files, schema/archive impact, commands/results, known failures and remaining device checks. Do not dispatch the old nine-task program.

## 5. MVP acceptance

Record implementation SHA, app build, iOS/device, fixture and result for every check. Use disposable data for destructive tests; never delete the owner's only copy.

- [ ] Fresh full Jest (`npx jest --runInBand`) and TypeScript checks pass; Expo configuration/dependency checks and an iOS production bundle succeed. Record exact commands and results.
- [ ] A naturally completed and an early-ended cycle each open a wrap-up; a first-ever cycle and a zero-log cycle are understandable.
- [ ] Comparisons remain correct across unequal lengths and historical corrections; old wrap-ups remain accessible after starting another cycle; wrap-up totals agree with Home and History for the same cycle.
- [ ] A snapshot from a populated installation is saved to iCloud Drive, visible in Files, and validated by **Check a backup file**.
- [ ] The app is deleted and reinstalled, and restoring the iCloud snapshot into that clean installation reproduces cycles, membership/configuration history, original logs, corrections/deletions, reminder preferences and wrap-up metrics. A correction appended afterwards proves sequence continuity.
- [ ] Record explicitly that replacement-device recovery was demonstrated by delete-and-reinstall on one iPhone, not by separate hardware.
- [ ] Corrupt, non-SQLite, newer-schema and truncated files, cancellation, and an interrupted restore do not damage the existing dataset; an older snapshot migrates forward successfully.
- [ ] Device check covers file selection and iCloud download, share cancellation, restore interrupted before and after commit followed by relaunch, and full screen refresh after restore including Settings.
- [ ] Signed standalone Release cold-launches offline without Metro; logging, history, wrap-up, backup and restore work. Verify same-identity in-place signing renewal preserves data. Free Apple ID and seven-day renewal remain accepted.
- [ ] Wrap-up and backup/restore screens work with large text, VoiceOver, reachable controls and readable loading/error states; existing log/history/repeat paths pass a focused regression check.
- [ ] Owner-facing instructions explain saving to iCloud Drive, freshness limits, recovery after deleting or resetting the phone, the unencrypted contents of the file, and in-place renewal.

Use a representative multi-cycle dataset containing both cycle endings, varying lengths, stopped practices and corrections. Measure Home, wrap-up, export and restore on the reference device and fix blocking stalls; a new ten-year benchmark project is not required.

Do not mark acceptance based on mocks or a generated iOS bundle alone. Once these boxes pass, mandatory MVP feature development is complete. Further features are optional.
