import { addLocalDays, weekStart } from "./date";
import type {
  CycleGoal,
  GoalConfiguration,
  GoalRevision,
  SessionLog,
} from "./types";

export function goalConfigurationOn(
  goal: CycleGoal,
  revisions: GoalRevision[],
  date: string,
): GoalConfiguration {
  const applicable = revisions
    .filter((revision) => revision.cycleGoalId === goal.id && revision.effectiveDate <= date)
    .sort((a, b) => a.effectiveDate.localeCompare(b.effectiveDate));

  const active = applicable[applicable.length - 1];
  if (!active) {
    return {
      name: goal.name,
      cadence: goal.cadence,
      weeklyTargetCount: goal.weeklyTargetCount,
      expectedDurationMinutes: goal.expectedDurationMinutes,
    };
  }

  return {
    name: active.name,
    cadence: active.cadence,
    weeklyTargetCount: active.weeklyTargetCount,
    expectedDurationMinutes: active.expectedDurationMinutes,
  };
}

export function calculateGoalWeekProgress(
  goal: CycleGoal,
  revisions: GoalRevision[],
  logs: SessionLog[],
  today: string,
): {
  sessionCount: number;
  sessionTarget: number;
  minutesLogged: number;
  minutesTarget: number | null;
} {
  const start = weekStart(today);
  const end = addLocalDays(start, 6);
  const weekLogs = logs.filter(
    (log) =>
      log.cycleGoalId === goal.id &&
      log.localDate >= start &&
      log.localDate <= end,
  );

  const sessionCount = weekLogs.length;
  const minutesLogged = weekLogs.reduce(
    (sum, log) => sum + (log.durationMinutes ?? 0),
    0,
  );

  const config = goalConfigurationOn(goal, revisions, today);
  const sessionTarget = config.weeklyTargetCount;
  const minutesTarget =
    config.expectedDurationMinutes === null
      ? null
      : config.weeklyTargetCount * config.expectedDurationMinutes;

  return {
    sessionCount,
    sessionTarget,
    minutesLogged,
    minutesTarget,
  };
}

export function calendarDayIntensity(
  cycleGoals: CycleGoal[],
  logs: SessionLog[],
  localDate: string,
): 0 | 1 | 2 {
  if (cycleGoals.length === 0) {
    return 0;
  }

  const count = cycleGoals.filter((goal) =>
    logs.some((log) => log.cycleGoalId === goal.id && log.localDate === localDate),
  ).length;

  if (count === 0) {
    return 0;
  }

  return count / cycleGoals.length < 0.5 ? 1 : 2;
}
