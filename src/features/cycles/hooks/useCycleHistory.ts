import { useCallback, useEffect, useState } from "react";

import { useDatabase } from "../../../db/DatabaseProvider";
import { createCycleRepository } from "../data/cycleRepository";
import { createGoalRepository } from "../../goals/data/goalRepository";
import { createSessionRepository } from "../../logging/data/sessionRepository";
import type { Cycle, CycleGoal, GoalRevision, SessionLog } from "../domain/types";

export type CycleHistoryState =
  | { status: "loading" }
  | { status: "empty" }
  | { status: "error"; message: string }
  | {
      status: "ready";
      cycle: Cycle;
      goals: CycleGoal[];
      revisions: GoalRevision[];
      logs: SessionLog[];
    };

/**
 * Loads the cycle History should look back on: the active cycle if one
 * exists, otherwise the most recent completed/ended cycle. Unlike Home,
 * History does not distinguish completed from active beyond needing *a*
 * cycle with its goals/revisions/logs.
 */
export function useCycleHistory(refreshVersion = 0): CycleHistoryState {
  const { db } = useDatabase();
  const [state, setState] = useState<CycleHistoryState>({ status: "loading" });

  const load = useCallback(async () => {
    if (!db) {
      return;
    }

    try {
      const cycleRepository = createCycleRepository(db);
      const active = await cycleRepository.getActiveCycle();
      const cycle = active ?? (await cycleRepository.getMostRecentCycle());

      if (!cycle) {
        setState({ status: "empty" });
        return;
      }

      const goalRepository = createGoalRepository(db);
      const goals = await goalRepository.listForCycle(cycle.id);
      const revisionsByGoal = await Promise.all(
        goals.map((goal) => goalRepository.listRevisions(goal.id)),
      );
      const logs = await createSessionRepository(db).listForCycle(cycle.id);

      setState({
        status: "ready",
        cycle,
        goals,
        revisions: revisionsByGoal.flat(),
        logs,
      });
    } catch (err) {
      setState({
        status: "error",
        message:
          err instanceof Error ? err.message : "Something went wrong. Try again.",
      });
    }
  }, [db, refreshVersion]);

  useEffect(() => {
    void load();
  }, [load]);

  return state;
}
