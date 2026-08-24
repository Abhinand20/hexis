import {
  buildCycleArchiveItems,
  formatCycleDateRange,
} from "../../src/features/cycles/domain/cycleArchive";
import type {
  Cycle,
  CycleGoal,
  GoalRevision,
  SessionLog,
} from "../../src/features/cycles/domain/types";

function cycle(overrides: Partial<Cycle> = {}): Cycle {
  return {
    id: "cycle-1",
    name: "Summer focus",
    startDate: "2026-08-01",
    durationDays: 30,
    endDate: "2026-08-30",
    status: "active",
    createdAt: "2026-08-01T08:00:00.000Z",
    ...overrides,
  };
}

function goal(overrides: Partial<CycleGoal> = {}): CycleGoal {
  return {
    id: "goal-1",
    cycleId: "cycle-1",
    name: "Write",
    cadence: "daily",
    weeklyTargetCount: 5,
    expectedDurationMinutes: 30,
    activeFromDate: "2026-08-01",
    inactiveFromDate: null,
    createdAt: "2026-08-01T08:00:00.000Z",
    ...overrides,
  };
}

function log(
  id: string,
  cycleGoalId: string,
  localDate: string,
  durationMinutes: number | null,
): SessionLog {
  return {
    id,
    cycleGoalId,
    localDate,
    startedAt: `${localDate}T12:00:00.000Z`,
    durationMinutes,
    createdAt: `${localDate}T12:00:00.000Z`,
  };
}

describe("formatCycleDateRange", () => {
  it("formats same-year and cross-year local ranges deterministically", () => {
    expect(formatCycleDateRange("2026-08-01", "2026-08-30")).toBe(
      "Aug 1–Aug 30, 2026",
    );
    expect(formatCycleDateRange("2025-12-15", "2026-01-13")).toBe(
      "Dec 15, 2025–Jan 13, 2026",
    );
  });
});

describe("buildCycleArchiveItems", () => {
  it("bounds an active cycle at today and summarizes effective work", () => {
    const activeCycle = cycle();
    const write = goal();
    const items = buildCycleArchiveItems({
      cycles: [activeCycle],
      goals: [write],
      revisions: [],
      effectiveLogs: [
        log("session-1", write.id, "2026-08-01", 30),
        log("session-2", write.id, "2026-08-01", null),
        log("session-3", write.id, "2026-08-03", 45),
        log("future", write.id, "2026-08-04", 90),
        log("before", write.id, "2026-07-31", 90),
        log("orphan", "another-goal", "2026-08-02", 90),
      ],
      today: "2026-08-03",
    });

    expect(items).toEqual([
      {
        id: activeCycle.id,
        name: activeCycle.name,
        dateRange: "Aug 1–Aug 30, 2026",
        status: "active",
        sessionCount: 3,
        minutesLogged: 75,
        activeDayRatio: 2 / 3,
        practiceCount: 1,
        practiceNames: ["Write"],
      },
    ]);
  });

  it("uses final membership and configuration for added, stopped, and revised practices", () => {
    const completedCycle = cycle({
      status: "completed",
      endDate: "2026-08-10",
    });
    const stopped = goal({
      id: "goal-stopped",
      name: "Run",
      inactiveFromDate: "2026-08-08",
      createdAt: "2026-08-01T08:00:00.000Z",
    });
    const added = goal({
      id: "goal-added",
      name: "Read",
      activeFromDate: "2026-08-05",
      createdAt: "2026-08-05T08:00:00.000Z",
    });
    const revisions: GoalRevision[] = [
      {
        id: "revision-current",
        cycleGoalId: added.id,
        effectiveDate: "2026-08-07",
        name: "Read fiction",
        cadence: "daily",
        weeklyTargetCount: 4,
        expectedDurationMinutes: 20,
      },
      {
        id: "revision-after-cycle",
        cycleGoalId: added.id,
        effectiveDate: "2026-08-11",
        name: "Wrong future name",
        cadence: "daily",
        weeklyTargetCount: 7,
        expectedDurationMinutes: 10,
      },
    ];

    const [item] = buildCycleArchiveItems({
      cycles: [completedCycle],
      goals: [added, stopped],
      revisions,
      effectiveLogs: [
        log("stopped-log", stopped.id, "2026-08-07", 40),
        log("added-log", added.id, "2026-08-09", 20),
      ],
      today: "2026-08-25",
    });

    expect(item.practiceCount).toBe(1);
    expect(item.practiceNames).toEqual(["Read fiction"]);
    expect(item.sessionCount).toBe(2);
    expect(item.minutesLogged).toBe(60);
  });

  it("uses an ended-early cycle's recorded end and handles no activity", () => {
    const endedCycle = cycle({
      status: "ended_early",
      endDate: "2026-08-04",
    });
    const write = goal({ inactiveFromDate: "2026-08-04" });
    const [item] = buildCycleArchiveItems({
      cycles: [endedCycle],
      goals: [write],
      revisions: [],
      effectiveLogs: [log("after-end", write.id, "2026-08-05", 30)],
      today: "2026-08-20",
    });

    expect(item).toMatchObject({
      dateRange: "Aug 1–Aug 4, 2026",
      status: "ended_early",
      sessionCount: 0,
      minutesLogged: 0,
      activeDayRatio: 0,
      practiceCount: 0,
      practiceNames: [],
    });
  });

  it("returns no elapsed work for an active cycle that has not started", () => {
    const futureCycle = cycle({ startDate: "2026-08-10", endDate: "2026-09-08" });
    const futureGoal = goal({ activeFromDate: futureCycle.startDate });
    const [item] = buildCycleArchiveItems({
      cycles: [futureCycle],
      goals: [futureGoal],
      revisions: [],
      effectiveLogs: [log("future-log", futureGoal.id, "2026-08-10", 30)],
      today: "2026-08-09",
    });

    expect(item.sessionCount).toBe(0);
    expect(item.minutesLogged).toBe(0);
    expect(item.activeDayRatio).toBe(0);
    expect(item.practiceNames).toEqual(["Write"]);
  });

  it("sorts active first, then newest cycles with stable tie-breakers", () => {
    const older = cycle({
      id: "older",
      name: "Older",
      startDate: "2026-05-01",
      endDate: "2026-05-30",
      status: "completed",
      createdAt: "2026-05-01T08:00:00.000Z",
    });
    const tieA = cycle({
      id: "a",
      name: "Tie A",
      startDate: "2026-06-01",
      endDate: "2026-06-30",
      status: "completed",
      createdAt: "2026-06-01T08:00:00.000Z",
    });
    const tieB = cycle({
      id: "b",
      name: "Tie B",
      startDate: "2026-06-01",
      endDate: "2026-06-30",
      status: "ended_early",
      createdAt: "2026-06-01T08:00:00.000Z",
    });
    const active = cycle({ id: "active" });

    const items = buildCycleArchiveItems({
      cycles: [older, tieA, active, tieB],
      goals: [],
      revisions: [],
      effectiveLogs: [],
      today: "2026-08-03",
    });

    expect(items.map((item) => item.id)).toEqual(["active", "b", "a", "older"]);
  });
});
