import { openDatabaseAsync, type SQLiteDatabase } from "expo-sqlite";
import { runMigrations } from "./migrations";

export async function openDatabase(
  name: string = "hexis.db",
): Promise<SQLiteDatabase> {
  const db = await openDatabaseAsync(name);
  await db.execAsync("PRAGMA journal_mode = WAL;");
  await runMigrations(db);
  return db;
}
