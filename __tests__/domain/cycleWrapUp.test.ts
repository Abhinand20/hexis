import { addLocalDays } from "../../src/features/cycles/domain/date";
import {
  buildCycleWrapUp,
  buildWrapUpComparison,
  eligibleComparisonBaselines,
} from "../../src/features/cycles/domain/cycleWrapUp";
import type {
  Cycle,
  CycleGoal,
  GoalRevision,
  SessionLog,
} from "../../src/features/cycles/domain/types";
import { createCycle, createCycleGoal } from "../../src/test/factories";

function completedCycle(overrides: Partial<Cycle> = {}): Cycle {
  return createCycle({
    id: "cycle-selected",
    name: "Summer Focus",
    startDate: "2026-07-01",
    durationDays: 30,
    endDate: "2026-07-30",
    status: "completed",
    createdAt: "2026-07-01T00:00:00.000Z",
    ...overrides,
  });
}

function goal(
  overrides: Partial<CycleGoal> = {},
): CycleGoal {
  return createCycleGoal({
    id: "goal-write",
    cycleId: "cycle-selected",
    name: "Write",
    activeFromDate: "2026-07-01",
    createdAt: "2026-07-01T00:00:00.000Z",
    ...overrides,
  });
}

function log(
  cycleGoalId: string,
  localDate: string,
  durationMinutes: number | null,
  id = `log-${cycleGoalId}-${localDate}`,
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

function sessionsOnDays(
  cycleGoalId: string,
  dates: string[],
  durationMinutes: number | null = 10,
): SessionLog[] {
  return dates.map((date, index) =>
    log(cycleGoalId, date, durationMinutes, `log-${cycleGoalId}-${index}`),
  );
}

describe("buildCycleWrapUp", () => {
  const cycle = completedCycle();
  const write = goal();

  it("returns empty-cycle metrics for a first finished cycle with no sessions", () => {
    const metrics = buildCycleWrapUp(cycle, [write], [], []);

    expect(metrics).toEqual({
      cycleDays: 30,
      sessions: 0,
      recordedMinutes: 0,
      sessionsWithRecordedDuration: 0,
      activeDays: 0,
      activityDayPercentage: 0,
      sessionsPerWeek: 0,
      recordedMinutesPerWeek: 0,
      longestActiveDayRun: 0,
      busiestWeek: null,
      mostLoggedPractices: [],
    });
  });

  it("counts a naturally completed cycle using stored endDate inclusive days", () => {
    const metrics = buildCycleWrapUp(
      cycle,
      [write],
      [],
      [
        log(write.id, "2026-07-01", 30),
        log(write.id, "2026-07-01", 15, "log-write-second-same-day"),
        log(write.id, "2026-07-02", 45),
      ],
    );

    expect(metrics.cycleDays).toBe(30);
    expect(metrics.sessions).toBe(3);
    expect(metrics.recordedMinutes).toBe(90);
    expect(metrics.sessionsWithRecordedDuration).toBe(3);
    expect(metrics.activeDays).toBe(2);
    expect(metrics.activityDayPercentage).toBeCloseTo((2 / 30) * 100);
    expect(metrics.sessionsPerWeek).toBeCloseTo((3 / 30) * 7);
    expect(metrics.recordedMinutesPerWeek).toBeCloseTo((90 / 30) * 7);
    expect(metrics.longestActiveDayRun).toBe(2);
  });

  it("uses stored endDate rather than durationDays for an early-ended cycle", () => {
    const early = completedCycle({
      durationDays: 30,
      endDate: "2026-07-10",
      status: "ended_early",
    });
    const metrics = buildCycleWrapUp(
      early,
      [write],
      [],
      [
        log(write.id, "2026-07-10", 20),
        log(write.id, "2026-07-11", 40),
      ],
    );

    expect(metrics.cycleDays).toBe(10);
    expect(metrics.sessions).toBe(1);
    expect(metrics.recordedMinutes).toBe(20);
    expect(metrics.activeDays).toBe(1);
  });

  it("treats missing durations as unknown and never infers practice expected duration", () => {
    const timedGoal = goal({ expectedDurationMinutes: 30 });
    const metrics = buildCycleWrapUp(
      cycle,
      [timedGoal],
      [],
      [
        log(timedGoal.id, "2026-07-01", 12),
        log(timedGoal.id, "2026-07-02", null),
        log(timedGoal.id, "2026-07-03", 8),
      ],
    );

    expect(metrics.sessions).toBe(3);
    expect(metrics.recordedMinutes).toBe(20);
    expect(metrics.sessionsWithRecordedDuration).toBe(2);
    expect(metrics.recordedMinutesPerWeek).toBeCloseTo((20 / 30) * 7);
  });

  it("excludes sessions moved outside the cycle range or owned by another cycle's goals", () => {
    const other = goal({ id: "goal-other", cycleId: "cycle-other", name: "Other" });
    const metrics = buildCycleWrapUp(
      cycle,
      [write],
      [],
      [
        log(write.id, "2026-07-15", 30),
        log(write.id, "2026-06-30", 90, "moved-before"),
        log(write.id, "2026-07-31", 90, "moved-after"),
        log(other.id, "2026-07-16", 90, "foreign-goal"),
      ],
    );

    expect(metrics.sessions).toBe(1);
    expect(metrics.recordedMinutes).toBe(30);
    expect(metrics.activeDays).toBe(1);
  });

  it("counts a corrected session once when the effective list already resolved it", () => {
    const metrics = buildCycleWrapUp(
      cycle,
      [write],
      [],
      [log(write.id, "2026-07-08", 25, "session-corrected-once")],
    );

    expect(metrics.sessions).toBe(1);
    expect(metrics.recordedMinutes).toBe(25);
  });

  it("counts longest active-day run by distinct dates, including single-day and tied runs", () => {
    const metrics = buildCycleWrapUp(
      cycle,
      [write],
      [],
      [
        log(write.id, "2026-07-01", 10, "a1"),
        log(write.id, "2026-07-01", 10, "a2"),
        log(write.id, "2026-07-02", 10),
        log(write.id, "2026-07-03", 10),
        log(write.id, "2026-07-05", 10),
        log(write.id, "2026-07-07", 10),
        log(write.id, "2026-07-08", 10),
        log(write.id, "2026-07-09", 10),
      ],
    );

    expect(metrics.longestActiveDayRun).toBe(3);
    expect(metrics.activeDays).toBe(7);
  });

  it("returns a single-day longest run when no consecutive dates exist", () => {
    const metrics = buildCycleWrapUp(
      cycle,
      [write],
      [],
      [log(write.id, "2026-07-04", 10), log(write.id, "2026-07-20", 10)],
    );

    expect(metrics.longestActiveDayRun).toBe(1);
  });

  it("ranks the busiest week by sessions, then recorded minutes, then earliest week", () => {
    const sessionWinner = buildCycleWrapUp(
      cycle,
      [write],
      [],
      [
        log(write.id, "2026-07-07", 10),
        log(write.id, "2026-07-08", 10),
        log(write.id, "2026-07-09", 10),
        log(write.id, "2026-07-14", 90),
        log(write.id, "2026-07-15", 90),
      ],
    );
    expect(sessionWinner.busiestWeek).toEqual({
      weekStartDate: "2026-07-06",
      weekEndDate: "2026-07-12",
      sessions: 3,
      recordedMinutes: 30,
      isPartialWeek: false,
    });

    const minuteWinner = buildCycleWrapUp(
      cycle,
      [write],
      [],
      [
        log(write.id, "2026-07-07", 10),
        log(write.id, "2026-07-08", 10),
        log(write.id, "2026-07-14", 40),
        log(write.id, "2026-07-15", 40),
      ],
    );
    expect(minuteWinner.busiestWeek).toEqual({
      weekStartDate: "2026-07-13",
      weekEndDate: "2026-07-19",
      sessions: 2,
      recordedMinutes: 80,
      isPartialWeek: false,
    });

    const earliestWinner = buildCycleWrapUp(
      cycle,
      [write],
      [],
      [
        log(write.id, "2026-07-07", 30),
        log(write.id, "2026-07-08", 30),
        log(write.id, "2026-07-14", 30),
        log(write.id, "2026-07-15", 30),
      ],
    );
    expect(earliestWinner.busiestWeek).toMatchObject({
      weekStartDate: "2026-07-06",
      weekEndDate: "2026-07-12",
      sessions: 2,
      recordedMinutes: 60,
    });
  });

  it("clamps a partial first week when the cycle starts mid-week", () => {
    const metrics = buildCycleWrapUp(
      cycle,
      [write],
      [],
      [
        log(write.id, "2026-07-01", 10),
        log(write.id, "2026-07-02", 10),
        log(write.id, "2026-07-03", 10),
        log(write.id, "2026-07-04", 10),
        log(write.id, "2026-07-05", 10),
      ],
    );

    expect(metrics.busiestWeek).toEqual({
      weekStartDate: "2026-07-01",
      weekEndDate: "2026-07-05",
      sessions: 5,
      recordedMinutes: 50,
      isPartialWeek: true,
    });
  });

  it("marks the last week partial when it extends past the cycle end", () => {
    const metrics = buildCycleWrapUp(
      cycle,
      [write],
      [],
      [
        log(write.id, "2026-07-27", 10),
        log(write.id, "2026-07-28", 10),
        log(write.id, "2026-07-29", 10),
        log(write.id, "2026-07-30", 10),
      ],
    );

    expect(metrics.busiestWeek).toEqual({
      weekStartDate: "2026-07-27",
      weekEndDate: "2026-07-30",
      sessions: 4,
      recordedMinutes: 40,
      isPartialWeek: true,
    });
  });

  it("walks calendar days across a DST spring-forward without using millisecond division", () => {
    const dstCycle = completedCycle({
      startDate: "2026-03-07",
      endDate: "2026-03-10",
      durationDays: 30,
    });
    const metrics = buildCycleWrapUp(
      dstCycle,
      [write],
      [],
      [
        log(write.id, "2026-03-07", 10),
        log(write.id, "2026-03-08", 10),
        log(write.id, "2026-03-09", 10),
        log(write.id, "2026-03-10", 10),
      ],
    );

    expect(metrics.cycleDays).toBe(4);
    expect(metrics.activeDays).toBe(4);
    expect(metrics.longestActiveDayRun).toBe(4);
    expect(metrics.sessionsPerWeek).toBeCloseTo((4 / 4) * 7);
  });

  it("names practices at their final membership date and keeps duplicate names distinct", () => {
    const stayed = goal({
      id: "goal-stayed",
      name: "Write",
    });
    const left = goal({
      id: "goal-left",
      name: "Write",
      inactiveFromDate: "2026-07-15",
    });
    const joined = goal({
      id: "goal-joined",
      name: "Read",
      activeFromDate: "2026-07-20",
    });
    const revisions: GoalRevision[] = [
      {
        id: "rev-stayed",
        cycleGoalId: stayed.id,
        effectiveDate: "2026-07-10",
        name: "Morning pages",
        cadence: "daily",
        weeklyTargetCount: 5,
        expectedDurationMinutes: 30,
      },
      {
        id: "rev-after-leave",
        cycleGoalId: left.id,
        effectiveDate: "2026-07-20",
        name: "Should not appear",
        cadence: "daily",
        weeklyTargetCount: 5,
        expectedDurationMinutes: 30,
      },
      {
        id: "rev-joined",
        cycleGoalId: joined.id,
        effectiveDate: "2026-07-22",
        name: "Evening reading",
        cadence: "daily",
        weeklyTargetCount: 7,
        expectedDurationMinutes: 20,
      },
    ];

    const metrics = buildCycleWrapUp(
      cycle,
      [stayed, left, joined],
      revisions,
      [
        log(stayed.id, "2026-07-12", 10),
        log(stayed.id, "2026-07-13", 10),
        log(stayed.id, "2026-07-14", 10),
        log(left.id, "2026-07-02", 10),
        log(left.id, "2026-07-14", 10),
        log(joined.id, "2026-07-22", 10),
      ],
    );

    expect(metrics.mostLoggedPractices).toEqual([
      { goalId: stayed.id, name: "Morning pages", sessions: 3 },
    ]);
    const namesById = Object.fromEntries(
      [stayed, left, joined].map((item) => {
        const wrap = buildCycleWrapUp(
          cycle,
          [item],
          revisions,
          [
            log(stayed.id, "2026-07-12", 10),
            log(left.id, "2026-07-14", 10),
            log(joined.id, "2026-07-22", 10),
          ].filter((session) => session.cycleGoalId === item.id),
        );
        return [item.id, wrap.mostLoggedPractices[0]?.name];
      }),
    );
    expect(namesById).toEqual({
      "goal-stayed": "Morning pages",
      "goal-left": "Write",
      "goal-joined": "Evening reading",
    });
  });

  it("returns every practice tied at the top, sorted by goal ID, as joint most-logged", () => {
    const alpha = goal({ id: "goal-b", name: "Run" });
    const beta = goal({ id: "goal-a", name: "Write" });
    const metrics = buildCycleWrapUp(
      cycle,
      [alpha, beta],
      [],
      [
        log(alpha.id, "2026-07-01", 10),
        log(alpha.id, "2026-07-02", 10),
        log(beta.id, "2026-07-03", 10),
        log(beta.id, "2026-07-04", 10),
      ],
    );

    expect(metrics.mostLoggedPractices).toEqual([
      { goalId: "goal-a", name: "Write", sessions: 2 },
      { goalId: "goal-b", name: "Run", sessions: 2 },
    ]);
  });

  it("throws on an inverted cycle range instead of returning nonsense totals", () => {
    const inverted = completedCycle({
      startDate: "2026-07-30",
      endDate: "2026-07-01",
    });

    expect(() => buildCycleWrapUp(inverted, [write], [], [])).toThrow(
      /end date is before start date/i,
    );
  });
});

describe("eligibleComparisonBaselines", () => {
  const selected = completedCycle({
    id: "cycle-selected",
    startDate: "2026-07-01",
    endDate: "2026-07-30",
  });

  it("excludes active, overlapping, and future cycles", () => {
    const finishedEarlier = completedCycle({
      id: "cycle-earlier",
      startDate: "2026-05-01",
      endDate: "2026-05-30",
      status: "completed",
    });
    const endedEarly = completedCycle({
      id: "cycle-early",
      startDate: "2026-04-01",
      endDate: "2026-04-10",
      status: "ended_early",
    });
    const active = completedCycle({
      id: "cycle-active",
      startDate: "2026-03-01",
      endDate: "2026-03-30",
      status: "active",
    });
    const overlapping = completedCycle({
      id: "cycle-overlap",
      startDate: "2026-06-15",
      endDate: "2026-07-01",
      status: "completed",
    });
    const future = completedCycle({
      id: "cycle-future",
      startDate: "2026-08-01",
      endDate: "2026-08-30",
      status: "completed",
    });

    expect(
      eligibleComparisonBaselines(
        [active, overlapping, future, selected, finishedEarlier, endedEarly],
        selected,
      ).map((cycle) => cycle.id),
    ).toEqual(["cycle-earlier", "cycle-early"]);
  });

  it("orders the default baseline by latest endDate, then latest startDate, then stable ID", () => {
    const sameEndLaterStart = completedCycle({
      id: "cycle-z",
      startDate: "2026-05-15",
      endDate: "2026-06-01",
    });
    const sameEndEarlierStart = completedCycle({
      id: "cycle-a",
      startDate: "2026-05-01",
      endDate: "2026-06-01",
    });
    const olderEnd = completedCycle({
      id: "cycle-old",
      startDate: "2026-04-01",
      endDate: "2026-04-30",
    });
    const tiedIdentityLater = completedCycle({
      id: "cycle-id-b",
      startDate: "2026-03-01",
      endDate: "2026-03-15",
    });
    const tiedIdentityEarlier = completedCycle({
      id: "cycle-id-a",
      startDate: "2026-03-01",
      endDate: "2026-03-15",
    });

    expect(
      eligibleComparisonBaselines(
        [
          olderEnd,
          sameEndEarlierStart,
          tiedIdentityLater,
          sameEndLaterStart,
          tiedIdentityEarlier,
          selected,
        ],
        selected,
      ).map((cycle) => cycle.id),
    ).toEqual([
      "cycle-z",
      "cycle-a",
      "cycle-old",
      "cycle-id-a",
      "cycle-id-b",
    ]);
  });

  it("returns no baselines when there is no eligible history", () => {
    expect(eligibleComparisonBaselines([selected], selected)).toEqual([]);
    expect(eligibleComparisonBaselines([], selected)).toEqual([]);
  });
});

describe("buildWrapUpComparison", () => {
  const write = goal();

  it("reports 14 sessions/week for both 60-in-30 and 120-in-60, and +10 percentage points", () => {
    const thirtyDay = completedCycle({
      id: "cycle-30",
      startDate: "2026-06-01",
      endDate: "2026-06-30",
      durationDays: 30,
    });
    const sixtyDay = completedCycle({
      id: "cycle-60",
      startDate: "2026-07-01",
      endDate: "2026-08-29",
      durationDays: 60,
    });

    const thirtyDates = Array.from({ length: 12 }, (_, index) =>
      addLocalDays(thirtyDay.startDate, index),
    );
    const sixtyDates = Array.from({ length: 30 }, (_, index) =>
      addLocalDays(sixtyDay.startDate, index),
    );
    const thirtySessions = thirtyDates.flatMap((date) =>
      sessionsOnDays(write.id, [date, date, date, date, date], 10),
    );
    const sixtySessions = sixtyDates.flatMap((date) =>
      sessionsOnDays(write.id, [date, date, date, date], 10),
    );

    const baselineMetrics = buildCycleWrapUp(thirtyDay, [write], [], thirtySessions);
    const selectedMetrics = buildCycleWrapUp(sixtyDay, [write], [], sixtySessions);

    expect(baselineMetrics.cycleDays).toBe(30);
    expect(baselineMetrics.sessions).toBe(60);
    expect(baselineMetrics.activeDays).toBe(12);
    expect(baselineMetrics.activityDayPercentage).toBe(40);
    expect(baselineMetrics.sessionsPerWeek).toBe(14);

    expect(selectedMetrics.cycleDays).toBe(60);
    expect(selectedMetrics.sessions).toBe(120);
    expect(selectedMetrics.activeDays).toBe(30);
    expect(selectedMetrics.activityDayPercentage).toBe(50);
    expect(selectedMetrics.sessionsPerWeek).toBe(14);

    const comparison = buildWrapUpComparison(
      selectedMetrics,
      thirtyDay,
      baselineMetrics,
      sixtyDay,
    );

    expect(comparison.hasDifferentLengths).toBe(true);
    expect(comparison.differences.sessions).toBe(60);
    expect(comparison.differences.sessionsPerWeek).toBe(0);
    expect(comparison.differences.activityDayPercentagePoints).toBe(10);
    expect(comparison.differences.activeDays).toBe(18);
  });

  it("uses finite absolute differences against a zero baseline, never infinity", () => {
    const selectedCycle = completedCycle();
    const baselineCycle = completedCycle({
      id: "cycle-empty",
      startDate: "2026-05-01",
      endDate: "2026-05-30",
    });
    const selectedMetrics = buildCycleWrapUp(
      selectedCycle,
      [write],
      [],
      [log(write.id, "2026-07-01", 20), log(write.id, "2026-07-02", 10)],
    );
    const baselineMetrics = buildCycleWrapUp(baselineCycle, [write], [], []);
    const comparison = buildWrapUpComparison(
      selectedMetrics,
      baselineCycle,
      baselineMetrics,
      selectedCycle,
    );

    expect(Number.isFinite(comparison.differences.sessions)).toBe(true);
    expect(Number.isFinite(comparison.differences.recordedMinutes)).toBe(true);
    expect(Number.isFinite(comparison.differences.sessionsPerWeek)).toBe(true);
    expect(Number.isFinite(comparison.differences.recordedMinutesPerWeek)).toBe(
      true,
    );
    expect(Number.isFinite(comparison.differences.activityDayPercentagePoints)).toBe(
      true,
    );
    expect(comparison.differences.sessions).toBe(2);
    expect(comparison.differences.recordedMinutes).toBe(30);
    expect(comparison.differences.activeDays).toBe(2);
  });
});
