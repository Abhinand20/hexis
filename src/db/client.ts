import {
  deleteDatabaseAsync,
  openDatabaseAsync,
  type SQLiteDatabase,
} from "expo-sqlite";
import { runMigrations } from "./migrations";

export const DEFAULT_DATABASE_NAME = "hexis.db";

export async function openDatabase(
  name: string = DEFAULT_DATABASE_NAME,
): Promise<SQLiteDatabase> {
  const db = await openDatabaseAsync(name);
  await db.execAsync("PRAGMA journal_mode = WAL;");
  // SQLite leaves foreign-key enforcement disabled per connection unless the
  // application opts in. Enable it before migrations or repository writes so
  // the REFERENCES clauses in every schema version are real invariants.
  await db.execAsync("PRAGMA foreign_keys = ON;");
  await runMigrations(db);
  return db;
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
