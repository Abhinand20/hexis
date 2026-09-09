import { File } from "expo-file-system";
import {
  deserializeDatabaseAsync,
  type SQLiteDatabase,
} from "expo-sqlite";

import { openDatabaseConnection } from "../../../db/client";
import { tryNodeFs } from "./nodeFs";
import {
  escapeSqlString,
  fileUriToPath,
  getStagingFile,
  MAX_SNAPSHOT_BYTES,
  parentDirectoryPath,
  STAGING_DATABASE_NAME,
} from "./paths";
import {
  describeSnapshotProblem,
  validateSnapshot,
  type SnapshotProblem,
  type SnapshotPreview,
} from "./snapshotValidation";
import { DELETE_ORDER, INSERT_ORDER, insertSelectSql } from "./tables";

export type StagedSnapshot = {
  databaseName: string;
  absolutePath: string;
  preview: SnapshotPreview;
};

export type RestoreFailureHooks = {
  beforeTransaction?: () => Promise<void> | void;
  duringDelete?: (table: string) => Promise<void> | void;
  duringInsert?: (table: string) => Promise<void> | void;
  beforeCommit?: () => Promise<void> | void;
  afterCommit?: () => Promise<void> | void;
};

export async function stageAndValidate(
  picked: File,
): Promise<
  { ok: true; staged: StagedSnapshot } | { ok: false; problems: SnapshotProblem[] }
> {
  const sizeBytes = picked.size;
  if (sizeBytes > MAX_SNAPSHOT_BYTES) {
    return {
      ok: false,
      problems: [{ kind: "too_large", sizeBytes }],
    };
  }

  const stagingFile = getStagingFile();
  if (stagingFile.exists) {
    stagingFile.delete();
  }
  tryNodeFs()?.unlinkIfPresent(fileUriToPath(stagingFile.uri));

  await picked.copy(stagingFile, { overwrite: true });

  let stagingDb: SQLiteDatabase | null = null;
  try {
    const opened = await openStagingConnection(stagingFile);
    stagingDb = opened.db;
    const { preview, problems } = await validateSnapshot(stagingDb);
    if (problems.length > 0) {
      return { ok: false, problems };
    }
    await stagingDb.closeAsync();
    stagingDb = null;
    return {
      ok: true,
      staged: {
        databaseName: STAGING_DATABASE_NAME,
        absolutePath: opened.absolutePath,
        preview,
      },
    };
  } catch {
    return {
      ok: false,
      problems: [{ kind: "not_a_database" }],
    };
  } finally {
    if (stagingDb) {
      try {
        await stagingDb.closeAsync();
      } catch {
        // Discarded on every path, including throws.
      }
    }
  }
}

export async function replaceLiveData(
  liveDb: SQLiteDatabase,
  staged: StagedSnapshot,
  hooks: RestoreFailureHooks = {},
): Promise<void> {
  const escaped = escapeSqlString(staged.absolutePath);
  let attached = false;
  try {
    await liveDb.execAsync(`ATTACH DATABASE '${escaped}' AS src`);
    attached = true;
    await hooks.beforeTransaction?.();

    await liveDb.withTransactionAsync(async () => {
      for (const table of DELETE_ORDER) {
        await liveDb.execAsync(`DELETE FROM main.${table}`);
        await hooks.duringDelete?.(table);
      }
      for (const table of INSERT_ORDER) {
        await liveDb.execAsync(insertSelectSql(table));
        await hooks.duringInsert?.(table);
      }
      await reconcileSqliteSequence(liveDb);
      await assertRestoredInvariants(liveDb, staged.preview);
      await hooks.beforeCommit?.();
    });

    await hooks.afterCommit?.();
    await assertPostCommit(liveDb, staged.preview);
  } finally {
    if (attached) {
      try {
        await liveDb.execAsync("DETACH DATABASE src");
      } catch {
        // A later restore will ATTACH again.
      }
    }
  }
}

export async function discardStaging(staged: StagedSnapshot): Promise<void> {
  const stagingFile = getStagingFile();
  if (stagingFile.exists) {
    stagingFile.delete();
  }
  tryNodeFs()?.unlinkIfPresent(fileUriToPath(stagingFile.uri));
  if (staged.absolutePath !== fileUriToPath(stagingFile.uri)) {
    tryNodeFs()?.unlinkIfPresent(staged.absolutePath);
  }
}

