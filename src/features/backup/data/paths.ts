import { Directory, File, Paths } from "expo-file-system";
import { defaultDatabaseDirectory } from "expo-sqlite";

export const BACKUP_DIRECTORY_NAME = "backups";
export const STAGING_DATABASE_NAME = "hexis-restore-staging.db";
export const BACKUP_STATUS_FILE_NAME = "backup-status.json";
export const MAX_SNAPSHOT_BYTES = 50 * 1024 * 1024;

let backupDirectoryOverride: Directory | null = null;
let backupFsPathOverride: string | null = null;

export function overrideBackupDirectoryForTests(
  directory: Directory | null,
  fsPath: string | null = null,
): void {
  backupDirectoryOverride = directory;
  backupFsPathOverride = fsPath;
}

export function getBackupDirectory(): Directory {
  return backupDirectoryOverride ?? new Directory(Paths.document, BACKUP_DIRECTORY_NAME);
}

export function snapshotAbsolutePath(fileName: string): string {
  if (backupFsPathOverride) {
    return `${backupFsPathOverride.replace(/\/$/, "")}/${fileName}`;
  }
  return fileUriToPath(new File(getBackupDirectory(), fileName).uri);
}

export function getBackupFsPath(): string | null {
  return backupFsPathOverride;
}

export function getBackupStatusFile(): File {
  return new File(Paths.document, BACKUP_STATUS_FILE_NAME);
}

export function getStagingFile(): File {
  return new File(String(defaultDatabaseDirectory), STAGING_DATABASE_NAME);
}

export function getLiveDatabaseFile(name: string): File {
  return new File(String(defaultDatabaseDirectory), name);
}

export function fileUriToPath(uri: string): string {
  if (uri.startsWith("file://")) {
    return decodeURIComponent(uri.slice("file://".length));
  }
  return uri;
}

export function pathToFileUri(path: string): string {
  if (path.startsWith("file://")) {
    return path;
  }
  return path.startsWith("/") ? `file://${path}` : `file:///${path}`;
}

export function escapeSqlString(value: string): string {
  return value.replaceAll("'", "''");
}

export function parentDirectoryPath(path: string): string {
  const index = path.lastIndexOf("/");
  return index <= 0 ? path : path.slice(0, index);
}
