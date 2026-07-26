import { buildCycleSummary } from "../../src/features/cycles/domain/cycleSummary";
import type { CycleGoal, GoalRevision, SessionLog } from "../../src/features/cycles/domain/types";
import { createCycle } from "../../src/test/factories";

const writeGoal: CycleGoal = {
  id: "goal-write",
  cycleId: "cycle-1",
  name: "Write",
  cadence: "daily",
  weeklyTargetCount: 5,
  expectedDurationMinutes: 30,
  createdAt: "2026-07-01T00:00:00.000Z",
};

const runGoal: CycleGoal = {
  id: "goal-run",
  cycleId: "cycle-1",
  name: "Run",
  cadence: "weekly",
  weeklyTargetCount: 3,
  expectedDurationMinutes: 45,
  createdAt: "2026-07-01T00:00:00.000Z",
};

const readGoal: CycleGoal = {
  id: "goal-read",
  cycleId: "cycle-1",
  name: "Read",
  cadence: "daily",
  weeklyTargetCount: 7,
  expectedDurationMinutes: 20,
  createdAt: "2026-07-01T00:00:00.000Z",
};

function log(
  cycleGoalId: string,
  localDate: string,
  durationMinutes: number | null,
): SessionLog {
  return {
    id: `log-${cycleGoalId}-${localDate}`,
    cycleGoalId,
    localDate,
    durationMinutes,
    createdAt: `${localDate}T00:00:00.000Z`,
  };
}

describe("buildCycleSummary", () => {
  const cycle = createCycle({
    id: "cycle-1",
    name: "Summer Focus",
    startDate: "2026-07-01",
    durationDays: 30,
    endDate: "2026-07-30",
    status: "completed",
  });

  it("counts inclusive active days and distinct logged days within the cycle span", () => {
    const summary = buildCycleSummary(
      cycle,
      [writeGoal, runGoal],
      [],
      [
        log("goal-write", "2026-07-01", 30),
        log("goal-write", "2026-07-01", 15),
        log("goal-run", "2026-07-02", 45),
        log("goal-write", "2026-07-15", 30),
        // Outside the cycle span — ignored for logged-day count
        log("goal-write", "2026-08-01", 30),
      ],
    );

    expect(summary.activeDayCount).toBe(30);
    expect(summary.loggedDayCount).toBe(3);
  });

  it("uses early-ended endDate for activeDayCount", () => {
    const early = createCycle({
      ...cycle,
      endDate: "2026-07-10",
      status: "ended_early",
    });
    const summary = buildCycleSummary(early, [writeGoal], [], []);
    expect(summary.activeDayCount).toBe(10);
  });

  it("builds practice totals in goal order using end-of-cycle names", () => {
    const revisions: GoalRevision[] = [
      {
        id: "rev-1",
        cycleGoalId: "goal-write",
        effectiveDate: "2026-07-15",
        name: "Write mornings",
        cadence: "daily",
        weeklyTargetCount: 5,
        expectedDurationMinutes: 30,
      },
    ];
    const logs: SessionLog[] = [
      log("goal-write", "2026-07-02", 30),
      log("goal-write", "2026-07-03", null),
      log("goal-run", "2026-07-04", 45),
    ];

    const summary = buildCycleSummary(
      cycle,
      [writeGoal, runGoal, readGoal],
      revisions,
      logs,
    );

    expect(summary.practiceTotals).toEqual([
      {
        goalId: "goal-write",
        name: "Write mornings",
        completedCount: 2,
        minutesLogged: 30,
      },
      {
        goalId: "goal-run",
        name: "Run",
        completedCount: 1,
        minutesLogged: 45,
      },
      {
        goalId: "goal-read",
        name: "Read",
        completedCount: 0,
        minutesLogged: 0,
      },
    ]);
  });

  it("picks the strongest week by session count, then minutes, then earliest week", () => {
    // Week of Jul 6–12: 2 sessions, 90 minutes
    // Week of Jul 13–19: 2 sessions, 120 minutes → wins on minutes
    // Week of Jul 20–26: 1 session
    const logs: SessionLog[] = [
      log("goal-write", "2026-07-07", 30),
      log("goal-run", "2026-07-08", 60),
      log("goal-write", "2026-07-14", 60),
      log("goal-run", "2026-07-15", 60),
      log("goal-write", "2026-07-22", 30),
    ];

    const summary = buildCycleSummary(cycle, [writeGoal, runGoal], [], logs);
    expect(summary.strongestWeekLabel).toBe("Jul 13 – Jul 19");
  });

  it("breaks equal week session/minute ties toward the earlier week", () => {
    const logs: SessionLog[] = [
      log("goal-write", "2026-07-07", 30),
      log("goal-write", "2026-07-14", 30),
    ];

    const summary = buildCycleSummary(cycle, [writeGoal], [], logs);
    expect(summary.strongestWeekLabel).toBe("Jul 6 – Jul 12");
  });

  it("returns null strongest week and most consistent practice with no sessions", () => {
    const summary = buildCycleSummary(cycle, [writeGoal, runGoal], [], []);
    expect(summary.strongestWeekLabel).toBeNull();
    expect(summary.mostConsistentPracticeName).toBeNull();
  });

  it("names the most consistent practice by completedCount, preferring earlier goals on ties", () => {
    const logs: SessionLog[] = [
      log("goal-write", "2026-07-01", 30),
      log("goal-write", "2026-07-02", 30),
      log("goal-run", "2026-07-03", 45),
      log("goal-run", "2026-07-04", 45),
      log("goal-read", "2026-07-05", 20),
    ];

    const summary = buildCycleSummary(
      cycle,
      [writeGoal, runGoal, readGoal],
      [],
      logs,
    );
    // Write and Run both have 2; Write comes first in goals order
    expect(summary.mostConsistentPracticeName).toBe("Write");
  });
});
