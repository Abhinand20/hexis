import { File } from "expo-file-system";
import {
  openDatabaseAsync,
  type SQLiteDatabase,
} from "expo-sqlite";

import { openDatabase } from "../../src/db/client";
import { SUPPORTED_SCHEMA_VERSION } from "../../src/db/migrations";
import {
  SCHEMA_V1,
  SCHEMA_V2,
  SCHEMA_V3,
  SCHEMA_V4,
} from "../../src/db/schema";
import { MAX_SNAPSHOT_BYTES } from "../../src/features/backup/data/paths";
import { stageAndValidate } from "../../src/features/backup/data/restore";
import { validateSnapshot } from "../../src/features/backup/data/snapshotValidation";
import {
  cleanupBackupTempDir,
  makeBackupTempDir,
  populateRepresentativeData,
} from "./helpers";

describe("validateSnapshot", () => {
  it("accepts a populated current-schema database", async () => {
    const db = await openDatabase(":memory:");
    await populateRepresentativeData(db);
    const { preview, problems } = await validateSnapshot(db);
    expect(problems).toEqual([]);
    expect(preview.schemaVersion).toBe(SUPPORTED_SCHEMA_VERSION);
    expect(preview.cycleCount).toBe(3);
    expect(preview.sessionCount).toBeGreaterThan(0);
    expect(preview.correctionCount).toBeGreaterThan(0);
    expect(preview.weightEntryCount).toBe(0);
    expect(preview.hasActiveCycle).toBe(true);
  });

  it("accepts an empty migrated database", async () => {
    const db = await openDatabase(":memory:");
    const { preview, problems } = await validateSnapshot(db);
    expect(problems).toEqual([]);
    expect(preview.cycleCount).toBe(0);
    expect(preview.weightEntryCount).toBe(0);
    expect(preview.hasActiveCycle).toBe(false);
  });

  it("reports a missing table", async () => {
    const db = await openDatabase(":memory:");
    await db.execAsync("DROP TABLE reminder_settings");
    const { problems } = await validateSnapshot(db);
    expect(problems).toContainEqual({
      kind: "missing_table",
      table: "reminder_settings",
    });
  });

  it("treats an empty sqlite file as not a database", async () => {
    const db = await openDatabaseAsync(":memory:");
    const { problems } = await validateSnapshot(db);
    expect(problems).toContainEqual({ kind: "not_a_database" });
  });

  it("rejects a newer schema version and names both versions", async () => {
    const db = await openDatabase(":memory:");
    await db.execAsync(`PRAGMA user_version = ${SUPPORTED_SCHEMA_VERSION + 3};`);
    const { problems } = await validateSnapshot(db);
    expect(problems).toContainEqual({
      kind: "unsupported_schema_version",
      found: SUPPORTED_SCHEMA_VERSION + 3,
      supported: SUPPORTED_SCHEMA_VERSION,
    });
  });

  it("migrates an older snapshot forward then accepts it", async () => {
    const db = await openDatabaseAsync(":memory:");
    await db.execAsync("PRAGMA foreign_keys = ON;");
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
      `INSERT INTO cycles (id, name, start_date, duration_days, end_date, status, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        "cycle-v4",
        "Legacy",
        "2026-08-01",
        30,
        "2026-08-30",
        "completed",
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
    const { preview, problems } = await validateSnapshot(db);
    expect(problems).toEqual([]);
    expect(preview.schemaVersion).toBe(SUPPORTED_SCHEMA_VERSION);
    expect(preview.cycleCount).toBe(1);
    expect(
      await db.getFirstAsync(
        "SELECT active_from_date FROM cycle_goals WHERE id = 'goal-v4'",
      ),
    ).toEqual({ active_from_date: "2026-08-01" });
  });

  it("rejects two active cycles", async () => {
    const db = await openDatabase(":memory:");
    await db.execAsync("DROP INDEX IF EXISTS cycles_single_active");
    await insertCycle(db, "a", "active");
    await insertCycle(db, "b", "active");
    const { problems } = await validateSnapshot(db);
    expect(problems.some((problem) => problem.kind === "invariant")).toBe(true);
  });

  it("rejects broken references", async () => {
    const db = await openDatabase(":memory:");
    await db.execAsync("PRAGMA foreign_keys = OFF;");
    await db.runAsync(
      `INSERT INTO cycle_goals (
        id, cycle_id, name, cadence, weekly_target_count,
        expected_duration_minutes, created_at, active_from_date, inactive_from_date
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        "orphan",
        "missing",
        "Orphan",
        "weekly",
        1,
        null,
        "2026-08-01T00:00:00.000Z",
        "2026-08-01",
        null,
      ],
    );
    await db.execAsync("PRAGMA foreign_keys = ON;");
    const { problems } = await validateSnapshot(db);
    expect(
      problems.some(
        (problem) =>
          problem.kind === "foreign_key" ||
          (problem.kind === "invariant" && problem.detail.includes("cycle_goals")),
      ),
    ).toBe(true);
  });

  it("rejects unparseable dates", async () => {
    const db = await openDatabase(":memory:");
    await insertCycle(db, "c1", "completed");
    await db.runAsync("UPDATE cycles SET start_date = '2026/07/01' WHERE id = 'c1'");
    const { problems } = await validateSnapshot(db);
    expect(
      problems.some(
        (problem) =>
          problem.kind === "invariant" && problem.detail.includes("start_date"),
      ),
    ).toBe(true);
  });

  it("rejects a weight date that is not YYYY-MM-DD", async () => {
    const db = await openDatabase(":memory:");
    await db.runAsync(
      `INSERT INTO daily_weights (
        id, local_date, weight_grams, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?)`,
      [
        "weight-bad-date",
        "2026/08/01",
        70000,
        "2026-08-01T12:00:00.000Z",
        "2026-08-01T12:00:00.000Z",
      ],
    );
    const { problems } = await validateSnapshot(db);
    expect(
      problems.some(
        (problem) =>
          problem.kind === "invariant" &&
          problem.detail.includes("daily_weights.local_date"),
      ),
    ).toBe(true);
  });

  it("rejects a non-positive weight in grams", async () => {
    const db = await openDatabase(":memory:");
    await db.execAsync("DROP TABLE daily_weights");
    await db.execAsync(
      `CREATE TABLE daily_weights (
        id TEXT PRIMARY KEY NOT NULL,
        local_date TEXT NOT NULL,
        weight_grams INTEGER NOT NULL,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      )`,
    );
    await db.runAsync(
      `INSERT INTO daily_weights (
        id, local_date, weight_grams, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?)`,
      [
        "weight-zero",
        "2026-08-01",
        0,
        "2026-08-01T12:00:00.000Z",
        "2026-08-01T12:00:00.000Z",
      ],
    );
    const { problems } = await validateSnapshot(db);
    expect(
      problems.some(
        (problem) =>
          problem.kind === "invariant" && problem.detail.includes("grams"),
      ),
    ).toBe(true);
  });

  it("rejects two weight entries for the same date", async () => {
    const db = await openDatabase(":memory:");
    await db.execAsync("DROP INDEX IF EXISTS daily_weights_local_date");
    await db.runAsync(
      `INSERT INTO daily_weights (
        id, local_date, weight_grams, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?)`,
      [
        "weight-a",
        "2026-08-01",
        70000,
        "2026-08-01T12:00:00.000Z",
        "2026-08-01T12:00:00.000Z",
      ],
    );
    await db.runAsync(
      `INSERT INTO daily_weights (
        id, local_date, weight_grams, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?)`,
      [
        "weight-b",
        "2026-08-01",
        71000,
        "2026-08-01T13:00:00.000Z",
        "2026-08-01T13:00:00.000Z",
      ],
    );
    const { problems } = await validateSnapshot(db);
    expect(
      problems.some(
        (problem) =>
          problem.kind === "invariant" &&
          problem.detail.includes("same date"),
      ),
    ).toBe(true);
  });

  it("rejects weight preferences that are not the single allowed row", async () => {
    const db = await openDatabase(":memory:");
    await db.execAsync("DROP TABLE weight_preferences");
    await db.execAsync(
      `CREATE TABLE weight_preferences (
        id INTEGER PRIMARY KEY,
        unit TEXT NOT NULL
      )`,
    );
    await db.runAsync(
      "INSERT INTO weight_preferences (id, unit) VALUES (2, 'st')",
    );
    const { problems } = await validateSnapshot(db);
    expect(
      problems.some(
        (problem) =>
          problem.kind === "invariant" &&
          problem.detail.includes("Weight preferences"),
      ),
    ).toBe(true);
  });

  it("rejects non-positive durations", async () => {
    const db = await openDatabase(":memory:");
    await db.execAsync("DROP TABLE session_logs");
    await db.execAsync(
      `CREATE TABLE session_logs (
        id TEXT PRIMARY KEY NOT NULL,
        cycle_goal_id TEXT NOT NULL,
        local_date TEXT NOT NULL,
        started_at TEXT NOT NULL,
        duration_minutes INTEGER,
        created_at TEXT NOT NULL
      )`,
    );
    await db.runAsync(
      `INSERT INTO session_logs (
        id, cycle_goal_id, local_date, started_at, duration_minutes, created_at
      ) VALUES (?, ?, ?, ?, ?, ?)`,
      [
        "bad",
        "g1",
        "2026-07-02",
        "2026-07-02T12:00:00.000Z",
        -5,
        "2026-07-02T12:00:00.000Z",
      ],
    );
    const { problems } = await validateSnapshot(db);
    expect(
      problems.some(
        (problem) =>
          problem.kind === "invariant" && problem.detail.includes("duration"),
      ),
    ).toBe(true);
  });
});

