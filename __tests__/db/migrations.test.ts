import { openDatabaseAsync, type SQLiteDatabase } from "expo-sqlite";

import { runMigrations } from "../../src/db/migrations";
import { SCHEMA_V1, SCHEMA_V2 } from "../../src/db/schema";

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
    user_version: 3,
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
});
