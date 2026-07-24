import { useCallback, useState } from "react";

import { useDatabase } from "../../../db/DatabaseProvider";
import {
  createGoalRepository,
  type CreateGoalRevisionInput,
} from "../data/goalRepository";
import type { GoalRevision } from "../../cycles/domain/types";

export type UseUpdateGoalResult = {
  updateGoal: (input: CreateGoalRevisionInput) => Promise<GoalRevision>;
  isPending: boolean;
  error: Error | null;
};

export function useUpdateGoal(): UseUpdateGoalResult {
  const { db } = useDatabase();
  const [isPending, setIsPending] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const updateGoal = useCallback(
    async (input: CreateGoalRevisionInput): Promise<GoalRevision> => {
      if (!db) {
        const unavailable = new Error("Database is not available yet");
        setError(unavailable);
        throw unavailable;
      }

      setIsPending(true);
      setError(null);
      try {
        const revision = await createGoalRepository(db).createRevision(input);
        return revision;
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

  return { updateGoal, isPending, error };
}
