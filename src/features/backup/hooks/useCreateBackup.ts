import { File } from "expo-file-system";
import { useCallback, useState } from "react";
import * as Sharing from "expo-sharing";
import Constants from "expo-constants";

import { useDatabase } from "../../../db/DatabaseProvider";
import { runExclusive } from "../data/backupMutex";
import { recordBackupCreated } from "../data/backupStatus";
import { createSnapshot } from "../data/snapshot";

export const ICLOUD_DRIVE_INSTRUCTION =
  'Save this file to iCloud Drive, not "On My iPhone". A copy that stays on this phone will not survive losing it.';

export const SHARE_HONESTY_COPY =
  "Hexis cannot confirm the file reached iCloud or that iCloud finished uploading it. Completing the share sheet is not proof of a durable copy.";

type CreateBackupState =
  | { status: "idle" }
  | { status: "working" }
  | { status: "success"; fileName: string }
  | { status: "cancelled" }
  | { status: "error"; message: string };

export function useCreateBackup() {
  const { db, setBusy = () => {} } = useDatabase();
  const [state, setState] = useState<CreateBackupState>({ status: "idle" });

  const createBackup = useCallback(async () => {
    if (!db) {
      setState({
        status: "error",
        message: "The database is not ready yet. Try again in a moment.",
      });
      return;
    }

    await runExclusive(async () => {
      setBusy(true);
      setState({ status: "working" });
      try {
        const snapshot = await createSnapshot(db, {
          appVersion: appVersion(),
        });
        await Sharing.shareAsync(snapshot.uri, {
          UTI: "public.database",
          mimeType: "application/vnd.sqlite3",
          dialogTitle: "Save Hexis backup",
        });
        await recordBackupCreated(snapshot);
        setState({ status: "success", fileName: snapshot.fileName });
      } catch (error) {
        if (isCancellation(error)) {
          setState({ status: "cancelled" });
          return;
        }
        setState({
          status: "error",
          message:
            error instanceof Error
              ? error.message
              : "Could not create a backup. Your data is unchanged.",
        });
      } finally {
        setBusy(false);
      }
    });
  }, [db, setBusy]);

  const dismiss = useCallback(() => {
    setState({ status: "idle" });
  }, []);

  return { state, createBackup, dismiss };
}

function appVersion(): string {
  return Constants.expoConfig?.version ?? "0.1.0";
}

function isCancellation(error: unknown): boolean {
  if (!(error instanceof Error)) {
    return false;
  }
  const message = error.message.toLowerCase();
  return (
    message.includes("cancel") ||
    message.includes("dismiss") ||
    error.name === "AbortError"
  );
}

export function pickBackupFile(): Promise<
  { canceled: true } | { canceled: false; file: File }
> {
  return File.pickFileAsync({ mimeTypes: ["*/*"] }).then((result) => {
    if (result.canceled || result.result === null) {
      return { canceled: true };
    }
    return { canceled: false, file: result.result };
  });
}
