import { useCallback, useEffect, useState } from "react";

import { useDatabase } from "../../../db/DatabaseProvider";
import {
  hasChangesSinceBackup,
  readBackupStatus,
  type BackupStatus,
} from "../data/backupStatus";
import {
  describeBackupAge,
  isBackupStale,
} from "../domain/backupFreshness";

export type BackupStatusView = {
  status: BackupStatus;
  ageLabel: string;
  hasChangesSinceBackup: boolean;
  isStale: boolean;
  reload: () => Promise<void>;
};

export function useBackupStatus(): BackupStatusView {
  const { db, dataVersion = 0 } = useDatabase();
  const [status, setStatus] = useState<BackupStatus>({
    lastBackupCreatedAt: null,
    lastBackupFileName: null,
  });
  const [changed, setChanged] = useState(false);

  const reload = useCallback(async () => {
    const next = await readBackupStatus();
    setStatus(next);
    if (!db || next.lastBackupCreatedAt === null) {
      setChanged(false);
      return;
    }
    setChanged(await hasChangesSinceBackup(db, next.lastBackupCreatedAt));
  }, [db]);

  useEffect(() => {
    void reload();
  }, [reload, dataVersion]);

  const now = new Date();
  return {
    status,
    ageLabel: describeBackupAge(status.lastBackupCreatedAt, now),
    hasChangesSinceBackup: changed,
    isStale: isBackupStale(status.lastBackupCreatedAt, now),
    reload,
  };
}
