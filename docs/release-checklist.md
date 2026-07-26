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
npx tsc --noEmit
npx expo-doctor
```

All three must exit `0` before proceeding. These are fast, non-destructive,
and don't require the device — run them first so a build attempt never wastes
time on a codebase that wouldn't have passed CI anyway.

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
