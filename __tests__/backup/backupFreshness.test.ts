import {
  BACKUP_STALE_AFTER_DAYS,
  describeBackupAge,
  isBackupStale,
} from "../../src/features/backup/domain/backupFreshness";

const now = new Date("2026-09-08T12:00:00.000Z");

describe("backup freshness", () => {
  it("treats a missing backup as stale", () => {
    expect(isBackupStale(null, now)).toBe(true);
    expect(describeBackupAge(null, now)).toBe("No backup yet");
  });

  it("is not stale at six days", () => {
    const created = new Date(now.getTime() - 6 * 24 * 60 * 60 * 1000).toISOString();
    expect(isBackupStale(created, now)).toBe(false);
    expect(describeBackupAge(created, now)).toBe("6 days ago");
  });

  it("is stale at seven days", () => {
    const created = new Date(
      now.getTime() - BACKUP_STALE_AFTER_DAYS * 24 * 60 * 60 * 1000,
    ).toISOString();
    expect(isBackupStale(created, now)).toBe(true);
    expect(describeBackupAge(created, now)).toBe("7 days ago");
  });

  it("is stale at eight days", () => {
    const created = new Date(now.getTime() - 8 * 24 * 60 * 60 * 1000).toISOString();
    expect(isBackupStale(created, now)).toBe(true);
    expect(describeBackupAge(created, now)).toBe("8 days ago");
  });

  it("describes a backup from today", () => {
    expect(describeBackupAge(now.toISOString(), now)).toBe("today");
  });
});
