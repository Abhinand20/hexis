import { useCallback, useEffect, useState } from "react";

import { useDatabase } from "../../../db/DatabaseProvider";
import { createCycleRepository } from "../data/cycleRepository";
import { createGoalRepository } from "../../goals/data/goalRepository";
import { createSessionRepository } from "../../logging/data/sessionRepository";
import {
  calculateGoalStreak,
  calculateGoalWeekProgress,
  calendarDayIntensity,
  goalConfigurationOn,
} from "../domain/cycleProgress";
import {
  buildCycleSummary,
  type CycleAchievementSummary,
} from "../domain/cycleSummary";
import { addLocalDays, todayLocalDate } from "../domain/date";
import type { GoalCadence, SessionLog } from "../domain/types";

export type CycleLandingCalendarDay = {
  localDate: string;
  intensity: 0 | 1 | 2;
  isToday: boolean;
};

export type CycleLandingGoalRow = {
  goalId: string;
  name: string;
  streakLabel: string;
  weeklyProgressLabel: string;
  weeklyProgressRatio: number;
  weeklySessionCount: number;
  weeklySessionTarget: number;
  todayLogs: SessionLog[];
  expectedDurationMinutes: number | null;
};

export type CycleLandingHeader = {
  cycleName: string;
  dayLabel: string;
  daysRemainingLabel: string;
  overallProgressRatio: number;
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
      goals: CycleLandingGoalRow[];
      refresh: () => Promise<void>;
    };

function formatStreakLabel(cadence: GoalCadence, streak: number): string {
  if (streak === 0) {
    return "No streak yet";
  }
  const unit = cadence === "daily" ? "day" : "week";
  return `${streak} ${unit}${streak === 1 ? "" : "s"} streak`;
}

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
      const goals = await goalRepository.listForCycle(cycleId);
      const revisionsByGoal = await Promise.all(
        goals.map((goal) => goalRepository.listRevisions(goal.id)),
      );
      const logs = await createSessionRepository(db).listForCycle(cycleId);

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

      const elapsedDays = calendarDays.slice(0, todayIndex + 1);
      const activeDayCount = elapsedDays.filter((day) => day.intensity > 0).length;
      const overallProgressRatio =
        elapsedDays.length === 0 ? 0 : activeDayCount / elapsedDays.length;

      const goalRows: CycleLandingGoalRow[] = goals.map((goal, index) => {
        const revisions = revisionsByGoal[index];
        const config = goalConfigurationOn(goal, revisions, today);
        const progress = calculateGoalWeekProgress(goal, revisions, logs, today);
        const streak = calculateGoalStreak(goal, revisions, logs, today);
        const weeklyProgressRatio =
          progress.sessionTarget === 0
            ? 0
            : Math.min(1, progress.sessionCount / progress.sessionTarget);

        return {
          goalId: goal.id,
          name: config.name,
          // Use the goal's own (not revised) cadence: calculateGoalStreak
          // branches on this same field internally.
          streakLabel: formatStreakLabel(goal.cadence, streak),
          weeklyProgressLabel: `${progress.sessionCount}/${progress.sessionTarget} this week`,
          weeklyProgressRatio,
          weeklySessionCount: progress.sessionCount,
          weeklySessionTarget: progress.sessionTarget,
          todayLogs: logs
            .filter((log) => log.cycleGoalId === goal.id && log.localDate === today)
            .sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
          expectedDurationMinutes: config.expectedDurationMinutes,
        };
      });

      setState({
        status: "ready",
        header: {
          cycleName: activeCycle.name,
          dayLabel: `Day ${dayNumber} / ${activeCycle.durationDays}`,
          daysRemainingLabel: formatDaysRemainingLabel(daysRemaining),
          overallProgressRatio,
        },
        calendarDays,
        goals: goalRows,
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
