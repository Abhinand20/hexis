import type { Cycle } from "../features/cycles/domain/types";
import type { CreateCycleInput } from "../features/cycles/data/cycleRepository";

export function createCycle(overrides: Partial<Cycle> = {}): Cycle {
  return {
    id: "cycle-1",
    name: "Test Cycle",
    startDate: "2026-07-24",
    durationDays: 30,
    endDate: "2026-08-22",
    status: "active",
    createdAt: "2026-07-24T00:00:00.000Z",
    ...overrides,
  };
}

export function createCycleInput(
  overrides: Partial<CreateCycleInput> = {},
): CreateCycleInput {
  return {
    name: "Summer Focus",
    startDate: "2026-07-01",
    durationDays: 30,
    goals: [
      {
        name: "Write",
        cadence: "daily",
        weeklyTargetCount: 5,
        expectedDurationMinutes: 30,
      },
      {
        name: "Run",
        cadence: "weekly",
        weeklyTargetCount: 3,
        expectedDurationMinutes: 45,
      },
      {
        name: "Read",
        cadence: "daily",
        weeklyTargetCount: 7,
        expectedDurationMinutes: 20,
      },
      {
        name: "Meditate",
        cadence: "daily",
        weeklyTargetCount: 7,
        expectedDurationMinutes: null,
      },
    ],
    ...overrides,
  };
}
