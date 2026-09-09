import { useEffect, useState } from "react";

import { useDatabase } from "../../../db/DatabaseProvider";
import { createGoalRepository } from "../../goals/data/goalRepository";
import { createSessionRepository } from "../../logging/data/sessionRepository";
import { createCycleRepository } from "../data/cycleRepository";
import { todayLocalDate } from "../domain/date";
import type { Cycle, CycleGoal, GoalRevision, SessionLog } from "../domain/types";
import {
  buildCycleWrapUp,
  buildWrapUpComparison,
  eligibleComparisonBaselines,
  type WrapUpComparison,
  type WrapUpMetrics,
} from "../domain/cycleWrapUp";

export type CycleWrapUpState =
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "not_found" }
  | { status: "active_cycle"; cycle: Cycle }
  | {
      status: "ready";
      cycle: Cycle;
      metrics: WrapUpMetrics;
      baselines: Cycle[];
      comparison: WrapUpComparison | null;
    };

type CycleBundle = {
  cycle: Cycle;
  goals: CycleGoal[];
  revisions: GoalRevision[];
  logs: SessionLog[];
};

/**
 * Live derived wrap-up for a finished cycle. Opening this view writes nothing;
 * getActiveCycle is only used to settle a naturally completed lifecycle row.
 */
export function useCycleWrapUp(
  cycleId: string | undefined,
  baselineCycleId: string | null,
  refreshVersion: number,
): CycleWrapUpState {
  const { db } = useDatabase();
  const [state, setState] = useState<CycleWrapUpState>({ status: "loading" });

  useEffect(() => {
    if (!cycleId) {
      setState({ status: "not_found" });
      return;
    }
    if (!db) {
      return;
    }

    const database = db;
    const requestedCycleId = cycleId;
    let cancelled = false;
    setState({ status: "loading" });

    async function load() {
      try {
        const cycleRepository = createCycleRepository(database);
        await cycleRepository.getActiveCycle(todayLocalDate());
        const cycle = await cycleRepository.getCycleById(requestedCycleId);
        if (!cycle) {
          if (!cancelled) {
            setState({ status: "not_found" });
          }
          return;
        }
        if (cycle.status === "active") {
          if (!cancelled) {
            setState({ status: "active_cycle", cycle });
          }
          return;
        }

        const allCycles = await cycleRepository.listCycles();
        const baselines = eligibleComparisonBaselines(allCycles, cycle);
        const chosenBaseline =
          baselines.find((candidate) => candidate.id === baselineCycleId) ??
          baselines[0] ??
          null;

        const goalRepository = createGoalRepository(database);
        const sessionRepository = createSessionRepository(database);

        async function loadBundle(target: Cycle): Promise<CycleBundle> {
          const goals = await goalRepository.listForCycle(target.id);
          const [revisionsByGoal, logs] = await Promise.all([
            Promise.all(goals.map((goal) => goalRepository.listRevisions(goal.id))),
            sessionRepository.listForCycle(target.id),
          ]);
          return {
            cycle: target,
            goals,
            revisions: revisionsByGoal.flat(),
            logs,
          };
        }

        const selectedBundle = await loadBundle(cycle);
        const metrics = buildCycleWrapUp(
          selectedBundle.cycle,
          selectedBundle.goals,
          selectedBundle.revisions,
          selectedBundle.logs,
        );

        let comparison: WrapUpComparison | null = null;
        if (chosenBaseline) {
          const baselineBundle = await loadBundle(chosenBaseline);
          const baselineMetrics = buildCycleWrapUp(
            baselineBundle.cycle,
            baselineBundle.goals,
            baselineBundle.revisions,
            baselineBundle.logs,
          );
          comparison = buildWrapUpComparison(
            metrics,
            chosenBaseline,
            baselineMetrics,
            cycle,
          );
        }

        if (!cancelled) {
          setState({
            status: "ready",
            cycle,
            metrics,
            baselines,
            comparison,
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
  }, [db, cycleId, baselineCycleId, refreshVersion]);

  return state;
}
