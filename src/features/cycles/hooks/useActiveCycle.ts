import { useEffect, useState } from "react";

import { useDatabase } from "../../../db/DatabaseProvider";
import { createCycleRepository } from "../data/cycleRepository";
import type { Cycle } from "../domain/types";

export type ActiveCycleState = {
  cycle: Cycle | null;
  isLoading: boolean;
};

export function useActiveCycle(): ActiveCycleState {
  const { db, isLoading: isDatabaseLoading } = useDatabase();
  const [state, setState] = useState<ActiveCycleState>({
    cycle: null,
    isLoading: true,
  });

  useEffect(() => {
    if (!db) {
      return;
    }

    let cancelled = false;

    createCycleRepository(db)
      .getActiveCycle()
      .then((cycle) => {
        if (!cancelled) {
          setState({ cycle, isLoading: false });
        }
      });

    return () => {
      cancelled = true;
    };
  }, [db]);

  if (isDatabaseLoading) {
    return { cycle: null, isLoading: true };
  }

  return state;
}
