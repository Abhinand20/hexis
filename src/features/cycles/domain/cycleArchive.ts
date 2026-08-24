import { goalConfigurationOn } from "./cycleProgress";
import { addLocalDays } from "./date";
import { isGoalActiveOn } from "./goalMembership";
import type {
  Cycle,
  CycleGoal,
  GoalRevision,
  SessionLog,
} from "./types";

export type CycleArchiveItem = {
  id: string;
  name: string;
  dateRange: string;
  status: Cycle["status"];
  sessionCount: number;
  minutesLogged: number;
  activeDayRatio: number;
  practiceCount: number;
  practiceNames: string[];
};

export type BuildCycleArchiveItemsInput = {
  cycles: Cycle[];
  goals: CycleGoal[];
  revisions: GoalRevision[];
  /** Already-resolved effective logs; superseded revisions stay upstream. */
  effectiveLogs: SessionLog[];
  today: string;
};

const MONTH_NAMES = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
] as const;

function dateParts(localDate: string): {
  year: number;
  month: number;
  day: number;
} {
  const [year, month, day] = localDate.split("-").map(Number);
  return { year, month, day };
}

/** Formats a local-date range without relying on the device locale or timezone. */
export function formatCycleDateRange(
  startDate: string,
  endDate: string,
): string {
  const start = dateParts(startDate);
  const end = dateParts(endDate);
  const startLabel = `${MONTH_NAMES[start.month - 1]} ${start.day}`;
  const endLabel = `${MONTH_NAMES[end.month - 1]} ${end.day}`;

  return start.year === end.year
    ? `${startLabel}–${endLabel}, ${end.year}`
    : `${startLabel}, ${start.year}–${endLabel}, ${end.year}`;
}

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

function archiveOrder(left: Cycle, right: Cycle): number {
  const leftActive = left.status === "active" ? 0 : 1;
  const rightActive = right.status === "active" ? 0 : 1;

  return (
    leftActive - rightActive ||
    right.startDate.localeCompare(left.startDate) ||
    right.createdAt.localeCompare(left.createdAt) ||
    right.id.localeCompare(left.id)
  );
}

function goalOrder(left: CycleGoal, right: CycleGoal): number {
  return (
    left.createdAt.localeCompare(right.createdAt) ||
    left.id.localeCompare(right.id)
  );
}

function cycleThroughDate(cycle: Cycle, today: string): string | null {
  if (cycle.status !== "active") {
    return cycle.endDate;
  }
  if (today < cycle.startDate) {
    return null;
  }
  return today > cycle.endDate ? cycle.endDate : today;
}

export function buildCycleArchiveItems({
  cycles,
  goals,
  revisions,
  effectiveLogs,
  today,
}: BuildCycleArchiveItemsInput): CycleArchiveItem[] {
  return [...cycles].sort(archiveOrder).map((cycle) => {
    const throughDate = cycleThroughDate(cycle, today);
    const relevantDate = throughDate ?? cycle.startDate;
    const cycleGoals = goals
      .filter((goal) => goal.cycleId === cycle.id)
      .sort(goalOrder);
    const cycleGoalIds = new Set(cycleGoals.map((goal) => goal.id));
    const cycleLogs =
      throughDate === null
        ? []
        : effectiveLogs.filter(
            (log) =>
              cycleGoalIds.has(log.cycleGoalId) &&
              log.localDate >= cycle.startDate &&
              log.localDate <= throughDate,
          );
    const finalPractices = cycleGoals.filter((goal) =>
      isGoalActiveOn(goal, relevantDate),
    );
    const practiceNames = finalPractices.map(
      (goal) => goalConfigurationOn(goal, revisions, relevantDate).name,
    );
    const elapsedDayCount =
      throughDate === null
        ? 0
        : inclusiveDayCount(cycle.startDate, throughDate);
    const activeDayCount = new Set(cycleLogs.map((log) => log.localDate)).size;

    return {
      id: cycle.id,
      name: cycle.name,
      dateRange: formatCycleDateRange(cycle.startDate, cycle.endDate),
      status: cycle.status,
      sessionCount: cycleLogs.length,
      minutesLogged: cycleLogs.reduce(
        (total, log) => total + (log.durationMinutes ?? 0),
        0,
      ),
      activeDayRatio:
        elapsedDayCount === 0 ? 0 : activeDayCount / elapsedDayCount,
      practiceCount: practiceNames.length,
      practiceNames,
    };
  });
}
