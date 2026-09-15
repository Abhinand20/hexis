# Hexis

## Product summary

Hexis is a calm, local-first iPhone app for building consistency through finite focus cycles. Instead of maintaining an endless, growing list of habits, a person commits to a deliberately small group of practices for a defined period: 30 days by default, with 60- and 90-day options.

The app makes real effort visible without making logging feel like administration. A person opens the active cycle, sees its progress at a glance, and logs a session directly from the habit list.

## The problem

People with several interests often lose momentum not because they lack goals, but because their tracking system is either too vague or too demanding. A useful tracker must:

- Support different kinds of practice: a daily 30-minute reading habit and three weekly one-hour strength sessions are both valid.
- Make the common action quick: logging should take one tap plus an optional quick duration choice.
- Provide enough visual history to sustain motivation without becoming a performance dashboard.
- Avoid turning every missed day into an overdue task.

## Product principles

1. **Finite commitments over endless lists.** Every active group of habits belongs to a 30-, 60-, or 90-day cycle.
2. **Log effort, not intentions.** A log represents a session that occurred and records its actual duration when relevant.
3. **One calm home, a few quiet peers.** Home (the active cycle landing page) is the default tab and primary destination; History, Weight, and Settings are lightweight peer tabs for everything else. Focused tasks present as full-screen modals rather than adding to the tab set, so the destination set stays small and flat: cycle setup, adding a practice, editing a practice, and logging an earlier weight day. Cycle wrap-up is a full-screen stack screen with its own header, not a modal and not a tab.
4. **Quiet motivation.** Streaks, contribution-style calendar marks, and progress bars communicate momentum without scores, ranks, or guilt.
5. **Local by default.** Version one works fully offline and does not require an account. A backup is a SQLite snapshot the person saves themselves (typically to iCloud Drive through the system share sheet). That is not account-backed cloud sync, and Hexis cannot see whether iCloud actually has the file.
6. **Minimal visual language.** Porcelain & Ink uses open warm-neutral surfaces, ink-like typography, and a single muted verdigris progress signal. Glass is reserved for elevated controls and confirmation surfaces. The interface is light-only.

## Primary audience

Hexis is initially designed for a single person tracking a handful of meaningful practices, such as:

- Strength training: 3 sessions per week, about 60 minutes each
- Swimming: 2 sessions per week, about 60 minutes each
- Yoga: 1 session per week
- Reading: 30 minutes every day
- Guitar practice, sport, creative work, or regular posting

The product remains useful when a practice has only a count target, only a duration target, or both.

## Core concept: the cycle

A cycle is a named, time-bounded commitment with:

- A length of 30 days by default, or 60 or 90 days
- A start date and calculated end date
- A small selected set of practices
- Immutable historical session logs

The initial practice group is captured when the cycle begins, but it may evolve without rewriting the past. A person can add a practice or stop tracking one during an active cycle; both changes take effect on the current local date. Every practice keeps inclusive `activeFromDate` and exclusive `inactiveFromDate` boundaries, so earlier days, targets, and logs retain their original membership context. At least one practice must remain active until the cycle ends.

An active practice may still be updated. A returning user can edit its name, target frequency, or expected duration; the update takes effect from that local day forward. Earlier logs and their historical progress remain associated with the configuration that was active when they were recorded.

## Core loop

```mermaid
flowchart LR
  Setup[Create cycle] --> Home[Open active cycle]
  Home --> Log[Log session]
  Log --> Home
  Home --> Review[Review week or cycle]
  Review --> Home
  Home --> Complete[Finish or end cycle]
  Complete --> WrapUp[Cycle wrap-up]
  WrapUp --> Setup
```

1. Create a 30-, 60-, or 90-day cycle.
2. Select starter templates or create custom practices and configure their targets.
3. Review the complete commitment and start the cycle.
4. Open the landing page to see `Day X / duration`, the contribution calendar, and every configured practice.
5. Tap **Log** for the practice that was completed, choose a quick duration when relevant, and save.
6. Use Home to see what remains this week and the recent seven-day rhythm.
7. Review any cycle by day, week, or cycle. When a cycle finishes or is ended early, the wrap-up page offers a backup call to action and a way to prefill the next setup flow from that cycle's final active practices.

## First-time onboarding

The first-run flow stays short. There is no separate welcome screen: cycle setup is three routed steps, starting with a short explanation of a finite focus cycle on the length screen.

1. **Cycle length:** choose 30 days by default, or 60/90 days.
2. **Practice selection:** start with editable templates or add a custom practice, and set weekly/daily frequency and expected duration.
3. **Review and start:** show the entire group and duration together before creating the cycle.

The UI does not ask for notification permission during onboarding. Request it only when the person actively enables the single app-level daily reminder.

## Navigation model

