import { calculateGoalStreak, goalConfigurationOn } from "./cycleProgress";
import { addLocalDays, weekStart } from "./date";
import type { Cycle, CycleGoal, GoalRevision, SessionLog } from "./types";

export type HistoryTrendWeek = {
  weekStartDate: string;
  weekEndDate: string;
  sessionCount: number;
  minutesLogged: number;
  targetCount: number;
  completionRatio: number;
  isInProgress: boolean;
};

export type HistoryPracticeInsight = {
  goalId: string;
  name: string;
  cadence: CycleGoal["cadence"];
  sessionCount: number;
  minutesLogged: number;
  targetCount: number;
  completionRatio: number;
  currentStreak: number;
};

export type HistoryInsights = {
  throughDate: string;
  elapsedDayCount: number;
  remainingDayCount: number;
  sessionCount: number;
  minutesLogged: number;
  loggedDayCount: number;
  activeDayRatio: number;
  currentEffortStreak: number;
  longestEffortStreak: number;
  sessionDeltaFromPreviousWeek: number | null;
  trend: HistoryTrendWeek[];
  practices: HistoryPracticeInsight[];
};

function inclusiveDayCount(startDate: string, endDate: string): number {
  if (endDate < startDate) {
    return 0;
  }

  let count = 0;
  let cursor = startDate;
  while (cursor <= endDate) {
    count += 1;
    cursor = addLocalDays(cursor, 1);
  }
  return count;
}

function boundedThroughDate(cycle: Cycle, today: string): string {
  if (today < cycle.startDate) {
    return cycle.startDate;
  }
  return today > cycle.endDate ? cycle.endDate : today;
}

function effortStreaks(
  loggedDates: Set<string>,
  startDate: string,
  throughDate: string,
): { current: number; longest: number } {
  let longest = 0;
  let running = 0;
  let cursor = startDate;

  while (cursor <= throughDate) {
    if (loggedDates.has(cursor)) {
      running += 1;
      longest = Math.max(longest, running);
    } else {
      running = 0;
    }
    cursor = addLocalDays(cursor, 1);
  }

  cursor = throughDate;
  if (!loggedDates.has(cursor)) {
    cursor = addLocalDays(cursor, -1);
  }

  let current = 0;
  while (cursor >= startDate && loggedDates.has(cursor)) {
    current += 1;
    cursor = addLocalDays(cursor, -1);
  }

  return { current, longest };
}

function buildTrend(
  cycle: Cycle,
  goals: CycleGoal[],
  revisions: GoalRevision[],
  logs: SessionLog[],
  throughDate: string,
  today: string,
): HistoryTrendWeek[] {
  const weeks: HistoryTrendWeek[] = [];
  let monday = weekStart(cycle.startDate);
  const lastMonday = weekStart(throughDate);

  while (monday <= lastMonday) {
    const sunday = addLocalDays(monday, 6);
    const rangeStart = monday < cycle.startDate ? cycle.startDate : monday;
    const rangeEnd = sunday > throughDate ? throughDate : sunday;
    const weekLogs = logs.filter(
      (log) => log.localDate >= rangeStart && log.localDate <= rangeEnd,
    );
    const targetDate = sunday > cycle.endDate ? cycle.endDate : sunday;
    let completedTowardTarget = 0;
    let targetCount = 0;

    for (const goal of goals) {
      const target = goalConfigurationOn(goal, revisions, targetDate).weeklyTargetCount;
      const sessionCount = weekLogs.filter((log) => log.cycleGoalId === goal.id).length;
      targetCount += target;
      completedTowardTarget += Math.min(sessionCount, target);
    }

    weeks.push({
      weekStartDate: monday,
      weekEndDate: sunday,
      sessionCount: weekLogs.length,
      minutesLogged: weekLogs.reduce(
        (sum, log) => sum + (log.durationMinutes ?? 0),
        0,
      ),
      targetCount,
      completionRatio: targetCount === 0 ? 0 : completedTowardTarget / targetCount,
      isInProgress: monday === weekStart(today) && today <= cycle.endDate,
    });

    monday = addLocalDays(monday, 7);
  }

  return weeks;
}

export function buildHistoryInsights(
  cycle: Cycle,
  goals: CycleGoal[],
  revisions: GoalRevision[],
  logs: SessionLog[],
  today: string,
): HistoryInsights {
  const throughDate = boundedThroughDate(cycle, today);
  const inRangeLogs = logs.filter(
    (log) => log.localDate >= cycle.startDate && log.localDate <= throughDate,
  );
  const loggedDates = new Set(inRangeLogs.map((log) => log.localDate));
  const elapsedDayCount = inclusiveDayCount(cycle.startDate, throughDate);
  const totalDayCount = inclusiveDayCount(cycle.startDate, cycle.endDate);
  const trend = buildTrend(cycle, goals, revisions, inRangeLogs, throughDate, today);
  const streaks = effortStreaks(loggedDates, cycle.startDate, throughDate);
  const sessionDeltaFromPreviousWeek =
    trend.length < 2
      ? null
      : trend[trend.length - 1].sessionCount - trend[trend.length - 2].sessionCount;

  const practices = goals.map((goal) => {
    const goalLogs = inRangeLogs.filter((log) => log.cycleGoalId === goal.id);
    let completedTowardTarget = 0;
    let targetCount = 0;

    for (const week of trend) {
      const target = goalConfigurationOn(
        goal,
        revisions,
        week.weekEndDate > cycle.endDate ? cycle.endDate : week.weekEndDate,
      ).weeklyTargetCount;
      const rangeStart = week.weekStartDate < cycle.startDate
        ? cycle.startDate
        : week.weekStartDate;
      const rangeEnd = week.weekEndDate > throughDate ? throughDate : week.weekEndDate;
      const weekSessionCount = goalLogs.filter(
        (log) => log.localDate >= rangeStart && log.localDate <= rangeEnd,
      ).length;
      targetCount += target;
      completedTowardTarget += Math.min(weekSessionCount, target);
    }

    const currentConfig = goalConfigurationOn(goal, revisions, throughDate);
    const streakGoal = { ...goal, cadence: currentConfig.cadence };
    return {
      goalId: goal.id,
      name: currentConfig.name,
      cadence: currentConfig.cadence,
      sessionCount: goalLogs.length,
      minutesLogged: goalLogs.reduce(
        (sum, log) => sum + (log.durationMinutes ?? 0),
        0,
      ),
      targetCount,
      completionRatio: targetCount === 0 ? 0 : completedTowardTarget / targetCount,
      currentStreak: calculateGoalStreak(
        streakGoal,
        revisions,
        inRangeLogs,
        throughDate,
      ),
    };
  });

  return {
    throughDate,
    elapsedDayCount,
    remainingDayCount: Math.max(0, totalDayCount - elapsedDayCount),
    sessionCount: inRangeLogs.length,
    minutesLogged: inRangeLogs.reduce(
      (sum, log) => sum + (log.durationMinutes ?? 0),
      0,
    ),
    loggedDayCount: loggedDates.size,
    activeDayRatio: elapsedDayCount === 0 ? 0 : loggedDates.size / elapsedDayCount,
    currentEffortStreak: streaks.current,
    longestEffortStreak: streaks.longest,
    sessionDeltaFromPreviousWeek,
    trend,
    practices,
  };
}
