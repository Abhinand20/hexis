import { calculateGoalStreak, goalConfigurationOn } from "./cycleProgress";
import { addLocalDays, weekStart } from "./date";
import {
  goalMembershipForWeek,
  type GoalWeekMembership,
} from "./goalMembership";
import type {
  Cycle,
  CycleGoal,
  GoalCadence,
  GoalRevision,
  SessionLog,
} from "./types";

export type HomeDashboardMetric = {
  /** All effective work in the bounded current week, including partial goals. */
  logged: number;
  /** Denominator from full-membership goals only, or null when none exists. */
  target: number | null;
  /** Sum of each eligible goal's uncross-subsidized remainder. */
  remaining: number | null;
  /** Eligible progress capped to the inclusive 0...1 range. */
  progressRatio: number | null;
};

export type HomeDashboardRecentDay = {
  localDate: string;
  sessionCount: number;
  minutesLogged: number;
};

export type HomeDashboardPracticeState =
  | "met"
  | "in_progress"
  | "partial_week";

export type HomeDashboardPractice = {
  goalId: string;
  name: string;
  cadence: GoalCadence;
  expectedDurationMinutes: number | null;
  membership: GoalWeekMembership;
  state: HomeDashboardPracticeState;
  sessionCount: number;
  sessionTarget: number | null;
  sessionRemaining: number | null;
  sessionProgressRatio: number | null;
  minutesLogged: number;
  minutesTarget: number | null;
  minutesRemaining: number | null;
  minutesProgressRatio: number | null;
  currentStreak: number;
  /** Latest effective session first, then stable id order. */
  todaySessions: SessionLog[];
};

export type HomeDashboardSummary = {
  /** The date through which cycle progress is derived, clamped to the cycle. */
  throughDate: string;
  week: {
    startDate: string;
    endDate: string;
    /** Calendar days after `today` in the bounded week; zero on its last day. */
    calendarDaysRemaining: number;
  };
  totals: {
    sessionCount: number;
    minutesLogged: number;
  };
  sessions: HomeDashboardMetric;
  minutes: HomeDashboardMetric;
  previousWeekSessionDelta: number | null;
  /** Always seven consecutive calendar buckets ending at `throughDate`. */
  recentDays: HomeDashboardRecentDay[];
  hasPartialMembership: boolean;
  /** Relevant practices retain their order from the `goals` input. */
  practices: HomeDashboardPractice[];
  /** Effective sessions on the actual `today`, latest first. */
  todaySessions: SessionLog[];
};

export type BuildHomeDashboardSummaryInput = {
  cycle: Cycle;
  goals: CycleGoal[];
  revisions: GoalRevision[];
  /** Already-resolved effective logs; tombstones and superseded snapshots stay upstream. */
  effectiveLogs: SessionLog[];
  today: string;
};

function minDate(left: string, right: string): string {
  return left < right ? left : right;
}

function maxDate(left: string, right: string): string {
  return left > right ? left : right;
}

function inclusiveDayDifference(startDate: string, endDate: string): number {
  if (endDate <= startDate) {
    return 0;
  }

  let count = 0;
  let cursor = startDate;
  while (cursor < endDate) {
    count += 1;
    cursor = addLocalDays(cursor, 1);
  }
  return count;
}

function sumMinutes(logs: SessionLog[]): number {
  return logs.reduce((total, log) => total + (log.durationMinutes ?? 0), 0);
}

function latestFirst(left: SessionLog, right: SessionLog): number {
  return (
    Date.parse(right.startedAt) - Date.parse(left.startedAt) ||
    left.id.localeCompare(right.id)
  );
}

function cappedRatio(completed: number, target: number): number {
  if (target <= 0) {
    return 0;
  }
  return Math.max(0, Math.min(1, completed / target));
}

function emptyTargetMetric(logged: number): HomeDashboardMetric {
  return {
    logged,
    target: null,
    remaining: null,
    progressRatio: null,
  };
}

