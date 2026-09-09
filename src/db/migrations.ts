import type { SQLiteDatabase } from "expo-sqlite";
import {
  SCHEMA_V1,
  SCHEMA_V2,
  SCHEMA_V3,
  SCHEMA_V4,
  SCHEMA_V5,
  SCHEMA_V6,
} from "./schema";

const MIGRATIONS: string[][] = [
  SCHEMA_V1,
  SCHEMA_V2,
  SCHEMA_V3,
  SCHEMA_V4,
  SCHEMA_V5,
  SCHEMA_V6,
];

export const SUPPORTED_SCHEMA_VERSION = MIGRATIONS.length;

export async function runMigrations(db: SQLiteDatabase): Promise<void> {
  const row = await db.getFirstAsync<{ user_version: number }>(
    "PRAGMA user_version",
  );
  const currentVersion = row?.user_version ?? 0;

  for (let index = currentVersion; index < MIGRATIONS.length; index++) {
    const statements = MIGRATIONS[index];
    const nextVersion = index + 1;

    await db.withTransactionAsync(async () => {
      for (const statement of statements) {
        await db.execAsync(statement);
      }
      await db.execAsync(`PRAGMA user_version = ${nextVersion};`);
    });
  }
}
