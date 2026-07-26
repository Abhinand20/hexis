import type { SQLiteDatabase } from "expo-sqlite";

import { openDatabase } from "../../src/db/client";
import {
  DEFAULT_REMINDER,
  clearDailyReminder,
  loadReminderSettings,
  saveReminderSettings,
  setDailyReminder,
  type DailyReminder,
} from "../../src/features/reminders/reminderService";

const mockRequestPermissionsAsync = jest.fn();
const mockScheduleNotificationAsync = jest.fn();
const mockCancelScheduledNotificationAsync = jest.fn();

jest.mock("expo-notifications", () => ({
  requestPermissionsAsync: (...args: unknown[]) =>
    mockRequestPermissionsAsync(...args),
  scheduleNotificationAsync: (...args: unknown[]) =>
    mockScheduleNotificationAsync(...args),
  cancelScheduledNotificationAsync: (...args: unknown[]) =>
    mockCancelScheduledNotificationAsync(...args),
  SchedulableTriggerInputTypes: { DAILY: "daily" },
}));

const enabledReminder: DailyReminder = {
  enabled: true,
  hour: 20,
  minute: 0,
  notificationIdentifier: null,
};

function mockNotificationPermission(status: string) {
  mockRequestPermissionsAsync.mockResolvedValue({ status });
}

describe("setDailyReminder / clearDailyReminder", () => {
  beforeEach(() => {
    mockRequestPermissionsAsync.mockReset();
    mockScheduleNotificationAsync.mockReset();
    mockCancelScheduledNotificationAsync.mockReset();
    mockCancelScheduledNotificationAsync.mockResolvedValue(undefined);
    mockScheduleNotificationAsync.mockResolvedValue("notif-1");
  });

  it("does not schedule when notification permission is denied", async () => {
    mockNotificationPermission("denied");
    await expect(setDailyReminder(enabledReminder)).resolves.toMatchObject({
      enabled: false,
      notificationIdentifier: null,
    });
  });

  it("schedules a daily notification when permission is granted", async () => {
    mockNotificationPermission("granted");

    await expect(setDailyReminder(enabledReminder)).resolves.toEqual({
      enabled: true,
      hour: 20,
      minute: 0,
      notificationIdentifier: "notif-1",
    });

    expect(mockScheduleNotificationAsync).toHaveBeenCalledWith({
      content: {
        title: "Hexis",
        body: "Time to check in on today's practices",
      },
      trigger: {
        type: "daily",
        hour: 20,
        minute: 0,
      },
    });
  });

  it("disabling cancels a previous identifier and clears the schedule", async () => {
    await expect(
      setDailyReminder({
        enabled: false,
        hour: 20,
        minute: 0,
        notificationIdentifier: "old-id",
      }),
    ).resolves.toMatchObject({
      enabled: false,
      notificationIdentifier: null,
    });

    expect(mockCancelScheduledNotificationAsync).toHaveBeenCalledWith("old-id");
    expect(mockRequestPermissionsAsync).not.toHaveBeenCalled();
    expect(mockScheduleNotificationAsync).not.toHaveBeenCalled();
  });

  it("re-enabling cancels an existing identifier before scheduling a new one", async () => {
    mockNotificationPermission("granted");
    mockScheduleNotificationAsync.mockResolvedValue("notif-2");

    await setDailyReminder({
      enabled: true,
      hour: 9,
      minute: 30,
      notificationIdentifier: "old-id",
    });

    const cancelOrder =
      mockCancelScheduledNotificationAsync.mock.invocationCallOrder[0];
    const scheduleOrder =
      mockScheduleNotificationAsync.mock.invocationCallOrder[0];
    expect(cancelOrder).toBeLessThan(scheduleOrder);
    expect(mockCancelScheduledNotificationAsync).toHaveBeenCalledWith("old-id");
    expect(mockScheduleNotificationAsync).toHaveBeenCalled();
  });

  it("clearDailyReminder no-ops when identifier is null", async () => {
    await clearDailyReminder(null);
    expect(mockCancelScheduledNotificationAsync).not.toHaveBeenCalled();
  });

  it("clearDailyReminder cancels a non-null identifier", async () => {
    await clearDailyReminder("id-1");
    expect(mockCancelScheduledNotificationAsync).toHaveBeenCalledWith("id-1");
  });
});

describe("loadReminderSettings / saveReminderSettings", () => {
  let db: SQLiteDatabase;

  beforeEach(async () => {
    db = await openDatabase(":memory:");
  });

  it("returns DEFAULT_REMINDER when no row exists", async () => {
    await expect(loadReminderSettings(db)).resolves.toEqual(DEFAULT_REMINDER);
  });

  it("round-trips saved reminder settings", async () => {
    const reminder: DailyReminder = {
      enabled: true,
      hour: 7,
      minute: 15,
      notificationIdentifier: "notif-abc",
    };

    await saveReminderSettings(db, reminder);
    await expect(loadReminderSettings(db)).resolves.toEqual(reminder);
  });

  it("updates the singleton row on a second save", async () => {
    await saveReminderSettings(db, {
      enabled: true,
      hour: 8,
      minute: 0,
      notificationIdentifier: "first",
    });
    await saveReminderSettings(db, {
      enabled: false,
      hour: 21,
      minute: 45,
      notificationIdentifier: null,
    });

    await expect(loadReminderSettings(db)).resolves.toEqual({
      enabled: false,
      hour: 21,
      minute: 45,
      notificationIdentifier: null,
    });

    const rows = await db.getAllAsync<{ id: number }>(
      "SELECT id FROM reminder_settings",
    );
    expect(rows).toHaveLength(1);
  });
});
