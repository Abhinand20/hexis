export const BACKUP_STALE_AFTER_DAYS = 7;
const MS_PER_DAY = 24 * 60 * 60 * 1000;

export function isBackupStale(
  lastBackupCreatedAt: string | null,
  now: Date,
): boolean {
  if (lastBackupCreatedAt === null) {
    return true;
  }
  const created = Date.parse(lastBackupCreatedAt);
  if (Number.isNaN(created)) {
    return true;
  }
  return now.getTime() - created >= BACKUP_STALE_AFTER_DAYS * MS_PER_DAY;
}

export function describeBackupAge(
  lastBackupCreatedAt: string | null,
  now: Date,
): string {
  if (lastBackupCreatedAt === null) {
    return "No backup yet";
  }
  const created = Date.parse(lastBackupCreatedAt);
  if (Number.isNaN(created)) {
    return "No backup yet";
  }
  const days = Math.floor((now.getTime() - created) / MS_PER_DAY);
  if (days <= 0) {
    return "today";
  }
  if (days === 1) {
    return "yesterday";
  }
  return `${days} days ago`;
}
