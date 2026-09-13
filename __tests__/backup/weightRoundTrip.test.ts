import { createElement } from "react";
import { File } from "expo-file-system";
import { render } from "@testing-library/react-native";
import {
  openDatabaseAsync,
  type SQLiteDatabase,
} from "expo-sqlite";

import {
  SCHEMA_V1,
  SCHEMA_V2,
  SCHEMA_V3,
  SCHEMA_V4,
  SCHEMA_V5,
  SCHEMA_V6,
} from "../../src/db/schema";
import { BackupPreviewCopy } from "../../src/features/backup/components/BackupPreviewCopy";
import { hasChangesSinceBackup } from "../../src/features/backup/data/backupStatus";
import { fileUriToPath } from "../../src/features/backup/data/paths";
import {
  installationIsEmpty,
  replaceLiveData,
  stageAndValidate,
  type StagedSnapshot,
} from "../../src/features/backup/data/restore";
import { createSnapshot } from "../../src/features/backup/data/snapshot";
import { validateSnapshot } from "../../src/features/backup/data/snapshotValidation";
import {
  DELETE_ORDER,
  TABLE_COLUMNS,
  type LiveTable,
} from "../../src/features/backup/data/tables";
import { createGoalRepository } from "../../src/features/goals/data/goalRepository";
import { createSessionRepository } from "../../src/features/logging/data/sessionRepository";
import { createWeightRepository } from "../../src/features/weight/data/weightRepository";
import {
  attachSnapshot,
  cleanupBackupTempDir,
  dumpTables,
  makeBackupTempDir,
  openLiveDatabase,
  populateRepresentativeData,
  type RawTables,
} from "./helpers";

const CYCLE_ERA_TABLES = [
  "cycles",
  "cycle_goals",
  "goal_revisions",
  "session_logs",
  "session_log_revisions",
  "reminder_settings",
] as const satisfies readonly LiveTable[];

