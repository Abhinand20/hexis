import { goalConfigurationOn } from "./cycleProgress";
import { addLocalDays } from "./date";
import { isGoalActiveOn } from "./goalMembership";
import type {
  Cycle,
  CycleDurationDays,
  CycleGoal,
  GoalConfiguration,
  GoalRevision,
} from "./types";

export type RepeatCycleDraft = {
  cycleName: string;
  durationDays: CycleDurationDays;
  practices: GoalConfiguration[];
};

export type RepeatCycleDraftFailureReason =
  | "source-cycle-not-ended"
  | "invalid-source"
  | "no-final-practices";

export type RepeatCycleDraftResult =
  | { ok: true; draft: RepeatCycleDraft }
  | { ok: false; reason: RepeatCycleDraftFailureReason };

const supportedDurations = new Set<CycleDurationDays>([30, 60, 90]);

function isValidLocalDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return false;
  }

  try {
    return addLocalDays(value, 0) === value;
  } catch {
    return false;
  }
}

function isValidSourceCycle(cycle: Cycle): boolean {
  return (
    cycle.name.trim().length > 0 &&
    supportedDurations.has(cycle.durationDays) &&
    isValidLocalDate(cycle.startDate) &&
    isValidLocalDate(cycle.endDate) &&
    cycle.endDate >= cycle.startDate
  );
}

function isValidGoal(goal: CycleGoal, cycle: Cycle): boolean {
  return (
    isValidLocalDate(goal.activeFromDate) &&
    goal.activeFromDate >= cycle.startDate &&
    goal.activeFromDate <= cycle.endDate &&
    (goal.inactiveFromDate === null ||
      (isValidLocalDate(goal.inactiveFromDate) &&
        goal.inactiveFromDate > goal.activeFromDate &&
        goal.inactiveFromDate <= cycle.endDate))
  );
}

function isValidConfiguration(configuration: GoalConfiguration): boolean {
  return (
    configuration.name.trim().length > 0 &&
    (configuration.cadence === "daily" ||
      configuration.cadence === "weekly") &&
    Number.isInteger(configuration.weeklyTargetCount) &&
    configuration.weeklyTargetCount > 0 &&
    (configuration.expectedDurationMinutes === null ||
      (Number.isInteger(configuration.expectedDurationMinutes) &&
        configuration.expectedDurationMinutes > 0))
  );
}

/**
 * Builds setup-only prefill from the configuration that was active when an
 * ended cycle finished. The result intentionally contains no persisted IDs,
 * membership dates, activity, revision, reminder, or status metadata.
 */
export function buildRepeatCycleDraft(
  sourceCycle: Cycle,
  sourceGoals: CycleGoal[],
  sourceRevisions: GoalRevision[],
): RepeatCycleDraftResult {
  if (
    sourceCycle.status !== "completed" &&
    sourceCycle.status !== "ended_early"
  ) {
    return { ok: false, reason: "source-cycle-not-ended" };
  }
  if (!isValidSourceCycle(sourceCycle)) {
    return { ok: false, reason: "invalid-source" };
  }

  const cycleGoals = sourceGoals.filter(
    (goal) => goal.cycleId === sourceCycle.id,
  );
  if (cycleGoals.some((goal) => !isValidGoal(goal, sourceCycle))) {
    return { ok: false, reason: "invalid-source" };
  }

  const finalGoals = cycleGoals
    .filter((goal) => isGoalActiveOn(goal, sourceCycle.endDate))
    .sort(
      (left, right) =>
        left.createdAt.localeCompare(right.createdAt) ||
        left.id.localeCompare(right.id),
    );

  if (finalGoals.length === 0) {
    return { ok: false, reason: "no-final-practices" };
  }

  const practices = finalGoals.map((goal) =>
    goalConfigurationOn(goal, sourceRevisions, sourceCycle.endDate),
  );
  if (!practices.every(isValidConfiguration)) {
    return { ok: false, reason: "invalid-source" };
  }

  return {
    ok: true,
    draft: {
      cycleName: sourceCycle.name,
      durationDays: sourceCycle.durationDays,
      practices: practices.map((practice) => ({ ...practice })),
    },
  };
}
