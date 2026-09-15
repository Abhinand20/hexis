# Personal-device build runbook

Hexis v1 "release readiness" means a local Xcode build installed directly on
one personal iPhone, signed with a free Apple ID. It explicitly does **not**
mean TestFlight or App Store Connect: EAS Build cannot produce an installable
iPhone build without a paid Apple Developer Program membership — that's an
Apple code-signing restriction, not an Expo limitation. A free-Apple-ID
install expires after **7 days** and has to be re-run; this doc is the
repeatable procedure for doing that, not a one-time checklist.

## Prerequisites (once per machine)

- A Mac with Xcode installed (from the Mac App Store), with the Xcode
  license accepted and command-line tools selected:
  ```bash
  sudo xcode-select --switch /Applications/Xcode.app/Contents/Developer
  sudo xcodebuild -license accept
  ```
- Any free Apple ID, signed into Xcode: **Xcode → Settings → Accounts → +**.
  A free account is sufficient for local development installs; it does not
  need a paid Apple Developer Program membership.
- The target iPhone running iOS 26+, connected to the same Mac via USB (or
  the same Wi-Fi network for wireless debugging after the first USB pairing).

## Automated verification (run before every build)

```bash
npx jest --runInBand
npm run typecheck
npx expo-doctor
```

`npm test` is the same Jest command (`jest --runInBand`). `npm run typecheck`
is `tsc --noEmit`. There is no `lint` script. All three commands above must
exit `0` before proceeding. These are fast, non-destructive, and don't
require the device — run them first so a build attempt never wastes time on a
codebase that wouldn't have passed CI anyway. Automated tests are not a
substitute for the device pass below, and they are not proof that a backup
reached iCloud or that restore was exercised on a phone.

## Feature regression pass on the iPhone

Use at least one active cycle and two finished cycles (one completed and one
ended early). Test local-date boundaries near midnight only when it is practical
to do so; never change the phone's timezone while the app is open.

### Historical corrections

- Open an elapsed calendar day from Home and confirm History selects that day.
- Add an activity with an explicit date and time, edit its practice/time/duration,
  then delete it. Home and every History filter must reflect the effective state.
- Confirm Previous/Next cannot move outside the selected cycle or into the future.

### Practice membership

- Add a practice from Settings and confirm it appears on Home today but not on
  earlier History days. Stop a different pre-existing practice and confirm it
  disappears from current logging while earlier logs remain editable.
- Confirm the add/stop boundary week says **Partial week** and does not count the
  partial practice toward targets met or remaining totals.
- Attempt to stop the final active practice and confirm the app requires adding
  another practice or ending the cycle.

### Home dashboard

- Check sparse, in-progress, target-met, over-target, count-only, and partial-week
  states. Sessions/minutes remaining and the recent seven-day rhythm must remain
  understandable without relying on color.
- Quick-log one practice, then undo it. Weekly totals, practice progress, rhythm,
  and calendar intensity must each refresh once in both directions.
- Repeat the visual check with a large Dynamic Type setting and VoiceOver enabled.

### Archive and repeat

- Switch among active, completed, and early-ended cycles. Day/Week/Cycle bounds,
  summaries, and correction tools must all switch together without changing the
  active cycle.
- Repeat a finished cycle, edit its name/duration/practices, and cancel once to
  confirm no row is written. Then complete setup and confirm the new cycle/goals
  have fresh identities and no copied sessions, revisions, membership dates, or
  reminder settings.
- With an active cycle present, open Repeat cycle and confirm setup can be
  reviewed but Start explains the active-cycle conflict without writing.

### Cycle wrap-up

- End a cycle early from Settings and confirm the wrap-up screen opens.
- From Home's completed state, open **View wrap-up**. From History on a
  finished cycle, open **View wrap-up** again after another cycle is active.
- Confirm **Back up data** on wrap-up can create a snapshot but does not
  offer check or restore. **Repeat cycle** prefills setup; **See full
  activity** opens History for that cycle.

### Backup and restore

Follow [owner-backup-runbook.md](owner-backup-runbook.md) rather than
inventing a shorter path. On this phone:

