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

/**
 * Current streak for a goal, ending at (and possibly including) `today`.
 *
 * Daily-cadence goals streak by consecutive calendar days with a log.
 * Weekly-cadence goals streak by consecutive weeks whose session count met
 * that week's target. In both cases the in-progress unit (today, or the
 * current week) never *breaks* a streak just because it isn't finished yet;
 * it only extends the streak once it is itself satisfied. Walking backward
 * naturally terminates once it reaches days/weeks before the goal existed,
 * since there are no logs to satisfy the streak there.
 */
export function calculateGoalStreak(
  goal: CycleGoal,
  revisions: GoalRevision[],
  logs: SessionLog[],
  today: string,
): number {
  const goalLogs = logs.filter((log) => log.cycleGoalId === goal.id);
  return goal.cadence === "daily"
    ? calculateDailyStreak(goalLogs, today)
    : calculateWeeklyStreak(goal, revisions, goalLogs, today);
}

function calculateDailyStreak(goalLogs: SessionLog[], today: string): number {
  const loggedDates = new Set(goalLogs.map((log) => log.localDate));

  let cursor = today;
  if (!loggedDates.has(cursor)) {
    // Today isn't over yet; a missing log today doesn't break the streak.
    cursor = addLocalDays(cursor, -1);
  }

  let streak = 0;
  while (loggedDates.has(cursor)) {
    streak += 1;
    cursor = addLocalDays(cursor, -1);
  }
  return streak;
}

function calculateWeeklyStreak(
  goal: CycleGoal,
  revisions: GoalRevision[],
  goalLogs: SessionLog[],
  today: string,
): number {
  let streak = 0;
  let cursor = weekStart(today);
  let isCurrentWeek = true;

  while (true) {
    const start = cursor;
    const end = addLocalDays(start, 6);
    const sessionCount = goalLogs.filter(
      (log) => log.localDate >= start && log.localDate <= end,
    ).length;
    const target = goalConfigurationOn(goal, revisions, end).weeklyTargetCount;
    const met = sessionCount >= target;

    if (isCurrentWeek) {
      isCurrentWeek = false;
      if (!met) {
        // This week isn't over yet; falling short so far doesn't break the
        // streak, it just isn't counted until it's actually met.
        cursor = addLocalDays(cursor, -7);
        continue;
      }
    } else if (!met) {
      break;
    }

    streak += 1;
    cursor = addLocalDays(cursor, -7);
  }

  return streak;
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