describe("stageAndValidate size and garbage input", () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = makeBackupTempDir();
  });

  afterEach(() => {
    cleanupBackupTempDir(tempDir);
  });

  it("rejects oversized input before opening the file", async () => {
    const picked = new File("file:///mock/document/huge.db");
    picked.create({ overwrite: true });
    picked.write("tiny");
    Object.defineProperty(picked, "size", { get: () => MAX_SNAPSHOT_BYTES + 1 });
    const result = await stageAndValidate(picked);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.problems[0]).toEqual({
        kind: "too_large",
        sizeBytes: MAX_SNAPSHOT_BYTES + 1,
      });
    }
  });

  it("rejects non-SQLite bytes", async () => {
    const picked = new File("file:///mock/document/notes.txt");
    picked.create({ overwrite: true });
    picked.write("this is not a database");
    const result = await stageAndValidate(picked);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.problems[0]?.kind).toBe("not_a_database");
    }
  });

  it("rejects a truncated sqlite file", async () => {
    const db = await openDatabase(":memory:");
    await populateRepresentativeData(db);
    const serialized = await db.serializeAsync();
    const picked = new File("file:///mock/document/truncated.db");
    picked.create({ overwrite: true });
    picked.write(serialized.slice(0, 24));
    const result = await stageAndValidate(picked);
    expect(result.ok).toBe(false);
  });
});

async function insertCycle(
  db: SQLiteDatabase,
  id: string,
  status: string,
): Promise<void> {
  await db.runAsync(
    `INSERT INTO cycles (id, name, start_date, duration_days, end_date, status, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [
      id,
      id,
      "2026-07-01",
      30,
      "2026-07-30",
      status,
      "2026-07-01T00:00:00.000Z",
    ],
  );
}