- Create a backup from Settings, save it to iCloud Drive (not On My iPhone),
  and confirm Settings records a last-backup time while still saying that
  completing the share sheet is not proof iCloud has the file.
- Use **Check a backup file** on that copy. Confirm Hexis does not mark it
  verified.
- A clean-install restore is a destructive drill. Only run it against
  disposable data, and only after the Files app shows the iCloud copy. Jest
  backup suites passing is not this drill.

### Weight

- Log today's weight, update it, add an earlier day from the modal, and
  delete an entry. Weekly and monthly averages must follow recorded days only.
- Toggle kg/lb and confirm the input and displayed values agree. The unit
  control is on the Weight tab, not in Settings.

### Appearance

- Put the phone in dark mode and confirm Hexis stays light: tab bar, modal
  headers, alerts, and the date picker. Dark mode is unsupported; a dark
  system appearance must not produce dark chrome under near-black text.

## Generate (or refresh) the native iOS project

```bash
npx expo prebuild --platform ios
```

This is idempotent and safe to re-run at any time — it regenerates the `ios/`
directory from `app.json` and the installed Expo config plugins. Re-run it
whenever a plugin, native dependency, or `app.json` native config changes
(e.g. after adding a package via `npx expo install`).

## Open the workspace and configure signing (first time, or after prebuild regenerates the project)

1. Open `ios/Hexis.xcworkspace` in Xcode — **not** the `.xcodeproj` file.
2. Select the `Hexis` target in the project navigator, then the **Signing &
   Capabilities** tab.
3. Under **Team**, choose the free Apple ID added above. Xcode will
   auto-generate a personal development signing certificate and provisioning
   profile the first time.
4. If Xcode reports a bundle identifier conflict, it means someone else has
   already registered that identifier with your Apple ID elsewhere — change
   `expo.ios.bundleIdentifier` in `app.json`, re-run `npx expo prebuild
   --platform ios`, and redo signing.

## Connect the iPhone and enable Developer Mode

1. Connect the iPhone via USB and tap **Trust This Computer** on the device
   if prompted.
2. In Xcode's device list (**Window → Devices and Simulators**), confirm the
   iPhone appears and is "Connected" (or "Connected (wireless)" once wireless
   debugging is enabled from the same screen — do this now if you want to
   skip USB on future runs).
3. On first install of a free-signed app, iOS will refuse to launch it until
   **Developer Mode** is enabled: **Settings → Privacy & Security →
   Developer Mode → On**, then let the phone restart when prompted.

## Build and install

```bash
npx expo run:ios --device
```

Select the connected iPhone when prompted if more than one destination is
available. This builds a Debug configuration, installs it directly over USB
or Wi-Fi, and launches Metro for Fast Refresh — the same development loop
used throughout this project, just running as a real installed app instead
of inside Expo Go.

The first launch on a new phone (or after Developer Mode was just enabled)
may require one more manual trust step: **Settings → General → VPN & Device
Management → [your Apple ID] → Trust**.

## Known limitations under free provisioning

- **7-day expiration.** A free-Apple-ID signing certificate makes the app
  stop launching 7 days after install. There is no workaround short of a
  paid Apple Developer Program membership — when it expires, just re-run
  `npx expo run:ios --device` (no need to redo signing setup unless Xcode
  itself asks).
- **No TestFlight / App Store Connect.** This runbook only ever installs on
  a device physically connected to this Mac. Distributing to another
  person's phone, or through TestFlight, requires enrolling in the paid
  Apple Developer Program — out of scope for v1.
- **No push notifications.** Free provisioning cannot enable the Push
  Notifications capability. This does not affect Hexis: the daily reminder
  (`src/features/reminders/reminderService.ts`) schedules a **local**
  notification via `expo-notifications`, which works fully under free
  provisioning with no entitlement required.

## Re-running after the 7-day expiration

No new setup is needed in the common case — just:

```bash
npx expo run:ios --device
```

Only redo the signing steps above if Xcode reports a certificate or
provisioning-profile error (e.g. after Xcode itself was updated, or the
signing certificate was revoked).
