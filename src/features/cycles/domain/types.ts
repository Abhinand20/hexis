export type CycleDurationDays = 30 | 60 | 90;

export type CycleStatus = "active" | "completed" | "ended_early";

export type Cycle = {
  id: string;
  name: string;
  startDate: string; // Local YYYY-MM-DD
  durationDays: CycleDurationDays;
  endDate: string; // Inclusive local YYYY-MM-DD
  status: CycleStatus;
  createdAt: string;
};

export type GoalCadence = "daily" | "weekly";

export type CycleGoal = {
  id: string;
  cycleId: string;
  name: string;
  cadence: GoalCadence;
  weeklyTargetCount: number;
  expectedDurationMinutes: number | null;
  createdAt: string;
};

export type GoalRevision = {
  id: string;
  cycleGoalId: string;
  effectiveDate: string;
  name: string;
  cadence: GoalCadence;
  weeklyTargetCount: number;
  expectedDurationMinutes: number | null;
};

export type SessionLog = {
  id: string;
  cycleGoalId: string;
  localDate: string;
  durationMinutes: number | null;
  createdAt: string;
};

export type GoalConfiguration = {
  name: string;
  cadence: GoalCadence;
  weeklyTargetCount: number;
  expectedDurationMinutes: number | null;
};