export function buildHomeDashboardSummary({
  cycle,
  goals,
  revisions,
  effectiveLogs,
  today,
}: BuildHomeDashboardSummaryInput): HomeDashboardSummary {
  const throughDate = maxDate(cycle.startDate, minDate(today, cycle.endDate));
  const monday = weekStart(throughDate);
  const weekStartDate = maxDate(cycle.startDate, monday);
  const weekEndDate = minDate(cycle.endDate, addLocalDays(monday, 6));
  const cycleHasStarted = today >= cycle.startDate;
  const cycleHasEnded = today > cycle.endDate;
  const goalIds = new Set(goals.map((goal) => goal.id));
  const inCycleLogs = effectiveLogs.filter(
    (log) =>
      goalIds.has(log.cycleGoalId) &&
      log.localDate >= cycle.startDate &&
      log.localDate <= cycle.endDate,
  );
  const visibleLogs = cycleHasStarted
    ? inCycleLogs.filter((log) => log.localDate <= throughDate)
    : [];
  const weekLogs = visibleLogs.filter(
    (log) => log.localDate >= weekStartDate && log.localDate <= weekEndDate,
  );

  let eligibleSessionTarget = 0;
  let eligibleSessionRemaining = 0;
  let eligibleSessionCredit = 0;
  let eligibleMinutesTarget = 0;
  let eligibleMinutesRemaining = 0;
  let eligibleMinutesCredit = 0;
  let eligibleMinuteGoalCount = 0;

  const practices = goals.flatMap<HomeDashboardPractice>((goal) => {
    const membership = goalMembershipForWeek(goal, cycle, monday);
    const goalWeekLogs = weekLogs.filter((log) => log.cycleGoalId === goal.id);

    // Home keeps current/partial practices and any inactive practice that still
    // has effective work in the week (for example, a grandfathered correction).
    if (membership === "inactive" && goalWeekLogs.length === 0) {
      return [];
    }

    const config = goalConfigurationOn(goal, revisions, throughDate);
    const sessionCount = goalWeekLogs.length;
    const minutesLogged = sumMinutes(goalWeekLogs);
    const eligible = membership === "full";
    const sessionTarget = eligible ? config.weeklyTargetCount : null;
    const sessionRemaining =
      sessionTarget === null ? null : Math.max(0, sessionTarget - sessionCount);
    const sessionProgressRatio =
      sessionTarget === null ? null : cappedRatio(sessionCount, sessionTarget);
    const minutesTarget =
      eligible && config.expectedDurationMinutes !== null
        ? config.weeklyTargetCount * config.expectedDurationMinutes
        : null;
    const minutesRemaining =
      minutesTarget === null ? null : Math.max(0, minutesTarget - minutesLogged);
    const minutesProgressRatio =
      minutesTarget === null ? null : cappedRatio(minutesLogged, minutesTarget);

    if (sessionTarget !== null) {
      eligibleSessionTarget += sessionTarget;
      eligibleSessionRemaining += sessionRemaining ?? 0;
      eligibleSessionCredit += Math.min(sessionCount, sessionTarget);
    }
    if (minutesTarget !== null) {
      eligibleMinuteGoalCount += 1;
      eligibleMinutesTarget += minutesTarget;
      eligibleMinutesRemaining += minutesRemaining ?? 0;
      eligibleMinutesCredit += Math.min(minutesLogged, minutesTarget);
    }

    const streakGoal = { ...goal, cadence: config.cadence };
    const todaySessions = visibleLogs
      .filter(
        (log) => log.cycleGoalId === goal.id && log.localDate === today,
      )
      .sort(latestFirst);

    return [
      {
        goalId: goal.id,
        name: config.name,
        cadence: config.cadence,
        expectedDurationMinutes: config.expectedDurationMinutes,
        membership,
        state:
          membership !== "full"
            ? "partial_week"
            : sessionCount >= config.weeklyTargetCount
              ? "met"
              : "in_progress",
        sessionCount,
        sessionTarget,
        sessionRemaining,
        sessionProgressRatio,
        minutesLogged,
        minutesTarget,
        minutesRemaining,
        minutesProgressRatio,
        currentStreak: calculateGoalStreak(
          streakGoal,
          revisions,
          visibleLogs,
          throughDate,
          cycle,
        ),
        todaySessions,
      },
    ];
  });

  const rawSessionCount = weekLogs.length;
  const rawMinutesLogged = sumMinutes(weekLogs);
  const sessions =
    eligibleSessionTarget === 0
      ? emptyTargetMetric(rawSessionCount)
      : {
          logged: rawSessionCount,
          target: eligibleSessionTarget,
          remaining: eligibleSessionRemaining,
          progressRatio: cappedRatio(
            eligibleSessionCredit,
            eligibleSessionTarget,
          ),
        };
  const minutes =
    eligibleMinuteGoalCount === 0
      ? emptyTargetMetric(rawMinutesLogged)
      : {
          logged: rawMinutesLogged,
          target: eligibleMinutesTarget,
          remaining: eligibleMinutesRemaining,
          progressRatio: cappedRatio(
            eligibleMinutesCredit,
            eligibleMinutesTarget,
          ),
        };

  const previousMonday = addLocalDays(monday, -7);
  const previousSunday = addLocalDays(previousMonday, 6);
  const hasComparablePreviousWeek = previousSunday >= cycle.startDate;
  const previousWeekSessionCount = hasComparablePreviousWeek
    ? visibleLogs.filter(
        (log) =>
          log.localDate >= maxDate(previousMonday, cycle.startDate) &&
          log.localDate <= minDate(previousSunday, cycle.endDate),
      ).length
    : 0;

  const recentDays = Array.from({ length: 7 }, (_, index) => {
    const localDate = addLocalDays(throughDate, index - 6);
    const dayLogs = visibleLogs.filter((log) => log.localDate === localDate);
    return {
      localDate,
      sessionCount: dayLogs.length,
      minutesLogged: sumMinutes(dayLogs),
    };
  });

  const todaySessions =
    cycleHasStarted && !cycleHasEnded
      ? visibleLogs.filter((log) => log.localDate === today).sort(latestFirst)
      : [];

  return {
    throughDate,
    week: {
      startDate: weekStartDate,
      endDate: weekEndDate,
      calendarDaysRemaining: cycleHasEnded
        ? 0
        : inclusiveDayDifference(throughDate, weekEndDate),
    },
    totals: {
      sessionCount: rawSessionCount,
      minutesLogged: rawMinutesLogged,
    },
    sessions,
    minutes,
    previousWeekSessionDelta: hasComparablePreviousWeek
      ? rawSessionCount - previousWeekSessionCount
      : null,
    recentDays,
    hasPartialMembership: practices.some(
      (practice) => practice.membership === "partial",
    ),
    practices,
    todaySessions,
  };
}
