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
