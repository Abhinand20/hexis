import { useEffect, useState } from "react";

import { useDatabase } from "../../../db/DatabaseProvider";
import { createGoalRepository } from "../../goals/data/goalRepository";
import { createSessionRepository } from "../../logging/data/sessionRepository";
import { createCycleRepository } from "../data/cycleRepository";
import {
  buildCycleArchiveItems,
  type CycleArchiveItem,
} from "../domain/cycleArchive";
import { todayLocalDate } from "../domain/date";
import type { Cycle, CycleGoal, GoalRevision, SessionLog } from "../domain/types";

export type CycleHistoryState =
  | { status: "loading" }
  | { status: "empty" }
  | { status: "error"; message: string }
  | {
      status: "ready";
      cycle: Cycle;
      cycles: Cycle[];
      archiveItems: CycleArchiveItem[];
      goals: CycleGoal[];
      revisions: GoalRevision[];
      logs: SessionLog[];
    };

type CycleHistoryBundle = {
  cycle: Cycle;
  goals: CycleGoal[];
  revisions: GoalRevision[];
  logs: SessionLog[];
};

/**
 * Loads the complete archive plus the route-selected cycle's effective record.
 * Calling getActiveCycle first lets the repository settle a naturally-ended
 * active cycle before listCycles establishes archive order and fallback state.
 */
export function useCycleHistory(
  refreshVersion = 0,
  selectedCycleId?: string,
): CycleHistoryState {
  const { db, dataVersion } = useDatabase();
  const [state, setState] = useState<CycleHistoryState>({ status: "loading" });

  useEffect(() => {
    if (!db) {
      return;
    }

    const database = db;
    let cancelled = false;
    setState({ status: "loading" });

    async function load() {
      try {
        const today = todayLocalDate();
        const cycleRepository = createCycleRepository(database);

        // This is lifecycle settlement, not archive selection. No selected
        // cycle is ever promoted or otherwise mutated by History.
        await cycleRepository.getActiveCycle(today);
        const cycles = await cycleRepository.listCycles();

        if (cycles.length === 0) {
          if (!cancelled) {
            setState({ status: "empty" });
          }
          return;
        }

        const requestedCycle = selectedCycleId
          ? await cycleRepository.getCycleById(selectedCycleId)
          : null;
        const selectedCycle = requestedCycle
          ? cycles.find((cycle) => cycle.id === requestedCycle.id) ?? null
          : null;
        const cycle = selectedCycle ?? cycles[0];
        const goalRepository = createGoalRepository(database);
        const sessionRepository = createSessionRepository(database);

        const bundles: CycleHistoryBundle[] = await Promise.all(
          cycles.map(async (candidate) => {
            const goals = await goalRepository.listForCycle(candidate.id);
            const [revisionsByGoal, logs] = await Promise.all([
              Promise.all(
                goals.map((goal) => goalRepository.listRevisions(goal.id)),
              ),
              sessionRepository.listForCycle(candidate.id),
            ]);
            return {
              cycle: candidate,
              goals,
              revisions: revisionsByGoal.flat(),
              logs,
            };
          }),
        );
        const selectedBundle = bundles.find(
          (bundle) => bundle.cycle.id === cycle.id,
        );
        if (!selectedBundle) {
          throw new Error(`Cycle not found in archive: ${cycle.id}`);
        }

        const allGoals = bundles.flatMap((bundle) => bundle.goals);
        const allRevisions = bundles.flatMap((bundle) => bundle.revisions);
        const allLogs = bundles.flatMap((bundle) => bundle.logs);
        const archiveItems = buildCycleArchiveItems({
          cycles,
          goals: allGoals,
          revisions: allRevisions,
          effectiveLogs: allLogs,
          today,
        });

        if (!cancelled) {
          setState({
            status: "ready",
            cycle,
            cycles,
            archiveItems,
            goals: selectedBundle.goals,
            revisions: selectedBundle.revisions,
            logs: selectedBundle.logs,
          });
        }
      } catch (err) {
        if (!cancelled) {
          setState({
            status: "error",
            message:
              err instanceof Error
                ? err.message
                : "Something went wrong. Try again.",
          });
        }
      }
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, [db, refreshVersion, selectedCycleId, dataVersion]);

  return state;
}
