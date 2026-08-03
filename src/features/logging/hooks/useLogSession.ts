import { useCallback, useState } from "react";

import { useDatabase } from "../../../db/DatabaseProvider";
import type { SessionLog } from "../../cycles/domain/types";
import {
  createSessionRepository,
  type CreateSessionLogInput,
} from "../data/sessionRepository";

export type UseLogSessionResult = {
  logSession: (input: CreateSessionLogInput) => Promise<SessionLog>;
  removeSession: (id: string) => Promise<void>;
  isPending: boolean;
  error: Error | null;
};

export function useLogSession(): UseLogSessionResult {
  const { db } = useDatabase();
  const [isPending, setIsPending] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const logSession = useCallback(
    async (input: CreateSessionLogInput): Promise<SessionLog> => {
      if (!db) {
        const unavailable = new Error("Database is not available yet");
        setError(unavailable);
        throw unavailable;
      }

      setIsPending(true);
      setError(null);
      try {
        const log = await createSessionRepository(db).create(input);
        return log;
      } catch (err) {
        const nextError = err instanceof Error ? err : new Error(String(err));
        setError(nextError);
        throw nextError;
      } finally {
        setIsPending(false);
      }
    },
    [db],
  );

  const removeSession = useCallback(
    async (id: string): Promise<void> => {
      if (!db) {
        const unavailable = new Error("Database is not available yet");
        setError(unavailable);
        throw unavailable;
      }

      setIsPending(true);
      setError(null);
      try {
        await createSessionRepository(db).deleteById(id);
      } catch (err) {
        const nextError = err instanceof Error ? err : new Error(String(err));
        setError(nextError);
        throw nextError;
      } finally {
        setIsPending(false);
      }
    },
    [db],
  );

  return { logSession, removeSession, isPending, error };
}