export async function installationIsEmpty(db: SQLiteDatabase): Promise<boolean> {
  const row = await db.getFirstAsync<{ changed: number }>(
    `SELECT EXISTS (
      SELECT 1 FROM cycles
      UNION ALL SELECT 1 FROM cycle_goals
      UNION ALL SELECT 1 FROM goal_revisions
      UNION ALL SELECT 1 FROM session_logs
      UNION ALL SELECT 1 FROM session_log_revisions
      UNION ALL SELECT 1 FROM reminder_settings
    ) AS changed`,
  );
  return (row?.changed ?? 0) === 0;
}

async function openStagingConnection(
  stagingFile: File,
): Promise<{ db: SQLiteDatabase; absolutePath: string }> {
  const filePath = fileUriToPath(stagingFile.uri);
  const materializedPath = materializeForAttach(stagingFile, filePath);

  try {
    const db = await openDatabaseConnection(STAGING_DATABASE_NAME);
    const master = await db.getFirstAsync<{ count: number }>(
      "SELECT COUNT(*) AS count FROM sqlite_master",
    );
    if ((master?.count ?? 0) > 0) {
      return { db, absolutePath: materializedPath };
    }
    await db.closeAsync();
  } catch {
    // Fall through to deserialize from the copied bytes.
  }

  const bytes = stagingFile.bytesSync();
  if (bytes.byteLength === 0) {
    throw new Error("Staging copy is empty");
  }
  const db = await deserializeDatabaseAsync(bytes);
  await db.execAsync("PRAGMA foreign_keys = ON;");
  return { db, absolutePath: materializedPath };
}

function materializeForAttach(file: File, filePath: string): string {
  const nodeFs = tryNodeFs();
  if (!nodeFs) {
    return filePath;
  }
  try {
    const bytes = file.bytesSync();
    if (bytes.byteLength === 0) {
      return filePath;
    }
    const materialized = `${nodeFs.tmpdir}/hexis-restore-attach.db`;
    nodeFs.mkdirSync(parentDirectoryPath(materialized), { recursive: true });
    nodeFs.unlinkIfPresent(materialized);
    nodeFs.writeFileSync(materialized, bytes);
    return materialized;
  } catch {
    return filePath;
  }
}

async function reconcileSqliteSequence(db: SQLiteDatabase): Promise<void> {
  await db.runAsync(
    "DELETE FROM main.sqlite_sequence WHERE name = 'session_log_revisions'",
  );
  const source = await db.getFirstAsync<{ name: string; seq: number }>(
    "SELECT name, seq FROM src.sqlite_sequence WHERE name = 'session_log_revisions'",
  );
  if (!source) {
    return;
  }
  await db.runAsync(
    "INSERT INTO main.sqlite_sequence (name, seq) VALUES (?, ?)",
    source.name,
    source.seq,
  );
}

async function assertRestoredInvariants(
  db: SQLiteDatabase,
  preview: SnapshotPreview,
): Promise<void> {
  const foreignKeyRows = await db.getAllAsync("PRAGMA main.foreign_key_check");
  if (foreignKeyRows.length > 0) {
    throw new Error("Restored data failed a foreign-key check before commit");
  }
  const active = await count(
    db,
    "SELECT COUNT(*) AS count FROM main.cycles WHERE status = 'active'",
  );
  if (active > 1) {
    throw new Error("Restored data contains more than one active cycle");
  }
  const cycles = await count(db, "SELECT COUNT(*) AS count FROM main.cycles");
  if (cycles !== preview.cycleCount) {
    throw new Error("Restored cycle count does not match the snapshot preview");
  }
}

async function assertPostCommit(
  db: SQLiteDatabase,
  preview: SnapshotPreview,
): Promise<void> {
  const integrity = await db.getFirstAsync<{ integrity_check: string }>(
    "PRAGMA integrity_check",
  );
  if (integrity?.integrity_check !== "ok") {
    throw new Error(
      `Restored data failed integrity_check (${integrity?.integrity_check ?? "no row"})`,
    );
  }
  const cycleCount = await count(db, "SELECT COUNT(*) AS count FROM cycles");
  const sessionCount = await count(
    db,
    "SELECT COUNT(*) AS count FROM session_logs",
  );
  const correctionCount = await count(
    db,
    "SELECT COUNT(*) AS count FROM session_log_revisions",
  );
  if (
    cycleCount !== preview.cycleCount ||
    sessionCount !== preview.sessionCount ||
    correctionCount !== preview.correctionCount
  ) {
    throw new Error("Restored row counts do not match the snapshot preview");
  }
}

async function count(db: SQLiteDatabase, sql: string): Promise<number> {
  const row = await db.getFirstAsync<{ count: number }>(sql);
  return row?.count ?? 0;
}

export { describeSnapshotProblem };
export type { SnapshotProblem, SnapshotPreview };