Hexis uses a persistent bottom tab bar with four tabs: **Home**, **History**, **Weight**, and **Settings**. Tabs are always visible, whether or not a cycle is active.

- **Home** shows the active-cycle landing page. Once the active cycle completes (naturally, or ended early) and no new cycle has replaced it, Home instead shows an achievement summary with **View wrap-up** and **Start a new cycle**. A person who has never started a cycle sees a plain empty state with a **Start a cycle** action.
- **History** reviews progress through a Day / Week / Cycle filter (see "Progress and insights" below). Its cycle selector can browse the active cycle and every completed or early-ended cycle without changing which cycle is active. A finished cycle also offers **View wrap-up** and **Repeat cycle** from this tab.
- **Weight** records one body-weight entry per local date and shows weekly and monthly averages over calendar time. The kilogram/pound control lives on this tab, not in Settings. Logging an earlier day is a focused modal, not an extra tab. The recent list shows at most 30 entries. Weight is not keyed to a cycle: it continues between cycles and is never treated as a record of effort.
- **Settings** consolidates adding, editing, or stopping active practices; the daily reminder (a toggle plus a time picker once enabled); ending the current cycle early; and **Data & backup** (create, check, and restore a SQLite snapshot). Backup remains available with or without an active cycle. Ending a cycle early opens that cycle's wrap-up.

These focused tasks present as full-screen modals on top of the tab bar, with the tab bar hidden until the flow is dismissed:

- **Cycle setup** (`/setup`): a nested stack of duration → practices → review, each a real navigation entry with a native header back button and the standard iOS edge-swipe-back gesture
- **Add practice** and **Edit practice**: single-screen modals with native headers (edit also hosts stop-tracking)
- **Log an earlier weight day** (`/log-weight`): a single-screen modal titled "Add an earlier day"

**Cycle wrap-up** (`/cycles/[cycleId]/summary`) is registered as an ordinary stack screen with a native header titled "Cycle wrap-up", not as a modal. It is reached from Home's completion state, from History on a finished cycle, and immediately after ending a cycle early in Settings.

## Active cycle landing page

The landing page replaces a traditional “today” checklist. Its hierarchy answers the most useful questions first:

1. **Cycle header:** cycle name, `Day X / duration`, and days remaining.
2. **This week:** sessions and minutes logged, eligible targets and remaining effort, and calendar days left in the bounded week.
3. **Recent rhythm:** seven local-day buckets plus a neutral session-count comparison with the preceding week.
4. **Unified practice list:** stable user order, explicit remaining progress, current streak, and a session control. A partial-membership week shows raw effort but is labelled instead of scored.
5. **Cycle calendar:** secondary cycle context with one contribution mark per day. Past and current days open that date's History Day progress; future days remain unavailable.

This model avoids falsely marking flexible weekly practices as overdue while keeping every configured practice visible.

## Logging flow

The primary control is a circle beside the practice, not a labelled **Log** button and not a checkbox. VoiceOver still names it as logging.

1. Tap the circle to save a session immediately with the practice's expected duration (or no duration for a count-only practice). The circle shows a count while the weekly target is in progress and a checkmark once it is met; tapping it again still logs another session.
2. Tap the ellipsis to open a sheet and choose a quick duration before saving.
3. A live session records the actual current time at save.
4. History Day can add an activity at an earlier date/time or edit/delete an existing activity. These operations append correction records; they never overwrite or physically remove the base log.
5. Return to Home with weekly metrics, recent rhythm, calendar intensity, and streak refreshed from effective session state.

Practices without a duration target may still log a session with no duration. The app should never require an in-app timer.

## Progress and insights

### Per-practice

- Current streak
- Current week’s completed sessions versus target
- Current week’s logged minutes versus expected minutes when applicable

### History: Day filter

For a selected local date, shows total sessions and minutes, a chronological activity timeline, and every practice that participated on that date. Bounded Previous/Next controls move within the selected cycle. Timeline rows can be corrected or deleted, and **Add activity** can backfill a valid elapsed date. Practice choices follow membership on the editor's date; an existing same-day session remains correctable after its practice is stopped.

### History: Week filter

Weeks are calendar weeks (Monday–Sunday) — the same definition already used for per-practice weekly targets and streaks above, so a week means the same thing everywhere in the app. Defaults to the latest week in the selected cycle; a person can navigate to any earlier week within that cycle. Each week stays compact and visual:

- Sessions completed, time logged, and practices that reached their target
- A seven-day activity rhythm chart
- Session-count movement versus the preceding week
- Target and planned-time progress by practice
- The week's strongest day

It must describe the observed pattern, not make adaptive recommendations.

### History: Cycle filter

Shows the full-cycle contribution grid alongside:

- Active-day ratio across elapsed cycle days
- Total sessions, logged time, and current/longest active-day runs
- A recent six-week session trend (or the full trend when fewer weeks exist)
- Target-normalized consistency and cadence-aware streaks by practice

