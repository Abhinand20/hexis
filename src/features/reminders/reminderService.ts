import type { SQLiteDatabase } from "expo-sqlite";
import * as Notifications from "expo-notifications";

export type DailyReminder = {
  enabled: boolean;
  hour: number;
  minute: number;
  notificationIdentifier: string | null;
};

export const DEFAULT_REMINDER: DailyReminder = {
  enabled: false,
  hour: 20,
  minute: 0,
  notificationIdentifier: null,
};

export async function clearDailyReminder(
  identifier: string | null,
): Promise<void> {
  if (identifier !== null) {
    await Notifications.cancelScheduledNotificationAsync(identifier);
  }
}

export async function setDailyReminder(
  input: DailyReminder,
): Promise<DailyReminder> {
  if (input.notificationIdentifier !== null) {
    await clearDailyReminder(input.notificationIdentifier);
  }

  if (!input.enabled) {
    return {
      ...input,
      enabled: false,
      notificationIdentifier: null,
    };
  }

  const { status } = await Notifications.requestPermissionsAsync();
  if (status !== "granted") {
    return {
      ...input,
      enabled: false,
      notificationIdentifier: null,
    };
  }

  const identifier = await Notifications.scheduleNotificationAsync({
    content: {
      title: "Hexis",
      body: "Time to check in on today's practices",
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.DAILY,
      hour: input.hour,
      minute: input.minute,
    },
  });

  return {
    enabled: true,
    hour: input.hour,
    minute: input.minute,
    notificationIdentifier: identifier,
  };
}

type ReminderRow = {
  id: number;
  enabled: number;
  hour: number;
  minute: number;
  notification_identifier: string | null;
};

export async function loadReminderSettings(
  db: SQLiteDatabase,
): Promise<DailyReminder> {
  const row = await db.getFirstAsync<ReminderRow>(
    "SELECT * FROM reminder_settings WHERE id = 1",
  );

  if (!row) {
    return DEFAULT_REMINDER;
  }

  return {
    enabled: row.enabled === 1,
    hour: row.hour,
    minute: row.minute,
    notificationIdentifier: row.notification_identifier,
  };
}

export async function saveReminderSettings(
  db: SQLiteDatabase,
  reminder: DailyReminder,
): Promise<void> {
  await db.runAsync(
    `INSERT INTO reminder_settings (id, enabled, hour, minute, notification_identifier)
VALUES (1, ?, ?, ?, ?)
ON CONFLICT(id) DO UPDATE SET
  enabled = excluded.enabled,
  hour = excluded.hour,
  minute = excluded.minute,
  notification_identifier = excluded.notification_identifier`,
    reminder.enabled ? 1 : 0,
    reminder.hour,
    reminder.minute,
    reminder.notificationIdentifier,
  );
}
