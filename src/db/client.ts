import {
  defaultDatabaseDirectory,
  deleteDatabaseAsync,
  openDatabaseAsync,
  type SQLiteDatabase,
} from "expo-sqlite";
import { File } from "expo-file-system";

import { runMigrations, SUPPORTED_SCHEMA_VERSION } from "./migrations";
import { tryNodeFs } from "../features/backup/data/nodeFs";
import {
  escapeSqlString,
  fileUriToPath,
  getBackupDirectory,
} from "../features/backup/data/paths";

export const DEFAULT_DATABASE_NAME = "hexis.db";

export async function openDatabaseConnection(
  name: string,
): Promise<SQLiteDatabase> {
  const db = await openDatabaseAsync(name, { useNewConnection: true });
  await db.execAsync("PRAGMA foreign_keys = ON;");
  return db;
}

export async function openDatabase(
  name: string = DEFAULT_DATABASE_NAME,
): Promise<SQLiteDatabase> {
  const db = await openDatabaseAsync(name);
  await db.execAsync("PRAGMA journal_mode = WAL;");
  // SQLite leaves foreign-key enforcement disabled per connection unless the
  // application opts in. Enable it before migrations or repository writes so
  // the REFERENCES clauses in every schema version are real invariants.
  await db.execAsync("PRAGMA foreign_keys = ON;");
  await snapshotBeforePendingMigrations(db);
  await runMigrations(db);
  return db;
}

/**
 * Rename an unreadable live database and its WAL sidecars aside. Never deletes
 * the owner's only copy; restore then runs into a freshly opened file.
 */
export async function quarantineUnreadableDatabase(
  name: string = DEFAULT_DATABASE_NAME,
): Promise<void> {
  const stamp = new Date().toISOString().replaceAll(/[:.]/g, "-");
  const directory = String(defaultDatabaseDirectory);
  for (const suffix of ["", "-wal", "-shm"] as const) {
    const current = new File(directory, `${name}${suffix}`);
    if (!current.exists) {
      continue;
    }
    const asideName =
      suffix === ""
        ? `hexis-unreadable-${stamp}.db`
        : `hexis-unreadable-${stamp}.db${suffix}`;
    const aside = new File(directory, asideName);
    await current.move(aside);
  }
}

/**
 * Dev-only escape hatch for manual testing: closes the current connection,
 * deletes the on-disk database file, and reopens a fresh (migrated, empty)
 * one. Lets you re-run the cycle creation flow without reinstalling the app.
 */
export async function resetDatabase(
  db: SQLiteDatabase,
  name: string = DEFAULT_DATABASE_NAME,
): Promise<SQLiteDatabase> {
  await db.closeAsync();
  await deleteDatabaseAsync(name);
  return openDatabase(name);
}

async function snapshotBeforePendingMigrations(
  db: SQLiteDatabase,
): Promise<void> {
  const row = await db.getFirstAsync<{ user_version: number }>(
    "PRAGMA user_version",
  );
  const currentVersion = row?.user_version ?? 0;
  if (currentVersion <= 0 || currentVersion >= SUPPORTED_SCHEMA_VERSION) {
    return;
  }

  try {
    const backupDir = getBackupDirectory();
    if (!backupDir.exists) {
      backupDir.create({ intermediates: true, idempotent: true });
    }
    const fileName = `pre-migration-${new Date()
      .toISOString()
      .replaceAll(/[:.]/g, "")}.db`;
    const dest = new File(backupDir, fileName);
    const absolutePath = fileUriToPath(dest.uri);
    const nodeFs = tryNodeFs();
    nodeFs?.mkdirSync(parentPath(absolutePath), { recursive: true });
    if (dest.exists) {
      dest.delete();
    }
    nodeFs?.unlinkIfPresent(absolutePath);
    await db.execAsync(`VACUUM INTO '${escapeSqlString(absolutePath)}'`);
  } catch {
    // Opening still proceeds. The copy is upgrade insurance, not a backup.
  }
}

function parentPath(path: string): string {
  const index = path.lastIndexOf("/");
  return index === -1 ? path : path.slice(0, index);
}
