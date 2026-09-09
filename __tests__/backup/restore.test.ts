import { File } from "expo-file-system";
import type { SQLiteDatabase } from "expo-sqlite";

import { createSessionRepository } from "../../src/features/logging/data/sessionRepository";
import { createGoalRepository } from "../../src/features/goals/data/goalRepository";
import { fileUriToPath } from "../../src/features/backup/data/paths";
import { runExclusive } from "../../src/features/backup/data/backupMutex";
import {
  discardStaging,
  replaceLiveData,
  stageAndValidate,
  type StagedSnapshot,
} from "../../src/features/backup/data/restore";
import { createSnapshot } from "../../src/features/backup/data/snapshot";
import type { SnapshotPreview } from "../../src/features/backup/data/snapshotValidation";
import {
  cleanupBackupTempDir,
  dumpTables,
  makeBackupTempDir,
  openLiveDatabase,
  populateRepresentativeData,
  type RawTables,
} from "./helpers";

describe("replaceLiveData", () => {
  let live: SQLiteDatabase;
  let tempDir: string;

  beforeEach(async () => {
    tempDir = makeBackupTempDir();
    live = await openLiveDatabase();
  });

  afterEach(() => {
    cleanupBackupTempDir(tempDir);
  });

  it("round-trips raw rows for a representative dataset", async () => {
    await populateRepresentativeData(live);
    const original = await dumpTables(live);
    const staged = await snapshotOf(live, original);

    await live.runAsync("DELETE FROM session_log_revisions");
    await live.runAsync("DELETE FROM session_logs");
    await live.runAsync("UPDATE cycles SET name = 'mutated'");

    await replaceLiveData(live, staged);
    expect(await dumpTables(live)).toEqual(original);
    expect(
      await live.getFirstAsync(
        "SELECT name FROM sqlite_master WHERE name = 'backup_metadata'",
      ),
    ).toBeNull();
  });

  it("round-trips an empty database", async () => {
    const original = await dumpTables(live);
    const staged = await snapshotOf(live, original);
    await live.runAsync(
      `INSERT INTO cycles (id, name, start_date, duration_days, end_date, status, created_at)
       VALUES ('x', 'Later', '2026-08-01', 30, '2026-08-30', 'active', '2026-08-01T00:00:00.000Z')`,
    );
    await replaceLiveData(live, staged);
    expect(await dumpTables(live)).toEqual(original);
  });

  it("preserves sqlite_sequence so a later correction continues the original series", async () => {
    const ids = await populateRepresentativeData(live);
    const originalSeq = await live.getFirstAsync<{ seq: number }>(
      "SELECT seq FROM sqlite_sequence WHERE name = 'session_log_revisions'",
    );
    expect(originalSeq).not.toBeNull();
    await live.runAsync(
      "DELETE FROM session_log_revisions WHERE sequence = (SELECT MAX(sequence) FROM session_log_revisions)",
    );
    const remainingMax = await live.getFirstAsync<{ max: number }>(
      "SELECT MAX(sequence) AS max FROM session_log_revisions",
    );
    expect(remainingMax?.max).toBeLessThan(originalSeq!.seq);

    const tables = await dumpTables(live);
    const staged = await snapshotOf(live, tables);
    await live.runAsync("DELETE FROM session_log_revisions");
    await replaceLiveData(live, staged);

    const restoredSeq = await live.getFirstAsync<{ seq: number }>(
      "SELECT seq FROM sqlite_sequence WHERE name = 'session_log_revisions'",
    );
    expect(restoredSeq?.seq).toBe(originalSeq!.seq);

    const [goal] = await createGoalRepository(live).listForCycle(ids.activeCycleId);
    const created = await createSessionRepository(live).create({
      cycleGoalId: goal.id,
      startedAt: "2026-07-20T12:00:00.000Z",
      durationMinutes: 5,
    });
    const corrected = await createSessionRepository(live).correct(created.id, {
      cycleGoalId: goal.id,
      startedAt: "2026-07-20T12:05:00.000Z",
      durationMinutes: 6,
    });
    const newSeq = await live.getFirstAsync<{ sequence: number }>(
      "SELECT MAX(sequence) AS sequence FROM session_log_revisions",
    );
    expect(newSeq?.sequence).toBe(originalSeq!.seq + 1);
  });

  it.each([
    ["before the transaction", { beforeTransaction: () => fail("before") }],
    [
      "during delete",
      {
        duringDelete: (table: string) => {
          if (table === "cycles") {
            fail("during delete");
          }
        },
      },
    ],
    [
      "during insert",
      {
        duringInsert: (table: string) => {
          if (table === "session_logs") {
            fail("during insert");
          }
        },
      },
    ],
    ["before commit", { beforeCommit: () => fail("before commit") }],
  ] as const)(
    "rolls back when failure is injected %s",
    async (_label, hooks) => {
      await populateRepresentativeData(live);
      const original = await dumpTables(live);
      const staged = await snapshotOf(live, original);
      await live.runAsync("UPDATE cycles SET name = 'live-only' WHERE status = 'active'");
      const expected = await dumpTables(live);

      await expect(replaceLiveData(live, staged, { ...hooks })).rejects.toThrow();
      expect(await dumpTables(live)).toEqual(expected);
    },
  );

  it("surfaces an after-commit verification failure", async () => {
    await populateRepresentativeData(live);
    const original = await dumpTables(live);
    const staged = await snapshotOf(live, original);
    await expect(
      replaceLiveData(live, staged, {
        afterCommit: () => {
          throw new Error("post-commit probe");
        },
      }),
    ).rejects.toThrow("post-commit probe");
    expect(await dumpTables(live)).toEqual(original);
  });

  it("releases the mutex after a thrown restore", async () => {
    const order: string[] = [];
    await expect(
      runExclusive(async () => {
        order.push("first");
        throw new Error("boom");
      }),
    ).rejects.toThrow("boom");
    await runExclusive(async () => {
      order.push("second");
    });
    expect(order).toEqual(["first", "second"]);
  });

  it("cleans staging files after discardStaging", async () => {
    await populateRepresentativeData(live);
    const snapshot = await createSnapshot(live, {
      appVersion: "0.1.0",
      now: new Date(2026, 8, 8, 12),
    });
    const picked = new File("file:///mock/document/picked-backup.db");
    picked.create({ overwrite: true });
    picked.write(new Uint8Array(require("fs").readFileSync(fileUriToPath(snapshot.uri))));
    const result = await stageAndValidate(picked);
    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }
    await discardStaging(result.staged);
    const leftover = new File(
      String(require("expo-sqlite").defaultDatabaseDirectory),
      "hexis-restore-staging.db",
    );
    expect(leftover.exists).toBe(false);
  });
});

function fail(message: string): never {
  throw new Error(message);
}

async function snapshotOf(
  db: SQLiteDatabase,
  tables: RawTables,
): Promise<StagedSnapshot> {
  const snapshot = await createSnapshot(db, {
    appVersion: "0.1.0",
    now: new Date(2026, 8, 8, 12),
  });
  const preview: SnapshotPreview = {
    createdAt: snapshot.createdAt,
    appVersion: "0.1.0",
    schemaVersion: snapshot.schemaVersion,
    cycleCount: tables.cycles.length,
    sessionCount: tables.session_logs.length,
    correctionCount: tables.session_log_revisions.length,
    hasActiveCycle: tables.cycles.some((row) => row.status === "active"),
  };
  return {
    databaseName: "hexis-restore-staging.db",
    absolutePath: fileUriToPath(snapshot.uri),
    preview,
  };
}