The metrics remain descriptive rather than evaluative: target progress is capped at 100%, over-target sessions still remain in the raw totals, and the interface does not assign a score or recommendation. History refreshes from SQLite whenever the tab regains focus so a newly logged session appears immediately.

### Cycle wrap-up

The wrap-up page is the completion moment for a cycle that has completed or ended early. It remains available after another cycle starts. An active-cycle or unknown id shows an error state with a way back, not a fabricated result.

It shows, in order: cycle name, actual date range, duration, and **Completed** or **Ended early**; totals for sessions, recorded minutes, active days, and activity-day percentage; a comparison with an earlier finished cycle when one exists; descriptive highlights (longest active-day run, busiest week, most-logged practice); then **Back up data**, **Repeat cycle**, and **See full activity**. The backup control here can only create a snapshot — checking and restoring stay in Settings. Weekly rhythm charts and per-practice rows stay in History.

## Data model

The live schema is version 7.

| Entity | Purpose | Key fields |
| --- | --- | --- |
| `Cycle` | A bounded focus period | id, name, startDate, durationDays, endDate, status, createdAt |
| `CycleGoal` | A dated practice membership captured in a cycle | id, cycleId, name, cadence, weeklyTargetCount, expectedDurationMinutes, activeFromDate, inactiveFromDate, createdAt |
| `GoalRevision` | A forward-only update to a cycle goal | id, cycleGoalId, effectiveDate, changed target/configuration fields |
| `SessionLog` | An immutable base completed session | id, cycleGoalId, localDate, startedAt, durationMinutes, createdAt |
| `SessionLogRevision` | An append-only replacement or tombstone for a base session | sequence, sourceSessionId, cycleGoalId, localDate, startedAt, durationMinutes, tombstone, createdAt |
| `ReminderSettings` | Optional app-level local reminder | enabled, hour, minute, notificationIdentifier |
| `DailyWeight` | One recorded body weight for a local date | id, localDate, weightGrams, createdAt, updatedAt |
| `WeightPreference` | Single-row display unit for weight | id (pinned to 1), unit (`kg` or `lb`) |

Progress is derived from effective sessions, dated membership, and effective goal configuration. It is not stored as a duplicate aggregate.

`DailyWeight` is calendar-scoped rather than cycle-scoped: it has no foreign key to `Cycle`, so weight history remains when a person is between cycles. Canonical storage is integer grams. There is one display-unit row; if it is absent, the Weight tab treats the unit as kilograms. Saving the same local date again replaces that row in place. Deleting a weight is a hard delete: there is no tombstone.

A cycle's `status` moves from `active` to `completed` automatically the next time the app reads cycle state after its `endDate` has passed — there is no background job, since Hexis is local-only and only needs to notice on next open.

## Backup and restore

Hexis stores every table above in one local SQLite file. That file does not survive deleting the app, resetting the phone, or losing the device. A backup is one `.db` snapshot (`hexis-backup-YYYY-MM-DD.db`) created with `VACUUM INTO`, then handed to the system share sheet (`expo-sharing`). Restore validates a picked snapshot, migrates an older copy forward on a staging connection, and replaces live rows transactionally through `ATTACH`. It replaces; it does not merge. Reminder settings, weight history, and the display-unit preference are included.

The file is unencrypted personal data. Hexis cannot see iCloud. Completing the share sheet is not proof that the file arrived or that iCloud finished uploading it. A last-backup timestamp is written to a JSON file outside the database only after the share sheet returns without being treated as cancelled — so a restored snapshot cannot carry another phone's freshness claim, and a clean install starts with no claim. There is no verified/unverified state. Checking a file reports what it contains and does not mark it verified.

Settings shows "You have changes since then" when a later timestamp exists on cycles, practices, revisions, sessions, corrections, or weight rows (`MAX(created_at, updated_at)` for weights). That check cannot see:

- ending a cycle early (status / end date change without a new `created_at`)
- stopping a practice (membership boundary update without a new `created_at`)
- a deleted weight entry (hard delete leaves no timestamp)
- changing only the kilogram/pound preference (`weight_preferences` has no timestamp)
- changing only the daily reminder (`reminder_settings` has no timestamp and is not in the query)

When in doubt, take another backup. A quiet prompt appears when the last backup is missing or at least seven days old. Local copies in the app sandbox keep the two newest regular snapshots; they are not phone-loss protection. A damaged `hexis.db` is renamed aside (`hexis-unreadable-…`) rather than erased; the startup screen offers **Retry** and **Restore from backup**.

The owner-facing procedure is in [owner-backup-runbook.md](owner-backup-runbook.md). Automated coverage lives under Jest; a successful test run is not a device restore drill.

## Technical direction

