import { addLocalDays, weekStart } from "./date";
import type { Cycle, CycleGoal } from "./types";

export type GoalWeekMembership = "full" | "partial" | "inactive";

/** The single source of truth for inclusive-start/exclusive-end membership. */
export function isGoalActiveOn(
  goal: Pick<CycleGoal, "activeFromDate" | "inactiveFromDate">,
  localDate: string,
): boolean {
  return (
    localDate >= goal.activeFromDate &&
    (goal.inactiveFromDate === null || localDate < goal.inactiveFromDate)
  );
}

/**
 * Classifies membership over only the days where this calendar week and the
 * cycle overlap. A cycle that starts mid-week can therefore still have a full
 * first week for goals that were present from the cycle start.
 */
export function goalMembershipForWeek(
  goal: CycleGoal,
  cycle: Cycle,
  monday: string,
): GoalWeekMembership {
  const normalizedMonday = weekStart(monday);
  const sunday = addLocalDays(normalizedMonday, 6);
  const firstDay = normalizedMonday < cycle.startDate
    ? cycle.startDate
    : normalizedMonday;
  const lastDay = sunday > cycle.endDate ? cycle.endDate : sunday;

  if (lastDay < firstDay) {
    return "inactive";
  }

  let activeDays = 0;
  let totalDays = 0;
  let cursor = firstDay;
  while (cursor <= lastDay) {
    totalDays += 1;
    if (isGoalActiveOn(goal, cursor)) {
      activeDays += 1;
    }
    cursor = addLocalDays(cursor, 1);
  }

  if (activeDays === 0) {
    return "inactive";
  }
  return activeDays === totalDays ? "full" : "partial";
}
