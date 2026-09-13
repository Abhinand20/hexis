import type { SQLiteDatabase } from "expo-sqlite";

import { getBackupStatusFile } from "./paths";

export type BackupStatus = {
  lastBackupCreatedAt: string | null;
  lastBackupFileName: string | null;
};

const EMPTY_STATUS: BackupStatus = {
  lastBackupCreatedAt: null,
  lastBackupFileName: null,
};

export async function readBackupStatus(): Promise<BackupStatus> {
  try {
    const file = getBackupStatusFile();
    if (!file.exists) {
      return EMPTY_STATUS;
    }
    const parsed: unknown = JSON.parse(await file.text());
    if (!isBackupStatus(parsed)) {
      return EMPTY_STATUS;
    }
    return parsed;
  } catch {
    return EMPTY_STATUS;
  }
}

export async function recordBackupCreated(
  snapshot: { createdAt: string; fileName: string },
): Promise<BackupStatus> {
  const status: BackupStatus = {
    lastBackupCreatedAt: snapshot.createdAt,
    lastBackupFileName: snapshot.fileName,
  };
  const file = getBackupStatusFile();
  if (!file.exists) {
    file.create({ intermediates: true, overwrite: true });
  }
  file.write(JSON.stringify(status));
  return status;
}

/**
 * Ending a cycle early updates `cycles.status` / `end_date` without changing
 * `created_at`, so a lifecycle-only change is not detected here. A deleted
 * weight entry leaves no timestamp, and `weight_preferences` has none, so a
 * deletion-only weight change or a display-unit change is also invisible.
 * See the owner runbook rather than treating freshness as complete coverage.
 */
export async function hasChangesSinceBackup(
  db: SQLiteDatabase,
  lastBackupCreatedAt: string,
): Promise<boolean> {
  const row = await db.getFirstAsync<{ changed: number }>(
    `SELECT EXISTS (
      SELECT 1 FROM cycles WHERE created_at > ?
      UNION ALL SELECT 1 FROM cycle_goals WHERE created_at > ?
      UNION ALL SELECT 1 FROM goal_revisions WHERE created_at > ?
      UNION ALL SELECT 1 FROM session_logs WHERE created_at > ?
      UNION ALL SELECT 1 FROM session_log_revisions WHERE created_at > ?
      UNION ALL SELECT 1 FROM daily_weights WHERE MAX(created_at, updated_at) > ?
    ) AS changed`,
    lastBackupCreatedAt,
    lastBackupCreatedAt,
    lastBackupCreatedAt,
    lastBackupCreatedAt,
    lastBackupCreatedAt,
    lastBackupCreatedAt,
  );
  return (row?.changed ?? 0) === 1;
}

function isBackupStatus(value: unknown): value is BackupStatus {
  if (typeof value !== "object" || value === null) {
    return false;
  }
  const record = value as Record<string, unknown>;
  const created =
    record.lastBackupCreatedAt === null ||
    typeof record.lastBackupCreatedAt === "string";
  const fileName =
    record.lastBackupFileName === null ||
    typeof record.lastBackupFileName === "string";
  return created && fileName;
}
