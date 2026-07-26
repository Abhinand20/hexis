import { goalConfigurationOn } from "./cycleProgress";
import { addLocalDays, weekStart } from "./date";
import type { Cycle, CycleGoal, GoalRevision, SessionLog } from "./types";

export type CycleAchievementSummary = {
  activeDayCount: number;
  loggedDayCount: number;
  practiceTotals: {
    goalId: string;
    name: string;
    completedCount: number;
    minutesLogged: number;
  }[];
  strongestWeekLabel: string | null;
  mostConsistentPracticeName: string | null;
};

const MONTH_NAMES = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

function inclusiveDayCount(startDate: string, endDate: string): number {
  let count = 0;
  let cursor = startDate;
  while (cursor <= endDate) {
    count += 1;
    cursor = addLocalDays(cursor, 1);
  }
  return count;
}

function formatWeekDay(localDate: string): string {
  const [, month, day] = localDate.split("-").map(Number);
  return `${MONTH_NAMES[month - 1]} ${day}`;
}

function formatWeekLabel(monday: string): string {
  const sunday = addLocalDays(monday, 6);
  return `${formatWeekDay(monday)} – ${formatWeekDay(sunday)}`;
}

function strongestWeekLabel(
  cycle: Cycle,
  logs: SessionLog[],
): string | null {
  const inRange = logs.filter(
    (log) => log.localDate >= cycle.startDate && log.localDate <= cycle.endDate,
  );
  if (inRange.length === 0) {
    return null;
  }

  let bestMonday: string | null = null;
  let bestSessionCount = -1;
  let bestMinutes = -1;

  let monday = weekStart(cycle.startDate);
  const lastMonday = weekStart(cycle.endDate);

  while (monday <= lastMonday) {
    const sunday = addLocalDays(monday, 6);
    const weekStartBound = monday < cycle.startDate ? cycle.startDate : monday;
    const weekEndBound = sunday > cycle.endDate ? cycle.endDate : sunday;
    const weekLogs = inRange.filter(
      (log) => log.localDate >= weekStartBound && log.localDate <= weekEndBound,
    );
    const sessionCount = weekLogs.length;
    const minutes = weekLogs.reduce(
      (sum, log) => sum + (log.durationMinutes ?? 0),
      0,
    );

    const isBetter =
      sessionCount > bestSessionCount ||
      (sessionCount === bestSessionCount && minutes > bestMinutes) ||
      (sessionCount === bestSessionCount &&
        minutes === bestMinutes &&
        (bestMonday === null || monday < bestMonday));

    if (isBetter && sessionCount > 0) {
      bestMonday = monday;
      bestSessionCount = sessionCount;
      bestMinutes = minutes;
    }

    monday = addLocalDays(monday, 7);
  }

  return bestMonday === null ? null : formatWeekLabel(bestMonday);
}

export function buildCycleSummary(
  cycle: Cycle,
  goals: CycleGoal[],
  revisions: GoalRevision[],
  logs: SessionLog[],
): CycleAchievementSummary {
  const inRangeLogs = logs.filter(
    (log) => log.localDate >= cycle.startDate && log.localDate <= cycle.endDate,
  );

  const loggedDates = new Set(inRangeLogs.map((log) => log.localDate));

  const practiceTotals = goals.map((goal) => {
    const goalLogs = inRangeLogs.filter((log) => log.cycleGoalId === goal.id);
    const config = goalConfigurationOn(goal, revisions, cycle.endDate);
    return {
      goalId: goal.id,
      name: config.name,
      completedCount: goalLogs.length,
      minutesLogged: goalLogs.reduce(
        (sum, log) => sum + (log.durationMinutes ?? 0),
        0,
      ),
    };
  });

  let mostConsistentPracticeName: string | null = null;
  let bestCount = 0;
  for (const practice of practiceTotals) {
    if (practice.completedCount > bestCount) {
      bestCount = practice.completedCount;
      mostConsistentPracticeName = practice.name;
    }
  }
  if (bestCount === 0) {
    mostConsistentPracticeName = null;
  }

  return {
    activeDayCount: inclusiveDayCount(cycle.startDate, cycle.endDate),
    loggedDayCount: loggedDates.size,
    practiceTotals,
    strongestWeekLabel: strongestWeekLabel(cycle, logs),
    mostConsistentPracticeName,
  };
}
