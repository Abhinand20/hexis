import { goalConfigurationOn } from "./cycleProgress";
import { addLocalDays } from "./date";
import { findBusiestWeek, inclusiveDayCount } from "./cycleSummary";
import type { Cycle, CycleGoal, GoalRevision, SessionLog } from "./types";

export type WrapUpBusiestWeek = {
  weekStartDate: string;
  weekEndDate: string;
  sessions: number;
  recordedMinutes: number;
  isPartialWeek: boolean;
};

export type WrapUpMetrics = {
  cycleDays: number;
  sessions: number;
  recordedMinutes: number;
  sessionsWithRecordedDuration: number;
  activeDays: number;
  activityDayPercentage: number;
  sessionsPerWeek: number;
  recordedMinutesPerWeek: number;
  longestActiveDayRun: number;
  busiestWeek: WrapUpBusiestWeek | null;
  /** More than one entry means a genuine tie: label it "joint most-logged". */
  mostLoggedPractices: { goalId: string; name: string; sessions: number }[];
};

export type WrapUpComparison = {
  baseline: Cycle;
  selected: WrapUpMetrics;
  baselineMetrics: WrapUpMetrics;
  differences: {
    sessions: number;
    recordedMinutes: number;
    activeDays: number;
    activityDayPercentagePoints: number;
    sessionsPerWeek: number;
    recordedMinutesPerWeek: number;
  };
  hasDifferentLengths: boolean;
};

const FINISHED_STATUSES: ReadonlySet<Cycle["status"]> = new Set([
  "completed",
  "ended_early",
]);

function inRangeEffectiveSessions(
  cycle: Cycle,
  goals: CycleGoal[],
  effectiveSessions: SessionLog[],
): SessionLog[] {
  const goalIds = new Set(goals.map((goal) => goal.id));
  return effectiveSessions.filter(
    (session) =>
      goalIds.has(session.cycleGoalId) &&
      session.localDate >= cycle.startDate &&
      session.localDate <= cycle.endDate,
  );
}

function lastMembershipDateInCycle(goal: CycleGoal, cycle: Cycle): string {
  const lastActiveDay = goal.inactiveFromDate
    ? addLocalDays(goal.inactiveFromDate, -1)
    : cycle.endDate;
  const boundedEnd =
    lastActiveDay < cycle.endDate ? lastActiveDay : cycle.endDate;
  const boundedStart =
    goal.activeFromDate > cycle.startDate
      ? goal.activeFromDate
      : cycle.startDate;
  return boundedEnd < boundedStart ? boundedStart : boundedEnd;
}

function longestActiveDayRun(
  startDate: string,
  endDate: string,
  loggedDates: Set<string>,
): number {
  let longest = 0;
  let running = 0;
  let cursor = startDate;
  while (cursor <= endDate) {
    if (loggedDates.has(cursor)) {
      running += 1;
      longest = Math.max(longest, running);
    } else {
      running = 0;
    }
    cursor = addLocalDays(cursor, 1);
  }
  return longest;
}

function mostLoggedPractices(
  cycle: Cycle,
  goals: CycleGoal[],
  revisions: GoalRevision[],
  sessions: SessionLog[],
): WrapUpMetrics["mostLoggedPractices"] {
  if (sessions.length === 0) {
    return [];
  }

  const counts = new Map<string, number>();
  for (const session of sessions) {
    counts.set(session.cycleGoalId, (counts.get(session.cycleGoalId) ?? 0) + 1);
  }

  const ranked = goals
    .map((goal) => {
      const sessionCount = counts.get(goal.id) ?? 0;
      return {
        goalId: goal.id,
        name: goalConfigurationOn(
          goal,
          revisions,
          lastMembershipDateInCycle(goal, cycle),
        ).name,
        sessions: sessionCount,
      };
    })
    .filter((practice) => practice.sessions > 0)
    .sort(
      (left, right) =>
        right.sessions - left.sessions || left.goalId.localeCompare(right.goalId),
    );

  const topCount = ranked[0]?.sessions ?? 0;
  return ranked.filter((practice) => practice.sessions === topCount);
}

export function buildCycleWrapUp(
  cycle: Cycle,
  goals: CycleGoal[],
  revisions: GoalRevision[],
  effectiveSessions: SessionLog[],
): WrapUpMetrics {
  if (cycle.endDate < cycle.startDate) {
    throw new Error("Cycle end date is before start date");
  }

  const sessions = inRangeEffectiveSessions(cycle, goals, effectiveSessions);
  const cycleDays = inclusiveDayCount(cycle.startDate, cycle.endDate);
  const recordedSessions = sessions.filter(
    (session) => session.durationMinutes !== null,
  );
  const recordedMinutes = recordedSessions.reduce(
    (sum, session) => sum + (session.durationMinutes ?? 0),
    0,
  );
  const loggedDates = new Set(sessions.map((session) => session.localDate));
  const activeDays = loggedDates.size;
  const busiest = findBusiestWeek(cycle, sessions);

  return {
    cycleDays,
    sessions: sessions.length,
    recordedMinutes,
    sessionsWithRecordedDuration: recordedSessions.length,
    activeDays,
    activityDayPercentage: (activeDays / cycleDays) * 100,
    sessionsPerWeek: (sessions.length / cycleDays) * 7,
    recordedMinutesPerWeek: (recordedMinutes / cycleDays) * 7,
    longestActiveDayRun: longestActiveDayRun(
      cycle.startDate,
      cycle.endDate,
      loggedDates,
    ),
    busiestWeek:
      busiest === null
        ? null
        : {
            weekStartDate: busiest.weekStartDate,
            weekEndDate: busiest.weekEndDate,
            sessions: busiest.sessions,
            recordedMinutes: busiest.recordedMinutes,
            isPartialWeek: busiest.isPartialWeek,
          },
    mostLoggedPractices: mostLoggedPractices(
      cycle,
      goals,
      revisions,
      sessions,
    ),
  };
}

export function eligibleComparisonBaselines(
  allCycles: Cycle[],
  selected: Cycle,
): Cycle[] {
  return allCycles
    .filter(
      (cycle) =>
        cycle.id !== selected.id &&
        FINISHED_STATUSES.has(cycle.status) &&
        cycle.endDate < selected.startDate,
    )
    .sort(
      (left, right) =>
        right.endDate.localeCompare(left.endDate) ||
        right.startDate.localeCompare(left.startDate) ||
        left.id.localeCompare(right.id),
    );
}

export function buildWrapUpComparison(
  selected: WrapUpMetrics,
  baseline: Cycle,
  baselineMetrics: WrapUpMetrics,
  selectedCycle: Cycle,
): WrapUpComparison {
  return {
    baseline,
    selected,
    baselineMetrics,
    differences: {
      sessions: selected.sessions - baselineMetrics.sessions,
      recordedMinutes: selected.recordedMinutes - baselineMetrics.recordedMinutes,
      activeDays: selected.activeDays - baselineMetrics.activeDays,
      activityDayPercentagePoints:
        selected.activityDayPercentage - baselineMetrics.activityDayPercentage,
      sessionsPerWeek: selected.sessionsPerWeek - baselineMetrics.sessionsPerWeek,
      recordedMinutesPerWeek:
        selected.recordedMinutesPerWeek - baselineMetrics.recordedMinutesPerWeek,
    },
    hasDifferentLengths:
      inclusiveDayCount(selectedCycle.startDate, selectedCycle.endDate) !==
      inclusiveDayCount(baseline.startDate, baseline.endDate),
  };
}
