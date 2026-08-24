import { useCallback, useState } from "react";

import { useDatabase } from "../../../db/DatabaseProvider";
import type { SessionLog } from "../../cycles/domain/types";
import {
  createSessionRepository,
  type CorrectSessionLogInput,
  type CreateSessionLogInput,
} from "../data/sessionRepository";

type PendingMutation = "saving" | "deleting" | null;

export type UseEditSessionResult = {
  createSession: (input: CreateSessionLogInput) => Promise<SessionLog>;
  correctSession: (
    sourceSessionId: string,
    input: CorrectSessionLogInput,
  ) => Promise<SessionLog>;
  deleteSession: (sourceSessionId: string) => Promise<void>;
  clearError: () => void;
  isSaving: boolean;
  isDeleting: boolean;
  error: Error | null;
};

export function useEditSession(): UseEditSessionResult {
  const { db } = useDatabase();
  const [pendingMutation, setPendingMutation] = useState<PendingMutation>(null);
  const [error, setError] = useState<Error | null>(null);

  const run = useCallback(
    async <T,>(kind: Exclude<PendingMutation, null>, mutation: () => Promise<T>) => {
      if (!db) {
        const unavailable = new Error("Database is not available yet");
        setError(unavailable);
        throw unavailable;
      }

      setPendingMutation(kind);
      setError(null);
      try {
        return await mutation();
      } catch (reason) {
        const nextError = reason instanceof Error ? reason : new Error(String(reason));
        setError(nextError);
        throw nextError;
      } finally {
        setPendingMutation(null);
      }
    },
    [db],
  );

  const createSession = useCallback(
    (input: CreateSessionLogInput) =>
      run("saving", () => createSessionRepository(db!).create(input)),
    [db, run],
  );

  const correctSession = useCallback(
    (sourceSessionId: string, input: CorrectSessionLogInput) =>
      run("saving", () =>
        createSessionRepository(db!).correct(sourceSessionId, input),
      ),
    [db, run],
  );

  const deleteSession = useCallback(
    (sourceSessionId: string) =>
      run("deleting", () =>
        createSessionRepository(db!).deleteById(sourceSessionId),
      ),
    [db, run],
  );

  const clearError = useCallback(() => setError(null), []);

  return {
    createSession,
    correctSession,
    deleteSession,
    clearError,
    isSaving: pendingMutation === "saving",
    isDeleting: pendingMutation === "deleting",
    error,
  };
}
