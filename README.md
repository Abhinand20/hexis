# Hexis

A local-first iPhone app for building consistency through finite focus cycles. Instead of an endless habit list, you commit to a small group of practices for 30, 60, or 90 days, log real sessions, and see the week without turning missed days into overdue tasks.

There is no account and no cloud sync. Everything lives in a SQLite file on the phone. A backup is a snapshot you save yourself — typically to iCloud Drive through the system share sheet. Completing that sheet is not proof iCloud has the file.

## What it does

Four tabs: **Home**, **History**, **Weight**, **Settings**.

- Start a 30/60/90-day cycle from templates or custom practices.
- Log a session from Home with one tap (circle) or pick a duration (ellipsis).
- Review Day / Week / Cycle across the archive. Corrections are append-only.
- Record one body weight per local date, with weekly and monthly averages. Weight is not tied to a cycle.
- Optional daily reminder. Early end, wrap-up, and repeat-cycle from a finished commitment.
- Backup and replace-only restore from Settings (and a backup prompt on wrap-up).

The interface is light-only. Dark mode is unsupported.

Product, data model, and scope: [docs/project-overview.md](docs/project-overview.md). Index of living vs historical docs: [docs/README.md](docs/README.md).

## Requirements

- macOS with Xcode
- A free Apple ID (no paid Developer Program membership)
- An iPhone on iOS 26+

This is not a TestFlight or App Store build. A free-Apple-ID install expires after **7 days**. Renew by installing over the same app; deleting Hexis wipes its data.

## Checks

```bash
npx jest --runInBand
npm run typecheck
npx expo-doctor
```

There is no lint script. Automated tests are not a device restore drill.

## Install on a personal iPhone

Follow [docs/release-checklist.md](docs/release-checklist.md). In short:

```bash
npx expo run:ios --device
```

That produces a Debug binary, so **Reset all data** is visible in Settings. Do not use it on a phone whose history you care about.

## Backup

Weekly procedure: [docs/owner-backup-runbook.md](docs/owner-backup-runbook.md).

On first install, before the data matters: create a backup, confirm the file in Files under iCloud Drive, restore it, and check that sessions and weights come back. Restore has been proven under Jest, not yet as a hardware drill.

## Out of scope

Accounts, HealthKit, widgets, Apple Watch, dark mode, Android/web, coaching, and social features.
