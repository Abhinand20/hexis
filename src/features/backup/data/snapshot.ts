import { File } from "expo-file-system";
import type { SQLiteDatabase } from "expo-sqlite";

import { todayLocalDate } from "../../cycles/domain/date";
import { tryNodeFs } from "./nodeFs";
import {
  BACKUP_DIRECTORY_NAME,
  escapeSqlString,
  fileUriToPath,
  getBackupDirectory,
  getBackupFsPath,
  parentDirectoryPath,
  pathToFileUri,
  snapshotAbsolutePath,
} from "./paths";

export { BACKUP_DIRECTORY_NAME };
export const SNAPSHOT_METADATA_TABLE = "backup_metadata";

export type SnapshotResult = {
  uri: string;
  fileName: string;
  createdAt: string;
  schemaVersion: number;
  sizeBytes: number;
};

const sessionPreRestoreNames = new Set<string>();

export function rememberPreRestoreFileName(fileName: string): void {
  sessionPreRestoreNames.add(fileName);
}

export function resetPreRestoreSessionForTests(): void {
  sessionPreRestoreNames.clear();
}

export async function createSnapshot(
  db: SQLiteDatabase,
  options: { appVersion: string; now?: Date; label?: string },
): Promise<SnapshotResult> {
  const now = options.now ?? new Date();
  const createdAt = now.toISOString();
  const backupDir = getBackupDirectory();
  if (!backupDir.exists) {
    backupDir.create({ intermediates: true, idempotent: true });
  }

  const fileName = options.label
    ? snapshotFileNameForLabel(options.label)
    : `hexis-backup-${todayLocalDate(now)}.db`;
  if (options.label?.startsWith("pre-restore-")) {
    rememberPreRestoreFileName(fileName);
  }

  const dest = new File(backupDir, fileName);
  const absolutePath = snapshotAbsolutePath(fileName);
  const nodeFs = tryNodeFs();
  nodeFs?.mkdirSync(parentDirectoryPath(absolutePath), { recursive: true });

  if (dest.exists) {
    dest.delete();
  }
  nodeFs?.unlinkIfPresent(absolutePath);

  const versionRow = await db.getFirstAsync<{ user_version: number }>(
    "PRAGMA user_version",
  );
  const schemaVersion = versionRow?.user_version ?? 0;

  await db.execAsync(`VACUUM INTO '${escapeSqlString(absolutePath)}'`);

  let attached = false;
  try {
    await db.execAsync(
      `ATTACH DATABASE '${escapeSqlString(absolutePath)}' AS snap`,
    );
    attached = true;
    await db.execAsync(
      `CREATE TABLE snap.${SNAPSHOT_METADATA_TABLE} (
        created_at TEXT NOT NULL,
        app_version TEXT NOT NULL,
        schema_version INTEGER NOT NULL
      )`,
    );
    await db.runAsync(
      `INSERT INTO snap.${SNAPSHOT_METADATA_TABLE} (created_at, app_version, schema_version)
       VALUES (?, ?, ?)`,
      createdAt,
      options.appVersion,
      schemaVersion,
    );
    const pageCount = await pragmaNumber(db, "PRAGMA snap.page_count");
    const pageSize = await pragmaNumber(db, "PRAGMA snap.page_size");
    const sizeBytes =
      dest.size > 0 ? dest.size : pageCount * pageSize || statSize(absolutePath);

    await db.execAsync("DETACH DATABASE snap");
    attached = false;

    syncMockFileFromOs(dest, absolutePath);
    pruneLocalSnapshots(backupDir);

    return {
      uri: pathToFileUri(absolutePath),
      fileName,
      createdAt,
      schemaVersion,
      sizeBytes,
    };
  } catch (error) {
    if (attached) {
      try {
        await db.execAsync("DETACH DATABASE snap");
      } catch {
        // The next attempt will ATTACH a new snapshot.
      }
    }
    if (dest.exists) {
      dest.delete();
    }
    nodeFs?.unlinkIfPresent(absolutePath);
    throw error;
  }
}

export function pruneLocalSnapshots(backupDir = getBackupDirectory()): void {
  if (backupDir.exists) {
    const files = backupDir
      .list()
      .filter((entry): entry is File => entry instanceof File)
      .filter((file) => file.name.endsWith(".db"));

    const preRestore = files.filter((file) =>
      file.name.startsWith("pre-restore-"),
    );
    const regular = files.filter((file) => !file.name.startsWith("pre-restore-"));

    regular.sort(compareNewestFirst);
    for (const extra of regular.slice(2)) {
      deleteSnapshotFile(extra);
    }

    for (const file of preRestore) {
      if (!sessionPreRestoreNames.has(file.name)) {
        deleteSnapshotFile(file);
      }
    }
  }

  pruneOsDirectory(getBackupFsPath() ?? fileUriToPath(backupDir.uri));
}

function snapshotFileNameForLabel(label: string): string {
  return label.endsWith(".db") ? label : `${label}.db`;
}

function compareNewestFirst(a: File, b: File): number {
  const byModified = (b.lastModified ?? 0) - (a.lastModified ?? 0);
  if (byModified !== 0) {
    return byModified;
  }
  return b.name.localeCompare(a.name);
}

function deleteSnapshotFile(file: File): void {
  const absolutePath = snapshotAbsolutePath(file.name);
  if (file.exists) {
    file.delete();
  }
  tryNodeFs()?.unlinkIfPresent(absolutePath);
}

function pruneOsDirectory(dirPath: string): void {
  const nodeFs = tryNodeFs();
  if (!nodeFs?.existsSync(dirPath)) {
    return;
  }
  const names = nodeFs.readdirSync(dirPath).filter((name) => name.endsWith(".db"));
  const preRestore = names.filter((name) => name.startsWith("pre-restore-"));
  const regular = names
    .filter((name) => !name.startsWith("pre-restore-"))
    .sort()
    .reverse();
  for (const extra of regular.slice(2)) {
    nodeFs.unlinkIfPresent(`${dirPath.replace(/\/$/, "")}/${extra}`);
  }
  for (const name of preRestore) {
    if (!sessionPreRestoreNames.has(name)) {
      nodeFs.unlinkIfPresent(`${dirPath.replace(/\/$/, "")}/${name}`);
    }
  }
}

async function pragmaNumber(
  db: SQLiteDatabase,
  sql: string,
): Promise<number> {
  const row = await db.getFirstAsync<Record<string, number>>(sql);
  if (!row) {
    return 0;
  }
  const value = Object.values(row)[0];
  return typeof value === "number" ? value : 0;
}

function statSize(absolutePath: string): number {
  const nodeFs = tryNodeFs();
  if (!nodeFs?.existsSync(absolutePath)) {
    return 0;
  }
  return nodeFs.statSync(absolutePath).size;
}

function syncMockFileFromOs(dest: File, absolutePath: string): void {
  const nodeFs = tryNodeFs();
  if (!nodeFs?.existsSync(absolutePath)) {
    return;
  }
  dest.write(new Uint8Array(nodeFs.readFileSync(absolutePath)));
}
