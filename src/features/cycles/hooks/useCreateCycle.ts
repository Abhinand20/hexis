import { useCallback, useState } from "react";

import { useDatabase } from "../../../db/DatabaseProvider";
import {
  createCycleRepository,
  type CreateCycleInput,
} from "../data/cycleRepository";
import type { Cycle } from "../domain/types";

export type UseCreateCycleResult = {
  createCycle: (input: CreateCycleInput) => Promise<Cycle>;
  isPending: boolean;
  error: Error | null;
};

export function useCreateCycle(): UseCreateCycleResult {
  const { db } = useDatabase();
  const [isPending, setIsPending] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const createCycle = useCallback(
    async (input: CreateCycleInput): Promise<Cycle> => {
      if (!db) {
        const unavailable = new Error("Database is not available yet");
        setError(unavailable);
        throw unavailable;
      }

      setIsPending(true);
      setError(null);
      try {
        const cycle = await createCycleRepository(db).createCycle(input);
        return cycle;
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

  return { createCycle, isPending, error };
}