describe("weight backup round-trip", () => {
  let live: SQLiteDatabase;
  let tempDir: string;

  beforeEach(async () => {
    tempDir = makeBackupTempDir();
    live = await openLiveDatabase();
  });

  afterEach(() => {
    cleanupBackupTempDir(tempDir);
  });

  it("round-trips every daily_weights and weight_preferences row", async () => {
    await populateRepresentativeData(live);
    const weights = createWeightRepository(live);
    await weights.save({ localDate: "2026-08-01", weightGrams: 69500 });
    await weights.save({ localDate: "2026-08-02", weightGrams: 70100 });
    await weights.setUnit("lb");

    const original = await dumpTables(live);
    expect(original.daily_weights).toHaveLength(2);
    expect(original.weight_preferences).toEqual([{ id: 1, unit: "lb" }]);

    const staged = await stageSnapshot(live);
    expect(staged.preview.weightEntryCount).toBe(2);

    await live.runAsync("DELETE FROM daily_weights");
    await live.runAsync("DELETE FROM weight_preferences");
    await live.runAsync("UPDATE cycles SET name = 'mutated'");

    await replaceLiveData(live, staged);
    expect(await dumpTables(live)).toEqual(original);
  });

  it("restores a schema-6 snapshot with zero weight entries and intact cycle data", async () => {
    const v6 = await openSchemaSixDatabase();
    await populateRepresentativeData(v6);
    const expectedCycleEra = await dumpNamedTables(v6, CYCLE_ERA_TABLES);

    const snapshot = await createSnapshot(v6, {
      appVersion: "0.1.0",
      now: new Date(2026, 8, 8, 12),
    });
    const snapshotPath = fileUriToPath(snapshot.uri);

    await attachSnapshot(v6, snapshotPath);
    expect(await v6.getFirstAsync("PRAGMA snap.user_version")).toEqual({
      user_version: 6,
    });
    expect(
      await v6.getAllAsync(
        `SELECT name FROM snap.sqlite_master
         WHERE type = 'table' AND name IN ('daily_weights', 'weight_preferences')`,
      ),
    ).toEqual([]);
    await v6.execAsync("DETACH DATABASE snap");

    await populateRepresentativeData(live);
    await createWeightRepository(live).save({
      localDate: "2026-08-15",
      weightGrams: 80000,
    });
    await createWeightRepository(live).setUnit("lb");

    const staged = await stagePickedSnapshot(snapshotPath);
    expect(staged.preview.schemaVersion).toBe(7);
    expect(staged.preview.weightEntryCount).toBe(0);
    expect(staged.preview.cycleCount).toBe(expectedCycleEra.cycles.length);

    await replaceLiveData(live, staged);

    expect(await dumpNamedTables(live, CYCLE_ERA_TABLES)).toEqual(
      expectedCycleEra,
    );
    expect(
      await live.getFirstAsync<{ count: number }>(
        "SELECT COUNT(*) AS count FROM daily_weights",
      ),
    ).toEqual({ count: 0 });
    expect(
      await live.getFirstAsync<{ count: number }>(
        "SELECT COUNT(*) AS count FROM weight_preferences",
      ),
    ).toEqual({ count: 0 });
  });

  it("reports the weight entry count on the restore preview", async () => {
    await populateRepresentativeData(live);
    await createWeightRepository(live).save({
      localDate: "2026-08-01",
      weightGrams: 69000,
    });

    const { preview, problems } = await validateSnapshot(live);
    expect(problems).toEqual([]);
    expect(preview.weightEntryCount).toBe(1);

    const screen = await render(createElement(BackupPreviewCopy, { preview }));
    expect(screen.getByText(/1 weight entry/)).toBeTruthy();
    expect(screen.queryByText(/1 weight entries/)).toBeNull();
  });

  it("detects a weight edit through backup freshness and nothing else", async () => {
    const backupAt = "2026-08-01T12:00:00.000Z";
    await live.runAsync(
      `INSERT INTO daily_weights (
        id, local_date, weight_grams, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?)`,
      ["weight_fresh", "2026-08-01", 70000, backupAt, backupAt],
    );

    expect(await hasChangesSinceBackup(live, backupAt)).toBe(false);

    await createWeightRepository(live).save({
      localDate: "2026-08-01",
      weightGrams: 70500,
    });

    const edited = await live.getFirstAsync<{
      id: string;
      created_at: string;
      updated_at: string;
    }>("SELECT id, created_at, updated_at FROM daily_weights WHERE id = ?", [
      "weight_fresh",
    ]);
    if (!edited) {
      throw new Error("expected the edited weight row");
    }
    expect(edited.created_at).toBe(backupAt);
    expect(edited.updated_at > backupAt).toBe(true);
    expect(await hasChangesSinceBackup(live, backupAt)).toBe(true);
  });

  it("preserves sqlite_sequence so a later correction continues the series", async () => {
    const ids = await populateRepresentativeData(live);
    await createWeightRepository(live).save({
      localDate: "2026-08-01",
      weightGrams: 70000,
    });
    const originalSeq = await live.getFirstAsync<{ seq: number }>(
      "SELECT seq FROM sqlite_sequence WHERE name = 'session_log_revisions'",
    );
    expect(originalSeq).not.toBeNull();

    const staged = await stageSnapshot(live);
    await live.runAsync("DELETE FROM session_log_revisions");
    await replaceLiveData(live, staged);

    const restoredSeq = await live.getFirstAsync<{ seq: number }>(
      "SELECT seq FROM sqlite_sequence WHERE name = 'session_log_revisions'",
    );
    expect(restoredSeq?.seq).toBe(originalSeq!.seq);

    const [goal] = await createGoalRepository(live).listForCycle(
      ids.activeCycleId,
    );
    const created = await createSessionRepository(live).create({
      cycleGoalId: goal.id,
      startedAt: "2026-07-20T12:00:00.000Z",
      durationMinutes: 5,
    });
    await createSessionRepository(live).correct(created.id, {
      cycleGoalId: goal.id,
      startedAt: "2026-07-20T12:05:00.000Z",
      durationMinutes: 6,
    });
    const newSeq = await live.getFirstAsync<{ sequence: number }>(
      "SELECT MAX(sequence) AS sequence FROM session_log_revisions",
    );
    expect(newSeq?.sequence).toBe(originalSeq!.seq + 1);
  });
});

