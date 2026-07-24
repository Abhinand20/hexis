import type { Cycle } from "../features/cycles/domain/types";

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
