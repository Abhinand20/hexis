import { useCallback, useState } from "react";
import Constants from "expo-constants";
import * as Sharing from "expo-sharing";

import {
  openDatabase,
  quarantineUnreadableDatabase,
} from "../../../db/client";
import { useDatabase } from "../../../db/DatabaseProvider";
import { runExclusive } from "../data/backupMutex";
import { recordBackupCreated } from "../data/backupStatus";
import { reconcileRemindersAfterRestore } from "../data/reminderReconcile";
import {
  discardStaging,
  installationIsEmpty,
  replaceLiveData,
  stageAndValidate,
  type StagedSnapshot,
} from "../data/restore";
import { createSnapshot } from "../data/snapshot";
import {
  describeSnapshotProblem,
  type SnapshotPreview,
} from "../data/snapshotValidation";
import { pickBackupFile } from "./useCreateBackup";

export type RestoreViewState =
  | { status: "idle" }
  | { status: "working" }
  | {
      status: "preview";
      staged: StagedSnapshot;
      installationEmpty: boolean;
    }
  | { status: "check"; preview: SnapshotPreview }
  | { status: "error"; message: string }
  | {
      status: "success";
      reminderWarning: string | null;
    };

export function useRestoreBackup() {
  const { db, setBusy = () => {}, reloadAll = () => {}, acceptDatabase = () => {} } =
    useDatabase();
  const [state, setState] = useState<RestoreViewState>({ status: "idle" });

  const reset = useCallback(() => {
    setState({ status: "idle" });
  }, []);

  const checkBackup = useCallback(async () => {
    const picked = await pickBackupFile();
    if (picked.canceled) {
      return;
    }
    setState({ status: "working" });
    const result = await stageAndValidate(picked.file);
    if (!result.ok) {
      setState({
        status: "error",
        message: result.problems.map(describeSnapshotProblem).join("\n"),
      });
      return;
    }
    await discardStaging(result.staged);
    setState({ status: "check", preview: result.staged.preview });
  }, []);

  const startRestore = useCallback(async () => {
    const picked = await pickBackupFile();
    if (picked.canceled) {
      return;
    }
    setState({ status: "working" });
    const result = await stageAndValidate(picked.file);
    if (!result.ok) {
      setState({
        status: "error",
        message: result.problems.map(describeSnapshotProblem).join("\n"),
      });
      return;
    }
    const installationEmpty = db ? await installationIsEmpty(db) : true;
    setState({
      status: "preview",
      staged: result.staged,
      installationEmpty,
    });
  }, [db]);

  const backupCurrentFirst = useCallback(async () => {
    if (!db) {
      return;
    }
    try {
      const snapshot = await createSnapshot(db, {
        appVersion: Constants.expoConfig?.version ?? "0.1.0",
      });
      await Sharing.shareAsync(snapshot.uri, {
        UTI: "public.database",
        mimeType: "application/vnd.sqlite3",
        dialogTitle: "Save Hexis backup",
      });
      await recordBackupCreated(snapshot);
    } catch {
      // Cancellation records no timestamp; the restore preview stays open.
    }
  }, [db]);

  const confirmRestore = useCallback(async () => {
    if (state.status !== "preview") {
      return;
    }
    const staged = state.staged;

    await runExclusive(async () => {
      setBusy(true);
      setState({ status: "working" });
      try {
        let live = db;
        if (!live) {
          await quarantineUnreadableDatabase();
          live = await openDatabase();
        } else if (!(await installationIsEmpty(live))) {
          await createSnapshot(live, {
            appVersion: Constants.expoConfig?.version ?? "0.1.0",
            label: `pre-restore-${new Date().toISOString().replaceAll(/[:.]/g, "")}`,
          });
        }

        await replaceLiveData(live, staged);
        const reminderWarning = await reconcileRemindersAfterRestore(live);
        await discardStaging(staged);
        if (!db) {
          acceptDatabase(live);
        }
        reloadAll();
        setState({ status: "success", reminderWarning });
      } catch (error) {
        await discardStaging(staged).catch(() => undefined);
        setState({
          status: "error",
          message:
            error instanceof Error
              ? error.message
              : "Restore failed. Your original data should still be here.",
        });
      } finally {
        setBusy(false);
      }
    });
  }, [acceptDatabase, db, reloadAll, setBusy, state]);

  const cancelPreview = useCallback(async () => {
    if (state.status === "preview") {
      await discardStaging(state.staged).catch(() => undefined);
    }
    setState({ status: "idle" });
  }, [state]);

  return {
    state,
    checkBackup,
    startRestore,
    confirmRestore,
    cancelPreview,
    backupCurrentFirst,
    reset,
  };
}
