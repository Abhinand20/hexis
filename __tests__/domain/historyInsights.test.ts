import { buildHistoryInsights } from "../../src/features/cycles/domain/historyInsights";
import type {
  CycleGoal,
  GoalRevision,
  SessionLog,
} from "../../src/features/cycles/domain/types";
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

const strengthGoal: CycleGoal = {
  id: "goal-strength",
  cycleId: "cycle-1",
  name: "Strength",
  cadence: "weekly",
  weeklyTargetCount: 2,
  expectedDurationMinutes: 60,
  createdAt: "2026-07-01T00:00:00.000Z",
};

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
    durationMinutes,
    createdAt: `${localDate}T12:00:00.000Z`,
  };
}

describe("buildHistoryInsights", () => {
  const cycle = createCycle({
    id: "cycle-1",
    startDate: "2026-07-01",
    durationDays: 30,
    endDate: "2026-07-30",
  });

  it("summarizes effort only through today and calculates active-day streaks", () => {
    const logs = [
      log("1", writeGoal.id, "2026-07-01", 30),
      log("2", strengthGoal.id, "2026-07-01", 60),
      log("3", writeGoal.id, "2026-07-03", 30),
      log("4", writeGoal.id, "2026-07-04", 30),
      log("5", strengthGoal.id, "2026-07-05", 60),
      log("future", writeGoal.id, "2026-07-06", 30),
    ];

    const insights = buildHistoryInsights(
      cycle,
      [writeGoal, strengthGoal],
      [],
      logs,
      "2026-07-05",
    );

    expect(insights.elapsedDayCount).toBe(5);
    expect(insights.remainingDayCount).toBe(25);
    expect(insights.sessionCount).toBe(5);
    expect(insights.minutesLogged).toBe(210);
    expect(insights.loggedDayCount).toBe(4);
    expect(insights.activeDayRatio).toBe(0.8);
    expect(insights.currentEffortStreak).toBe(3);
    expect(insights.longestEffortStreak).toBe(3);
  });

  it("builds calendar-week trend points and a week-over-week session delta", () => {
    const logs = [
      log("1", writeGoal.id, "2026-07-01", 30),
      log("2", writeGoal.id, "2026-07-07", 30),
      log("3", strengthGoal.id, "2026-07-08", 60),
      log("4", writeGoal.id, "2026-07-14", 30),
      log("5", writeGoal.id, "2026-07-15", 30),
      log("6", strengthGoal.id, "2026-07-16", 60),
    ];

    const insights = buildHistoryInsights(
      cycle,
      [writeGoal, strengthGoal],
      [],
      logs,
      "2026-07-17",
    );

    expect(insights.trend.map((week) => week.sessionCount)).toEqual([1, 2, 3]);
    expect(insights.trend.map((week) => week.targetCount)).toEqual([7, 7, 7]);
    expect(insights.trend[2].isInProgress).toBe(true);
    expect(insights.sessionDeltaFromPreviousWeek).toBe(1);
  });

  it("normalizes practice consistency against targets and preserves cadence-aware streaks", () => {
    const logs = [
      log("1", writeGoal.id, "2026-07-16", 30),
      log("2", writeGoal.id, "2026-07-17", 30),
      log("3", writeGoal.id, "2026-07-18", 30),
      log("4", writeGoal.id, "2026-07-19", 30),
      log("5", writeGoal.id, "2026-07-20", 30),
      log("6", strengthGoal.id, "2026-07-13", 60),
      log("7", strengthGoal.id, "2026-07-15", 60),
    ];

    const insights = buildHistoryInsights(
      createCycle({
        id: "cycle-1",
        startDate: "2026-07-13",
        durationDays: 30,
        endDate: "2026-08-11",
      }),
      [writeGoal, strengthGoal],
      [],
      logs,
      "2026-07-20",
    );

    expect(insights.practices[0]).toMatchObject({
      name: "Write",
      sessionCount: 5,
      targetCount: 10,
      completionRatio: 0.5,
      currentStreak: 5,
    });
    expect(insights.practices[1]).toMatchObject({
      name: "Strength",
      sessionCount: 2,
      targetCount: 4,
      completionRatio: 0.5,
      currentStreak: 1,
    });
  });

  it("uses the latest revised name and cadence for practice insight streaks", () => {
    const revisions: GoalRevision[] = [
      {
        id: "revision-daily",
        cycleGoalId: strengthGoal.id,
        effectiveDate: "2026-07-14",
        name: "Daily mobility",
        cadence: "daily",
        weeklyTargetCount: 7,
        expectedDurationMinutes: 20,
      },
    ];
    const logs = [
      log("1", strengthGoal.id, "2026-07-14", 20),
      log("2", strengthGoal.id, "2026-07-15", 20),
      log("3", strengthGoal.id, "2026-07-16", 20),
      log("4", strengthGoal.id, "2026-07-17", 20),
    ];

    const insights = buildHistoryInsights(
      cycle,
      [strengthGoal],
      revisions,
      logs,
      "2026-07-17",
    );

    expect(insights.practices[0]).toMatchObject({
      name: "Daily mobility",
      cadence: "daily",
      currentStreak: 4,
    });
  });
});
