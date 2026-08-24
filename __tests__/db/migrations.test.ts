import { openDatabaseAsync, type SQLiteDatabase } from "expo-sqlite";

import { runMigrations } from "../../src/db/migrations";
import {
  SCHEMA_V1,
  SCHEMA_V2,
  SCHEMA_V3,
  SCHEMA_V4,
} from "../../src/db/schema";

async function createVersionTwoDatabase(): Promise<SQLiteDatabase> {
  const db = await openDatabaseAsync(":memory:");
  for (const statement of [...SCHEMA_V1, ...SCHEMA_V2]) {
    await db.execAsync(statement);
  }
  await db.execAsync("PRAGMA user_version = 2;");
  return db;
}

it("backfills V2 session start timestamps from their creation timestamps", async () => {
  const db = await createVersionTwoDatabase();
  const createdAt = "2026-07-24T19:42:00.000Z";

  await db.runAsync(
    `INSERT INTO cycles (
      id, name, start_date, duration_days, end_date, status, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [
      "cycle-1",
      "Summer Focus",
      "2026-07-01",
      30,
      "2026-07-30",
      "active",
      "2026-07-01T00:00:00.000Z",
    ],
  );
  await db.runAsync(
    `INSERT INTO cycle_goals (
      id, cycle_id, name, cadence, weekly_target_count,
      expected_duration_minutes, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [
      "goal-1",
      "cycle-1",
      "Strength",
      "weekly",
      3,
      60,
      "2026-07-01T00:00:00.000Z",
    ],
  );
  await db.runAsync(
    `INSERT INTO session_logs (
      id, cycle_goal_id, local_date, duration_minutes, created_at
    ) VALUES (?, ?, ?, ?, ?)`,
    ["log-1", "goal-1", "2026-07-24", 60, createdAt],
  );

  await runMigrations(db);

  expect(await db.getFirstAsync("PRAGMA user_version")).toEqual({
    user_version: 5,
  });
  expect(
    await db.getFirstAsync(
      "SELECT local_date, started_at, created_at FROM session_logs WHERE id = ?",
      ["log-1"],
    ),
  ).toEqual({
    local_date: "2026-07-24",
    started_at: createdAt,
    created_at: createdAt,
  });
  expect(
    await db.getFirstAsync(
      "SELECT COUNT(*) AS count FROM session_log_revisions",
    ),
  ).toEqual({ count: 0 });
  expect(
    await db.getFirstAsync(
      `SELECT active_from_date, inactive_from_date
       FROM cycle_goals WHERE id = ?`,
      ["goal-1"],
    ),
  ).toEqual({
    active_from_date: "2026-07-01",
    inactive_from_date: null,
  });
});

it("adds revision storage without changing existing V3 session facts", async () => {
  const db = await openDatabaseAsync(":memory:");
  for (const statement of [...SCHEMA_V1, ...SCHEMA_V2, ...SCHEMA_V3]) {
    await db.execAsync(statement);
  }
  await db.execAsync("PRAGMA user_version = 3;");

  await db.runAsync(
    `INSERT INTO cycles (
      id, name, start_date, duration_days, end_date, status, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [
      "cycle-v3",
      "Existing cycle",
      "2026-07-01",
      30,
      "2026-07-30",
      "completed",
      "2026-07-01T00:00:00.000Z",
    ],
  );
  await db.runAsync(
    `INSERT INTO cycle_goals (
      id, cycle_id, name, cadence, weekly_target_count,
      expected_duration_minutes, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [
      "goal-v3",
      "cycle-v3",
      "Strength",
      "weekly",
      3,
      45,
      "2026-07-01T00:00:00.000Z",
    ],
  );
  await db.runAsync(
    `INSERT INTO session_logs (
      id, cycle_goal_id, local_date, started_at, duration_minutes, created_at
    ) VALUES (?, ?, ?, ?, ?, ?)`,
    [
      "log-v3",
      "goal-v3",
      "2026-07-10",
      "2026-07-10T16:30:00.000Z",
      45,
      "2026-07-10T16:31:00.000Z",
    ],
  );

  await runMigrations(db);

  expect(await db.getFirstAsync("PRAGMA user_version")).toEqual({
    user_version: 5,
  });
  expect(
    await db.getFirstAsync(
      `SELECT id, cycle_goal_id, local_date, started_at,
              duration_minutes, created_at
       FROM session_logs WHERE id = ?`,
      ["log-v3"],
    ),
  ).toEqual({
    id: "log-v3",
    cycle_goal_id: "goal-v3",
    local_date: "2026-07-10",
    started_at: "2026-07-10T16:30:00.000Z",
    duration_minutes: 45,
    created_at: "2026-07-10T16:31:00.000Z",
  });
  expect(
    await db.getFirstAsync<{ sql: string }>(
      "SELECT sql FROM sqlite_master WHERE type = 'table' AND name = ?",
      ["session_log_revisions"],
    ),
  ).toEqual(
    expect.objectContaining({ sql: expect.stringContaining("AUTOINCREMENT") }),
  );
  expect(
    await db.getFirstAsync(
      `SELECT active_from_date, inactive_from_date
       FROM cycle_goals WHERE id = ?`,
      ["goal-v3"],
    ),
  ).toEqual({
    active_from_date: "2026-07-01",
    inactive_from_date: null,
  });
});

it("upgrades a real V4 database and backfills membership without changing revisions", async () => {
  const db = await openDatabaseAsync(":memory:");
  for (const statement of [
    ...SCHEMA_V1,
    ...SCHEMA_V2,
    ...SCHEMA_V3,
    ...SCHEMA_V4,
  ]) {
    await db.execAsync(statement);
  }
  await db.execAsync("PRAGMA user_version = 4;");
  await db.runAsync(
    `INSERT INTO cycles (
      id, name, start_date, duration_days, end_date, status, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [
      "cycle-v4",
      "Existing cycle",
      "2026-08-01",
      30,
      "2026-08-30",
      "active",
      "2026-08-01T00:00:00.000Z",
    ],
  );
  await db.runAsync(
    `INSERT INTO cycle_goals (
      id, cycle_id, name, cadence, weekly_target_count,
      expected_duration_minutes, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [
      "goal-v4",
      "cycle-v4",
      "Read",
      "daily",
      7,
      20,
      "2026-08-01T00:00:00.000Z",
    ],
  );
  await db.runAsync(
    `INSERT INTO goal_revisions (
      id, cycle_goal_id, effective_date, name, cadence,
      weekly_target_count, expected_duration_minutes, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      "revision-v4",
      "goal-v4",
      "2026-08-10",
      "Read fiction",
      "daily",
      7,
      25,
      "2026-08-10T00:00:00.000Z",
    ],
  );

  await runMigrations(db);

  expect(await db.getFirstAsync("PRAGMA user_version")).toEqual({
    user_version: 5,
  });
  expect(
    await db.getFirstAsync(
      `SELECT active_from_date, inactive_from_date
       FROM cycle_goals WHERE id = ?`,
      ["goal-v4"],
    ),
  ).toEqual({
    active_from_date: "2026-08-01",
    inactive_from_date: null,
  });
  expect(
    await db.getFirstAsync<{ count: number }>(
      "SELECT COUNT(*) AS count FROM goal_revisions WHERE id = ?",
      ["revision-v4"],
    ),
  ).toEqual({ count: 1 });
  expect(
    await db.getFirstAsync<{ notnull: number }>(
      `SELECT "notnull" AS "notnull"
       FROM pragma_table_info('cycle_goals')
       WHERE name = 'active_from_date'`,
    ),
  ).toEqual({ notnull: 1 });
  expect(
    await db.getFirstAsync<{ table: string }>(
      `SELECT "table" AS "table"
       FROM pragma_foreign_key_list('cycle_goals')
       WHERE "from" = 'cycle_id'`,
    ),
  ).toEqual({ table: "cycles" });
});
