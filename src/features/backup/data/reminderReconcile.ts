import type { SQLiteDatabase } from "expo-sqlite";
import * as Notifications from "expo-notifications";

import {
  clearDailyReminder,
  loadReminderSettings,
  saveReminderSettings,
  setDailyReminder,
} from "../../reminders/reminderService";

/**
 * Restored `notification_identifier` values belong to another installation.
 * Reconcile against current permission without prompting; report scheduling
 * trouble separately from a successful data restore.
 */
export async function reconcileRemindersAfterRestore(
  db: SQLiteDatabase,
): Promise<string | null> {
  const loaded = await loadReminderSettings(db);
  await clearDailyReminder(loaded.notificationIdentifier);
  const stripped = { ...loaded, notificationIdentifier: null };
  await saveReminderSettings(db, stripped);

  if (!stripped.enabled) {
    return null;
  }

  const permissions = await Notifications.getPermissionsAsync();
  if (permissions.status !== "granted") {
    return "Practice data was restored, but the daily reminder was not rescheduled because notifications are off. Hexis did not ask for permission. You can turn the reminder off and on in Settings when you want to grant access.";
  }

  try {
    const scheduled = await setDailyReminder(stripped);
    await saveReminderSettings(db, scheduled);
    if (!scheduled.enabled || scheduled.notificationIdentifier === null) {
      return "Practice data was restored, but the daily reminder could not be rescheduled.";
    }
    return null;
  } catch {
    return "Practice data was restored, but the daily reminder could not be rescheduled.";
  }
}
