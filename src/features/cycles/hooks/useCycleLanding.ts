import { useCallback, useEffect, useState } from "react";

import { useDatabase } from "../../../db/DatabaseProvider";
import { createCycleRepository } from "../data/cycleRepository";
import { createGoalRepository } from "../../goals/data/goalRepository";
import { createSessionRepository } from "../../logging/data/sessionRepository";
import { calendarDayIntensity } from "../domain/cycleProgress";
import {
  buildCycleSummary,
  type CycleAchievementSummary,
} from "../domain/cycleSummary";
import {
  buildHomeDashboardSummary,
  type HomeDashboardPractice,
  type HomeDashboardSummary,
} from "../domain/homeDashboard";
import { addLocalDays, todayLocalDate } from "../domain/date";

export type CycleLandingCalendarDay = {
  localDate: string;
  intensity: 0 | 1 | 2;
  isToday: boolean;
};

export type CycleLandingHeader = {
  cycleName: string;
  dayLabel: string;
  daysRemainingLabel: string;
};

export type CycleLandingState =
  | { status: "loading" }
  | { status: "empty" }
  | { status: "error"; message: string }
  | {
      status: "completed";
      cycleName: string;
      summary: CycleAchievementSummary;
      refresh: () => Promise<void>;
    }
  | {
      status: "ready";
      header: CycleLandingHeader;
      calendarDays: CycleLandingCalendarDay[];
      dashboard: HomeDashboardSummary;
      actionablePractices: HomeDashboardPractice[];
      refresh: () => Promise<void>;
    };

function formatDaysRemainingLabel(daysRemaining: number): string {
  if (daysRemaining <= 0) {
    return "Last day";
  }
  return `${daysRemaining} day${daysRemaining === 1 ? "" : "s"} remaining`;
}

/**
 * Loads and derives everything the active-cycle landing page needs.
 *
 * `today` defaults to the real local date; tests pass it explicitly to stay
 * deterministic without faking system time.
 * `reloadToken` has no logic of its own — bumping it forces a reload.
 */
export function useCycleLanding(
  today: string = todayLocalDate(),
  reloadToken: number = 0,
): CycleLandingState {
  const { db } = useDatabase();
  const [state, setState] = useState<CycleLandingState>({ status: "loading" });

  const load = useCallback(async () => {
    if (!db) {
      return;
    }

    try {
      const cycleRepository = createCycleRepository(db);
      const activeCycle = await cycleRepository.getActiveCycle(today);

      if (!activeCycle) {
        const recent = await cycleRepository.getMostRecentCycle();
        if (!recent) {
          setState({ status: "empty" });
          return;
        }

        const goalRepository = createGoalRepository(db);
        const goals = await goalRepository.listForCycle(recent.id);
        const revisionsByGoal = await Promise.all(
          goals.map((goal) => goalRepository.listRevisions(goal.id)),
        );
        const logs = await createSessionRepository(db).listForCycle(recent.id);
        const revisions = revisionsByGoal.flat();
        const summary = buildCycleSummary(recent, goals, revisions, logs);

        setState({
          status: "completed",
          cycleName: recent.name,
          summary,
          refresh: load,
        });
        return;
      }

      const cycleId = activeCycle.id;
      const goalRepository = createGoalRepository(db);
      // Keep the complete membership history for the calendar while limiting
      // today's actionable rows to practices that are active today.
      const [goals, activeGoals] = await Promise.all([
        goalRepository.listForCycle(cycleId),
        goalRepository.listActiveForCycle(cycleId, today),
      ]);
      const revisionsByGoal = await Promise.all(
        goals.map((goal) => goalRepository.listRevisions(goal.id)),
      );
      const revisions = revisionsByGoal.flat();
      const logs = await createSessionRepository(db).listForCycle(cycleId);
      const dashboard = buildHomeDashboardSummary({
        cycle: activeCycle,
        goals,
        revisions,
        effectiveLogs: logs,
        today,
      });

      const calendarDays: CycleLandingCalendarDay[] = Array.from(
        { length: activeCycle.durationDays },
        (_, index) => {
          const localDate = addLocalDays(activeCycle.startDate, index);
          return {
            localDate,
            intensity: calendarDayIntensity(goals, logs, localDate),
            isToday: localDate === today,
          };
        },
      );

      let todayIndex = calendarDays.findIndex((day) => day.isToday);
      if (todayIndex === -1) {
        todayIndex = today < activeCycle.startDate ? 0 : calendarDays.length - 1;
      }
      const dayNumber = todayIndex + 1;
      const daysRemaining = activeCycle.durationDays - dayNumber;

      const activeGoalIds = new Set(activeGoals.map((goal) => goal.id));

      setState({
        status: "ready",
        header: {
          cycleName: activeCycle.name,
          dayLabel: `Day ${dayNumber} / ${activeCycle.durationDays}`,
          daysRemainingLabel: formatDaysRemainingLabel(daysRemaining),
        },
        calendarDays,
        dashboard,
        actionablePractices: dashboard.practices.filter((practice) =>
          activeGoalIds.has(practice.goalId),
        ),
        refresh: load,
      });
    } catch (err) {
      setState({
        status: "error",
        message:
          err instanceof Error ? err.message : "Something went wrong. Try again.",
      });
    }
  }, [db, today, reloadToken]);

  useEffect(() => {
    void load();
  }, [load]);

  return state;
}