| Area | Decision |
| --- | --- |
| Platform | iPhone-first, iOS 26+ visual target |
| Framework | Expo with React Native and TypeScript |
| Navigation | Expo Router: a persistent bottom tab group (Home, History, Weight, Settings); modal-presented focused flows (cycle setup, add practice, edit practice, log-weight) with native header back and swipe-back; cycle wrap-up as a non-modal stack screen |
| Persistence | `expo-sqlite`, versioned migrations, offline-first |
| Backup | SQLite snapshot via `VACUUM INTO` and `expo-sharing`; restore via `ATTACH` replacement; freshness timestamp stored outside the database |
| Notifications | `expo-notifications`, one optional app-level local reminder |
| Appearance | `userInterfaceStyle` is `"light"`. The token palette is light-only and every screen hardcodes it; dark mode is unsupported |
| Native glass | `expo-glass-effect` for selective native Liquid Glass surfaces |
| State | Feature-local hooks and repositories; SQLite remains the source of truth |
| Styling | React Native `StyleSheet` plus a small token system; no utility-class dependency |
| Testing | Jest with `jest-expo`, React Native Testing Library, and deterministic repository tests |

`expo-glass-effect` is available on iOS 26 and later and renders a normal `View` fallback on unsupported environments. Hexis should use it sparingly so content remains readable and the design does not depend on glass to communicate state.

## Visual direction: Porcelain & Ink

The app is light-only. `app.json` sets `"userInterfaceStyle": "light"` because the token file defines one light palette and every screen hardcodes it. Under the previous `"automatic"` setting, a phone in dark mode rendered dark native chrome (tab bar, modal headers, alerts, date picker) and dark `expo-glass-effect` surfaces underneath near-black text. Dark mode would require a second palette; it is not a config flip. This pin is covered by a Jest test, not by a device check.

- **Surface:** warm porcelain-like open space, with no decorative gradients.
- **Typography:** high-contrast, ink-like hierarchy using native typography.
- **Accent:** muted verdigris for completion, progress, and calendar intensity.
- **Glass:** tab/navigation surfaces, logging sheet, and elevated confirmation controls only.
- **Motion:** subtle completion feedback (a light haptic on quick-log).
- **Accessibility:** VoiceOver labels for progress and controls, non-color progress labels, and sufficient text contrast over translucent surfaces. Screens do not disable font scaling.

## Version-one scope

Included:

- 30/60/90-day cycles
- Persistent bottom tab navigation (Home, History, Weight, Settings) with modal-presented setup, add-practice, goal-editing, and earlier-day weight flows, native back, and swipe-back
- Cycle wrap-up for completed and early-ended cycles, with comparison, a backup call to action, and repeat-cycle setup
- Daily weight logging with weekly and monthly averages over calendar time, independent of cycle membership, stored as integer grams with a kg/lb display preference
- Automatic active-to-completed cycle transition once the end date passes, with a Home completion summary, **View wrap-up**, and a **Start a new cycle** action
- Editable templates and custom practices before cycle start
- Forward-only add/stop practice membership during an active cycle
- Daily and weekly count/duration targets
- Direct session logging with quick duration choices
- Historical activity add/edit/delete through append-only corrections
- Weekly remaining effort, recent rhythm, unified practice list, streaks, and cycle calendar
- Day/Week/Cycle progress review across the full cycle archive
- Repeat-cycle setup prefilled from the final active configuration of a completed or early-ended cycle
- Returning-user forward-only goal edits
- One optional app-level daily reminder with a time picker
- Local SQLite persistence, currently schema version 7
- Portable SQLite backup and replace-only restore through Settings, plus a wrap-up backup prompt, with the honesty limits above
- Light-only appearance

Explicitly excluded:

- Accounts, sign-in, and account-backed cloud sync (a person may save a snapshot to iCloud Drive themselves; Hexis does not sync)
- Widgets, Apple Watch, Apple Health, or HealthKit
- Per-practice reminders
- In-app timers
- Social sharing, leaderboards, and challenges
- AI coaching or adaptive recommendations
- Payments, subscriptions, and web/Android versions
- Dark mode
- Weight charts, goal weights, calorie tracking, or weight figures inside wrap-up or History

## Success criteria

Hexis succeeds when a person can:

1. Start a default 30-day cycle in under two minutes.
2. Log a session from the landing page in under five seconds after opening the app.
3. State the sessions and minutes remaining this week and recognize the recent seven-day rhythm without leaving Home.
4. Correct an earlier activity without losing its audit trail.
5. Add or stop a practice without changing prior-day targets or history.
6. Browse and repeat earlier cycles without copying their logs or identifiers.
7. Use the entire app offline, without creating an account.
8. Create a backup, understand that finishing the share sheet does not prove iCloud has the file, and restore a snapshot they actually saved — knowing recovery only reaches as far as that snapshot.
