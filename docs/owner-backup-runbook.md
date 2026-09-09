# Owner runbook: Hexis backup and restore

Hexis stores practice history in a local SQLite file on this iPhone. That file does not survive deleting the app, resetting the phone, or losing the device. A backup is one `.db` snapshot that **you** save to iCloud Drive.

Hexis cannot see iCloud. Completing the share sheet is not proof that the file arrived or finished uploading. Status is only “last backup created” plus whether there are newer rows since then. There is no verified/unverified state.

## Weekly backup

1. Open **Settings**.
2. Under **Data & backup**, read the last-backup line. If it says there is no backup, or the copy is more than a week old, make one.
3. Tap **Create backup**.
4. In the share sheet, choose **Save to Files**.
5. Put the file in **iCloud Drive**, not **On My iPhone**. A copy that stays only on this phone will not survive losing it.
6. Confirm in the Files app that `hexis-backup-YYYY-MM-DD.db` is under iCloud Drive. Wait until it is fully downloaded (not a cloud outline) if you want to check it immediately.

The file is unencrypted personal data. Keep the folder private.

## Check a saved copy

1. In Settings, tap **Check a backup file**.
2. Pick the `.db` from iCloud Drive. If iOS has not downloaded it yet, wait and try again.
3. Hexis reports creation time, app/schema version, cycle and session counts, and whether an active cycle is inside. This does not mark the file “verified.”

## Recover after deleting or resetting the phone

Recovery only reaches as far as the last snapshot you actually saved. Anything logged after that is gone.

1. Install Hexis. A clean install has no history and no backup timestamp.
2. Open Settings → **Restore backup** (or **Restore from backup** if Hexis cannot open its database).
3. Pick the iCloud Drive copy. Read the preview. Restore **replaces** everything on this phone; it does not merge.
4. Confirm. If reminder scheduling fails, the history is still restored; turn the reminder off and on under Settings if you want notifications.
5. Log one correction. If that succeeds, sequence continuity is intact.

A replacement device is the same procedure: install Hexis, restore the iCloud copy. You do not need the old phone.

## Back up before an upgrade, deletion, or signing renewal

Take an iCloud Drive backup first. For Apple ID signing renewal, **install over the same app**. Do not delete Hexis and reinstall unless you have already restored from that backup successfully.

## “On My iPhone” is not enough

Files saved only under On My iPhone live in this phone’s sandbox. They disappear with the app or the device. iCloud Drive is the copy that survives.

## When Hexis cannot open its database

The startup screen offers **Retry** and **Restore from backup**. Hexis will not wipe the file. A damaged `hexis.db` is renamed aside (`hexis-unreadable-…`) and restore writes into a new file. Restore from an iCloud copy if Retry still fails.

A local pre-restore snapshot is insurance against a restore bug on a still-working phone. It is not phone-loss protection.

## Freshness limits

“You have changes since then” looks at row creation times. Ending a cycle early updates status without changing `created_at`, so that lifecycle-only edit may not appear as a change. When in doubt, take another backup.
