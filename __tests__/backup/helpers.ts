import { Directory } from "expo-file-system";
import type { SQLiteDatabase } from "expo-sqlite";

import { openDatabase } from "../../src/db/client";
import {
  getBackupStatusFile,
  overrideBackupDirectoryForTests,
} from "../../src/features/backup/data/paths";
import { resetPreRestoreSessionForTests } from "../../src/features/backup/data/snapshot";
import { resetBackupMutexForTests } from "../../src/features/backup/data/backupMutex";
import { LIVE_TABLES, TABLE_COLUMNS } from "../../src/features/backup/data/tables";
import { createCycleRepository } from "../../src/features/cycles/data/cycleRepository";
import { createGoalRepository } from "../../src/features/goals/data/goalRepository";
import { createSessionRepository } from "../../src/features/logging/data/sessionRepository";
import { createCycleInput } from "../../src/test/factories";

export async function openLiveDatabase(): Promise<SQLiteDatabase> {
  return openDatabase(":memory:");
}

export function makeBackupTempDir(): string {
  const dir = nodeFs().mkdtempSync(nodePath().join(nodeOs().tmpdir(), "hexis-backup-"));
  overrideBackupDirectoryForTests(new Directory(`file://${dir}`), dir);
  return dir;
}

export function cleanupBackupTempDir(dir: string): void {
  overrideBackupDirectoryForTests(null);
  resetPreRestoreSessionForTests();
  resetBackupMutexForTests();
  const statusFile = getBackupStatusFile();
  if (statusFile.exists) {
    statusFile.delete();
  }
  nodeFs().rmSync(dir, { recursive: true, force: true });
}

function nodeFs(): {
  mkdtempSync(prefix: string): string;
  rmSync(path: string, options: { recursive: boolean; force: boolean }): void;
} {
  return require("fs") as {
    mkdtempSync(prefix: string): string;
    rmSync(path: string, options: { recursive: boolean; force: boolean }): void;
  };
}

function nodeOs(): { tmpdir(): string } {
  return require("os") as { tmpdir(): string };
}

function nodePath(): { join(...parts: string[]): string } {
  return require("path") as { join(...parts: string[]): string };
}

export type RawTables = Record<string, Record<string, unknown>[]>;

export async function dumpTables(db: SQLiteDatabase): Promise<RawTables> {
  const dumped: RawTables = {};
  for (const table of LIVE_TABLES) {
    const columns = TABLE_COLUMNS[table].join(", ");
    const order =
      table === "session_log_revisions"
        ? "sequence"
        : table === "reminder_settings"
          ? "id"
          : "id";
    dumped[table] = await db.getAllAsync(
      `SELECT ${columns} FROM ${table} ORDER BY ${order}`,
    );
  }
  return dumped;
}

export async function populateRepresentativeData(
  db: SQLiteDatabase,
): Promise<{
  activeCycleId: string;
  completedCycleId: string;
  earlyCycleId: string;
  sessionId: string;
}> {
  const cycles = createCycleRepository(db);
  const goals = createGoalRepository(db);
  const sessions = createSessionRepository(db);

  const completed = await cycles.createCycle(
    createCycleInput({
      name: "Completed",
      startDate: "2026-05-01",
    }),
  );
  const [write] = await goals.listForCycle(completed.id);
  const completedSession = await sessions.create({
    cycleGoalId: write.id,
    startedAt: "2026-05-02T16:00:00.000Z",
    durationMinutes: 30,
  });
  await sessions.correct(completedSession.id, {
    cycleGoalId: write.id,
    startedAt: "2026-05-02T16:10:00.000Z",
    durationMinutes: 25,
  });
  await db.runAsync(
    "UPDATE cycles SET status = 'completed' WHERE id = ?",
    completed.id,
  );

  const early = await cycles.createCycle(
    createCycleInput({
      name: "Early",
      startDate: "2026-06-01",
    }),
  );
  const [earlyGoal] = await goals.listForCycle(early.id);
  await sessions.create({
    cycleGoalId: earlyGoal.id,
    startedAt: "2026-06-02T12:00:00.000Z",
    durationMinutes: null,
  });
  await cycles.endCycleEarly(early.id, "2026-06-10");

  const active = await cycles.createCycle(
    createCycleInput({
      name: "Active",
      startDate: "2026-07-01",
    }),
  );
  const listed = await goals.listForCycle(active.id);
  await db.runAsync(
    "UPDATE cycle_goals SET inactive_from_date = ? WHERE id = ?",
    "2026-07-10",
    listed[1].id,
  );
  await db.runAsync(
    `INSERT INTO cycle_goals (
      id, cycle_id, name, cadence, weekly_target_count,
      expected_duration_minutes, created_at, active_from_date, inactive_from_date
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      "goal_swim",
      active.id,
      "Swim",
      "weekly",
      2,
      40,
      "2026-07-12T00:00:00.000Z",
      "2026-07-12",
      null,
    ],
  );
  await goals.createRevision({
    cycleGoalId: listed[0].id,
    effectiveDate: "2026-07-08",
    name: "Write mornings",
    cadence: "daily",
    weeklyTargetCount: 4,
    expectedDurationMinutes: 20,
  });
  const liveSession = await sessions.create({
    cycleGoalId: listed[0].id,
    startedAt: "2026-07-03T15:00:00.000Z",
    durationMinutes: 15,
  });
  await sessions.correct(liveSession.id, {
    cycleGoalId: listed[0].id,
    startedAt: "2026-07-03T15:05:00.000Z",
    durationMinutes: 18,
  });
  await sessions.deleteById(liveSession.id);
  const moved = await sessions.create({
    cycleGoalId: listed[2].id,
    startedAt: "2026-07-04T09:00:00.000Z",
    durationMinutes: 10,
  });
  await sessions.correct(moved.id, {
    cycleGoalId: listed[3].id,
    startedAt: "2026-07-04T09:30:00.000Z",
    durationMinutes: 12,
  });

  await db.runAsync(
    `INSERT INTO reminder_settings (id, enabled, hour, minute, notification_identifier)
     VALUES (1, 1, 7, 30, 'notif-device')
     ON CONFLICT(id) DO UPDATE SET
       enabled = excluded.enabled,
       hour = excluded.hour,
       minute = excluded.minute,
       notification_identifier = excluded.notification_identifier`,
  );

  return {
    activeCycleId: active.id,
    completedCycleId: completed.id,
    earlyCycleId: early.id,
    sessionId: moved.id,
  };
}

export async function attachSnapshot(
  db: SQLiteDatabase,
  absolutePath: string,
  alias = "snap",
): Promise<void> {
  await db.execAsync(
    `ATTACH DATABASE '${absolutePath.replaceAll("'", "''")}' AS ${alias}`,
  );
}

describe("backup test helpers", () => {
  it("load", () => {
    expect(typeof makeBackupTempDir).toBe("function");
  });
});

