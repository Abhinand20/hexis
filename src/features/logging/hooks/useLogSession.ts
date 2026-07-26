import { useCallback, useState } from "react";

import { useDatabase } from "../../../db/DatabaseProvider";
import type { SessionLog } from "../../cycles/domain/types";
import {
  createSessionRepository,
  type CreateSessionLogInput,
} from "../data/sessionRepository";

export type UseLogSessionResult = {
  logSession: (input: CreateSessionLogInput) => Promise<SessionLog>;
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

  return { logSession, isPending, error };
}
