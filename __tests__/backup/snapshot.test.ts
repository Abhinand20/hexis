import { File } from "expo-file-system";
import type { SQLiteDatabase } from "expo-sqlite";

import { SUPPORTED_SCHEMA_VERSION } from "../../src/db/migrations";
import { tryNodeFs } from "../../src/features/backup/data/nodeFs";
import { fileUriToPath } from "../../src/features/backup/data/paths";
import {
  createSnapshot,
  pruneLocalSnapshots,
  SNAPSHOT_METADATA_TABLE,
} from "../../src/features/backup/data/snapshot";
import { getBackupDirectory } from "../../src/features/backup/data/paths";
import {
  attachSnapshot,
  cleanupBackupTempDir,
  makeBackupTempDir,
  openLiveDatabase,
  populateRepresentativeData,
} from "./helpers";

describe("createSnapshot", () => {
  let db: SQLiteDatabase;
  let tempDir: string;

  beforeEach(async () => {
    tempDir = makeBackupTempDir();
    db = await openLiveDatabase();
    await populateRepresentativeData(db);
  });

  afterEach(() => {
    cleanupBackupTempDir(tempDir);
  });

  it("writes one file with no wal or shm sidecars and preserves sqlite internals", async () => {
    const snapshot = await createSnapshot(db, {
      appVersion: "0.1.0",
      now: new Date(2026, 8, 8, 12),
    });
    const absolutePath = fileUriToPath(snapshot.uri);

    expect(snapshot.fileName).toBe("hexis-backup-2026-09-08.db");
    expect(nodeFs().existsSync(absolutePath)).toBe(true);
    expect(nodeFs().existsSync(`${absolutePath}-wal`)).toBe(false);
    expect(nodeFs().existsSync(`${absolutePath}-shm`)).toBe(false);

    await attachSnapshot(db, absolutePath);
    expect(await db.getFirstAsync("PRAGMA snap.user_version")).toEqual({
      user_version: SUPPORTED_SCHEMA_VERSION,
    });
    const metadata = await db.getFirstAsync(
      `SELECT created_at, app_version, schema_version FROM snap.${SNAPSHOT_METADATA_TABLE}`,
    );
    expect(metadata).toEqual({
      created_at: new Date(2026, 8, 8, 12).toISOString(),
      app_version: "0.1.0",
      schema_version: SUPPORTED_SCHEMA_VERSION,
    });
    const liveSeq = await db.getFirstAsync<{ seq: number }>(
      "SELECT seq FROM main.sqlite_sequence WHERE name = 'session_log_revisions'",
    );
    const snapSeq = await db.getFirstAsync<{ seq: number }>(
      "SELECT seq FROM snap.sqlite_sequence WHERE name = 'session_log_revisions'",
    );
    expect(snapSeq).toEqual(liveSeq);
    await db.execAsync("DETACH DATABASE snap");
  });

  it("replaces an existing same-day destination", async () => {
    const now = new Date(2026, 8, 8, 12);
    const first = await createSnapshot(db, { appVersion: "0.1.0", now });
    await db.runAsync(
      "UPDATE cycles SET name = 'Renamed after first snapshot' WHERE status = 'active'",
    );
    const second = await createSnapshot(db, { appVersion: "0.1.0", now });
    expect(second.fileName).toBe(first.fileName);
    expect(second.uri).toBe(first.uri);
    await attachSnapshot(db, fileUriToPath(second.uri));
    expect(
      await db.getFirstAsync("SELECT name FROM snap.cycles WHERE status = 'active'"),
    ).toEqual({ name: "Renamed after first snapshot" });
    await db.execAsync("DETACH DATABASE snap");
  });

  it("prunes local snapshots down to the two most recent", async () => {
    await createSnapshot(db, {
      appVersion: "0.1.0",
      now: new Date(2026, 8, 6, 12),
    });
    await createSnapshot(db, {
      appVersion: "0.1.0",
      now: new Date(2026, 8, 7, 12),
    });
    await createSnapshot(db, {
      appVersion: "0.1.0",
      now: new Date(2026, 8, 8, 12),
    });

    const names = nodeFs().readdirSync(tempDir).sort();
    expect(names).toEqual([
      "hexis-backup-2026-09-07.db",
      "hexis-backup-2026-09-08.db",
    ]);
  });

  it("keeps a current-session pre-restore file while pruning older backups", async () => {
    await createSnapshot(db, {
      appVersion: "0.1.0",
      now: new Date(2026, 8, 6, 12),
    });
    await createSnapshot(db, {
      appVersion: "0.1.0",
      now: new Date(2026, 8, 7, 12),
    });
    await createSnapshot(db, {
      appVersion: "0.1.0",
      label: "pre-restore-20260908",
      now: new Date(2026, 8, 8, 12),
    });
    const names = nodeFs().readdirSync(tempDir).sort();
    expect(names).toContain("pre-restore-20260908.db");
    expect(names.filter((name) => name.startsWith("hexis-backup-"))).toHaveLength(
      2,
    );
  });

  it("deletes a partial file when metadata cannot be written", async () => {
    const original = db.runAsync.bind(db);
    db.runAsync = (async (...params: Parameters<SQLiteDatabase["runAsync"]>) => {
      const sql = params[0];
      if (
        typeof sql === "string" &&
        sql.includes(SNAPSHOT_METADATA_TABLE) &&
        sql.includes("INSERT")
      ) {
        throw new Error("metadata write failed");
      }
      return original(...params);
    }) as typeof db.runAsync;

    await expect(
      createSnapshot(db, {
        appVersion: "0.1.0",
        now: new Date(2026, 8, 8, 12),
      }),
    ).rejects.toThrow("metadata write failed");

    expect(nodeFs().existsSync(pathJoin(tempDir, "hexis-backup-2026-09-08.db"))).toBe(
      false,
    );
  });

  it("prunes using the File listing when extra mock files exist", () => {
    const dir = getBackupDirectory();
    if (!dir.exists) {
      dir.create({ intermediates: true, idempotent: true });
    }
    for (const name of [
      "hexis-backup-2026-09-01.db",
      "hexis-backup-2026-09-02.db",
      "hexis-backup-2026-09-03.db",
    ]) {
      const file = new File(dir, name);
      if (!file.exists) {
        file.create();
      }
      file.write("x");
    }
    pruneLocalSnapshots(dir);
    const remaining = dir
      .list()
      .filter((entry) => entry instanceof File)
      .map((file) => file.name)
      .sort();
    expect(remaining).toEqual([
      "hexis-backup-2026-09-02.db",
      "hexis-backup-2026-09-03.db",
    ]);
  });
});

function pathJoin(dir: string, name: string): string {
  return `${dir.replace(/\/$/, "")}/${name}`;
}

function nodeFs() {
  const fs = tryNodeFs();
  if (!fs) {
    throw new Error("backup snapshot tests require Node fs");
  }
  return fs;
}