describe("installationIsEmpty covers everything restore deletes", () => {
  let live: SQLiteDatabase;
  let tempDir: string;

  beforeEach(async () => {
    tempDir = makeBackupTempDir();
    live = await openLiveDatabase();
  });

  afterEach(() => {
    cleanupBackupTempDir(tempDir);
  });

  it("treats a fresh installation as empty", async () => {
    expect(await installationIsEmpty(live)).toBe(true);
  });

  it("reports a weight-only installation as non-empty", async () => {
    await createWeightRepository(live).save({
      localDate: "2026-08-01",
      weightGrams: 69500,
    });
    expect(await installationIsEmpty(live)).toBe(false);
  });

  it("reports a unit-preference-only installation as non-empty", async () => {
    await createWeightRepository(live).setUnit("lb");
    expect(await installationIsEmpty(live)).toBe(false);
  });

  it("sees a row in every table restore deletes", async () => {
    for (const table of DELETE_ORDER) {
      const row = await live.getFirstAsync(`SELECT 1 FROM ${table} LIMIT 1`);
      expect(row).toBeNull();
    }
    await populateRepresentativeData(live);
    await createWeightRepository(live).save({
      localDate: "2026-08-01",
      weightGrams: 69500,
    });
    await createWeightRepository(live).setUnit("lb");

    // Any table restore wipes must be one this query would have noticed.
    for (const table of DELETE_ORDER) {
      const row = await live.getFirstAsync(`SELECT 1 FROM ${table} LIMIT 1`);
      expect(row).not.toBeNull();
    }
    expect(await installationIsEmpty(live)).toBe(false);
  });
});

async function stageSnapshot(db: SQLiteDatabase): Promise<StagedSnapshot> {
  const snapshot = await createSnapshot(db, {
    appVersion: "0.1.0",
    now: new Date(2026, 8, 8, 12),
  });
  return stagePickedSnapshot(fileUriToPath(snapshot.uri));
}

async function stagePickedSnapshot(absolutePath: string): Promise<StagedSnapshot> {
  const picked = new File("file:///mock/document/weight-round-trip.db");
  picked.create({ overwrite: true });
  picked.write(new Uint8Array(require("fs").readFileSync(absolutePath)));
  const result = await stageAndValidate(picked);
  if (!result.ok) {
    throw new Error(
      `expected a valid snapshot, got ${JSON.stringify(result.problems)}`,
    );
  }
  return result.staged;
}

async function openSchemaSixDatabase(): Promise<SQLiteDatabase> {
  const db = await openDatabaseAsync(":memory:");
  await db.execAsync("PRAGMA journal_mode = WAL;");
  await db.execAsync("PRAGMA foreign_keys = ON;");
  for (const statement of [
    ...SCHEMA_V1,
    ...SCHEMA_V2,
    ...SCHEMA_V3,
    ...SCHEMA_V4,
    ...SCHEMA_V5,
    ...SCHEMA_V6,
  ]) {
    await db.execAsync(statement);
  }
  await db.execAsync("PRAGMA user_version = 6;");
  return db;
}

async function dumpNamedTables(
  db: SQLiteDatabase,
  tables: readonly LiveTable[],
): Promise<RawTables> {
  const dumped: RawTables = {};
  for (const table of tables) {
    const columns = TABLE_COLUMNS[table].join(", ");
    const order = table === "session_log_revisions" ? "sequence" : "id";
    dumped[table] = await db.getAllAsync(
      `SELECT ${columns} FROM ${table} ORDER BY ${order}`,
    );
  }
  return dumped;
}
