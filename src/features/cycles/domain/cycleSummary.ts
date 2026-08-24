import {
  calculateGoalWeekProgress,
  goalConfigurationOn,
} from "./cycleProgress";
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

export type DayPracticeStatus = {
  goalId: string;
  name: string;
  logged: boolean;
  minutesLogged: number | null;
  expectedDurationMinutes: number | null;
};

export type DaySessionEntry = {
  id: string;
  cycleGoalId: string;
  practiceName: string;
  startedAt: string;
  durationMinutes: number | null;
};

export type DaySummary = {
  localDate: string;
  sessionCount: number;
  minutesLogged: number;
  practices: DayPracticeStatus[];
  sessions: DaySessionEntry[];
};

export type WeekPracticeProgress = {
  goalId: string;
  name: string;
  sessionCount: number;
  sessionTarget: number;
  minutesLogged: number;
  minutesTarget: number | null;
  met: boolean;
};

export type WeekStrongestDay = {
  localDate: string;
  completedGoalCount: number;
  minutesLogged: number;
} | null;

export type WeekSummary = {
  weekStartDate: string;
  weekEndDate: string;
  sessionCount: number;
  minutesLogged: number;
  practiceProgress: WeekPracticeProgress[];
  strongestDay: WeekStrongestDay;
  missedTargetGoalNames: string[];
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

export function buildDaySummary(
  goals: CycleGoal[],
  revisions: GoalRevision[],
  logs: SessionLog[],
  localDate: string,
): DaySummary {
  const practices = goals.map((goal) => {
    const config = goalConfigurationOn(goal, revisions, localDate);
    const dayLogs = logs.filter(
      (log) => log.cycleGoalId === goal.id && log.localDate === localDate,
    );
    const logged = dayLogs.length > 0;
    return {
      goalId: goal.id,
      name: config.name,
      logged,
      minutesLogged: logged
        ? dayLogs.reduce((sum, log) => sum + (log.durationMinutes ?? 0), 0)
        : null,
      expectedDurationMinutes: config.expectedDurationMinutes,
    };
  });

  const goalsById = new Map(goals.map((goal) => [goal.id, goal]));
  const sessions = logs
    .filter((log) => log.localDate === localDate)
    .map((log) => {
      const goal = goalsById.get(log.cycleGoalId);
      return {
        id: log.id,
        cycleGoalId: log.cycleGoalId,
        practiceName: goal
          ? goalConfigurationOn(goal, revisions, localDate).name
          : "Unknown practice",
        startedAt: log.startedAt,
        durationMinutes: log.durationMinutes,
      };
    })
    .sort(
      (left, right) =>
        Date.parse(left.startedAt) - Date.parse(right.startedAt) ||
        left.id.localeCompare(right.id),
    );

  return {
    localDate,
    sessionCount: sessions.length,
    minutesLogged: sessions.reduce(
      (total, session) => total + (session.durationMinutes ?? 0),
      0,
    ),
    practices,
    sessions,
  };
}

export function buildWeekSummary(
  goals: CycleGoal[],
  revisions: GoalRevision[],
  logs: SessionLog[],
  weekStartDate: string,
): WeekSummary {
  const monday = weekStart(weekStartDate);
  const weekEndDate = addLocalDays(monday, 6);

  const practiceProgress: WeekPracticeProgress[] = goals.map((goal) => {
    const progress = calculateGoalWeekProgress(goal, revisions, logs, monday);
    const name = goalConfigurationOn(goal, revisions, monday).name;
    return {
      goalId: goal.id,
      name,
      sessionCount: progress.sessionCount,
      sessionTarget: progress.sessionTarget,
      minutesLogged: progress.minutesLogged,
      minutesTarget: progress.minutesTarget,
      met: progress.sessionCount >= progress.sessionTarget,
    };
  });

  const sessionCount = practiceProgress.reduce(
    (sum, practice) => sum + practice.sessionCount,
    0,
  );
  const minutesLogged = practiceProgress.reduce(
    (sum, practice) => sum + practice.minutesLogged,
    0,
  );
  const missedTargetGoalNames = practiceProgress
    .filter((practice) => !practice.met)
    .map((practice) => practice.name);

  const goalIds = new Set(goals.map((goal) => goal.id));
  let strongestDay: WeekStrongestDay = null;

  for (let offset = 0; offset < 7; offset += 1) {
    const localDate = addLocalDays(monday, offset);
    const dayLogs = logs.filter((log) => log.localDate === localDate);
    const completedGoalIds = new Set(
      dayLogs
        .filter((log) => goalIds.has(log.cycleGoalId))
        .map((log) => log.cycleGoalId),
    );
    const completedGoalCount = completedGoalIds.size;
    const dayMinutes = dayLogs.reduce(
      (sum, log) => sum + (log.durationMinutes ?? 0),
      0,
    );

    if (completedGoalCount === 0) {
      continue;
    }

    const isBetter =
      strongestDay === null ||
      completedGoalCount > strongestDay.completedGoalCount ||
      (completedGoalCount === strongestDay.completedGoalCount &&
        dayMinutes > strongestDay.minutesLogged) ||
      (completedGoalCount === strongestDay.completedGoalCount &&
        dayMinutes === strongestDay.minutesLogged &&
        localDate < strongestDay.localDate);

    if (isBetter) {
      strongestDay = {
        localDate,
        completedGoalCount,
        minutesLogged: dayMinutes,
      };
    }
  }

  return {
    weekStartDate: monday,
    weekEndDate,
    sessionCount,
    minutesLogged,
    practiceProgress,
    strongestDay,
    missedTargetGoalNames,
  };
}
