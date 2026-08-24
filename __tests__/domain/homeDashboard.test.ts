import {
  buildHomeDashboardSummary,
  type HomeDashboardSummary,
} from "../../src/features/cycles/domain/homeDashboard";
import type {
  Cycle,
  CycleGoal,
  GoalRevision,
  SessionLog,
} from "../../src/features/cycles/domain/types";

const cycle: Cycle = {
  id: "cycle-1",
  name: "July focus",
  startDate: "2026-07-06",
  durationDays: 30,
  endDate: "2026-08-04",
  status: "active",
  createdAt: "2026-07-06T08:00:00.000Z",
};

const writeGoal: CycleGoal = {
  id: "goal-write",
  cycleId: cycle.id,
  name: "Write",
  cadence: "daily",
  weeklyTargetCount: 5,
  expectedDurationMinutes: 30,
  activeFromDate: cycle.startDate,
  inactiveFromDate: null,
  createdAt: cycle.createdAt,
};

const strengthGoal: CycleGoal = {
  ...writeGoal,
  id: "goal-strength",
  name: "Strength",
  cadence: "weekly",
  weeklyTargetCount: 2,
  expectedDurationMinutes: 60,
};

const countOnlyGoal: CycleGoal = {
  ...writeGoal,
  id: "goal-count-only",
  name: "Meditate",
  weeklyTargetCount: 3,
  expectedDurationMinutes: null,
};

function log(
  id: string,
  cycleGoalId: string,
  localDate: string,
  durationMinutes: number | null,
  hour = 12,
): SessionLog {
  const startedAt = `${localDate}T${String(hour).padStart(2, "0")}:00:00.000Z`;
  return {
    id,
    cycleGoalId,
    localDate,
    startedAt,
    durationMinutes,
    createdAt: startedAt,
  };
}

function build(
  goals: CycleGoal[],
  logs: SessionLog[],
  today = "2026-07-15",
  revisions: GoalRevision[] = [],
  cycleOverride: Cycle = cycle,
): HomeDashboardSummary {
  return buildHomeDashboardSummary({
    cycle: cycleOverride,
    goals,
    revisions,
    effectiveLogs: logs,
    today,
  });
}

describe("buildHomeDashboardSummary", () => {
  it("summarizes the ordinary current week, comparison, recent rhythm, and today", () => {
    const logs = [
      log("previous-1", writeGoal.id, "2026-07-07", 30),
      log("previous-2", strengthGoal.id, "2026-07-09", 60),
      log("current-1", writeGoal.id, "2026-07-13", 30),
      log("current-2", strengthGoal.id, "2026-07-14", 60),
      log("today-early", writeGoal.id, "2026-07-15", 25, 8),
      log("today-late", strengthGoal.id, "2026-07-15", 70, 18),
      log("future", writeGoal.id, "2026-07-16", 30),
    ];

    const summary = build([writeGoal, strengthGoal], logs);

    expect(summary.week).toEqual({
      startDate: "2026-07-13",
      endDate: "2026-07-19",
      calendarDaysRemaining: 4,
    });
    expect(summary.totals).toEqual({ sessionCount: 4, minutesLogged: 185 });
    expect(summary.sessions).toEqual({
      logged: 4,
      target: 7,
      remaining: 3,
      progressRatio: 4 / 7,
    });
    expect(summary.minutes).toEqual({
      logged: 185,
      target: 270,
      remaining: 95,
      progressRatio: 175 / 270,
    });
    expect(summary.previousWeekSessionDelta).toBe(2);
    expect(summary.recentDays).toEqual([
      { localDate: "2026-07-09", sessionCount: 1, minutesLogged: 60 },
      { localDate: "2026-07-10", sessionCount: 0, minutesLogged: 0 },
      { localDate: "2026-07-11", sessionCount: 0, minutesLogged: 0 },
      { localDate: "2026-07-12", sessionCount: 0, minutesLogged: 0 },
      { localDate: "2026-07-13", sessionCount: 1, minutesLogged: 30 },
      { localDate: "2026-07-14", sessionCount: 1, minutesLogged: 60 },
      { localDate: "2026-07-15", sessionCount: 2, minutesLogged: 95 },
    ]);
    expect(summary.todaySessions.map((session) => session.id)).toEqual([
      "today-late",
      "today-early",
    ]);
    expect(summary.practices.map((practice) => practice.goalId)).toEqual([
      writeGoal.id,
      strengthGoal.id,
    ]);
    expect(summary.practices[0]).toMatchObject({
      name: "Write",
      membership: "full",
      state: "in_progress",
      sessionCount: 2,
      sessionTarget: 5,
      sessionRemaining: 3,
      minutesLogged: 55,
      minutesTarget: 150,
      minutesRemaining: 95,
      currentStreak: 1,
    });
  });

  it("represents an empty, count-only week without inventing a minute target", () => {
    const summary = build([countOnlyGoal], []);

    expect(summary.totals).toEqual({ sessionCount: 0, minutesLogged: 0 });
    expect(summary.sessions).toEqual({
      logged: 0,
      target: 3,
      remaining: 3,
      progressRatio: 0,
    });
    expect(summary.minutes).toEqual({
      logged: 0,
      target: null,
      remaining: null,
      progressRatio: null,
    });
    expect(summary.recentDays).toHaveLength(7);
    expect(summary.todaySessions).toEqual([]);
  });

  it("preserves over-target raw work while capping ratios and remaining at zero", () => {
    const overTarget = [
      log("1", strengthGoal.id, "2026-07-13", 70),
      log("2", strengthGoal.id, "2026-07-13", 60),
      log("3", strengthGoal.id, "2026-07-14", 50),
    ];

    const summary = build([strengthGoal], overTarget);

    expect(summary.sessions).toEqual({
      logged: 3,
      target: 2,
      remaining: 0,
      progressRatio: 1,
    });
    expect(summary.minutes).toEqual({
      logged: 180,
      target: 120,
      remaining: 0,
      progressRatio: 1,
    });
    expect(summary.practices[0]).toMatchObject({
      sessionCount: 3,
      sessionRemaining: 0,
      sessionProgressRatio: 1,
      minutesLogged: 180,
      minutesRemaining: 0,
      minutesProgressRatio: 1,
      state: "met",
    });
  });

  it("uses the effective revised name, cadence, count, duration, and streak", () => {
    const revisions: GoalRevision[] = [
      {
        id: "revision-1",
        cycleGoalId: strengthGoal.id,
        effectiveDate: "2026-07-14",
        name: "Daily mobility",
        cadence: "daily",
        weeklyTargetCount: 4,
        expectedDurationMinutes: 20,
      },
    ];
    const logs = [
      log("1", strengthGoal.id, "2026-07-13", 60),
      log("2", strengthGoal.id, "2026-07-14", 20),
      log("3", strengthGoal.id, "2026-07-15", 20),
    ];

    const summary = build([strengthGoal], logs, "2026-07-15", revisions);

    expect(summary.practices[0]).toMatchObject({
      name: "Daily mobility",
      cadence: "daily",
      expectedDurationMinutes: 20,
      sessionTarget: 4,
      minutesTarget: 80,
      currentStreak: 3,
    });
  });

  it("keeps added and stopped partial-week work but excludes their targets", () => {
    const fullGoal = { ...writeGoal, id: "full", name: "Full" };
    const addedGoal = {
      ...strengthGoal,
      id: "added",
      name: "Added",
      activeFromDate: "2026-07-15",
    };
    const stoppedGoal = {
      ...countOnlyGoal,
      id: "stopped",
      name: "Stopped",
      inactiveFromDate: "2026-07-15",
    };
    const logs = [
      log("full", fullGoal.id, "2026-07-14", 30),
      log("added", addedGoal.id, "2026-07-15", 60),
      log("stopped", stoppedGoal.id, "2026-07-14", 10),
    ];

    const summary = build([fullGoal, addedGoal, stoppedGoal], logs);

    expect(summary.hasPartialMembership).toBe(true);
    expect(summary.totals).toEqual({ sessionCount: 3, minutesLogged: 100 });
    expect(summary.sessions).toEqual({
      logged: 3,
      target: 5,
      remaining: 4,
      progressRatio: 0.2,
    });
    expect(summary.minutes).toEqual({
      logged: 100,
      target: 150,
      remaining: 120,
      progressRatio: 0.2,
    });
    expect(summary.practices.map((practice) => practice.membership)).toEqual([
      "full",
      "partial",
      "partial",
    ]);
    expect(summary.practices.slice(1).map((practice) => practice.state)).toEqual([
      "partial_week",
      "partial_week",
    ]);
    expect(summary.practices[1]).toMatchObject({
      sessionCount: 1,
      sessionTarget: null,
      sessionRemaining: null,
      minutesLogged: 60,
      minutesTarget: null,
      minutesRemaining: null,
    });
  });

  it("keeps source order, including inactive practices only when they have week work", () => {
    const inactive = {
      ...writeGoal,
      id: "inactive",
      inactiveFromDate: "2026-07-13",
    };
    const inactiveWithCorrection = {
      ...writeGoal,
      id: "inactive-with-work",
      inactiveFromDate: "2026-07-13",
    };
    const activeSecond = { ...strengthGoal, id: "second" };
    const activeThird = { ...countOnlyGoal, id: "third" };

    const summary = build(
      [activeThird, inactive, inactiveWithCorrection, activeSecond],
      [log("grandfathered", inactiveWithCorrection.id, "2026-07-13", 30)],
    );

    expect(summary.practices.map((practice) => practice.goalId)).toEqual([
      "third",
      "inactive-with-work",
      "second",
    ]);
    expect(summary.practices[1]).toMatchObject({
      membership: "inactive",
      state: "partial_week",
      sessionCount: 1,
      sessionTarget: null,
    });
  });

  it("clamps week and rhythm bounds to an early-ended cycle", () => {
    const ended: Cycle = {
      ...cycle,
      endDate: "2026-07-14",
      status: "ended_early",
    };
    const logs = [
      log("in-range", writeGoal.id, "2026-07-14", 30),
      log("after-end", writeGoal.id, "2026-07-15", 30),
    ];

    const summary = build([writeGoal], logs, "2026-07-18", [], ended);

    expect(summary.throughDate).toBe("2026-07-14");
    expect(summary.week).toEqual({
      startDate: "2026-07-13",
      endDate: "2026-07-14",
      calendarDaysRemaining: 0,
    });
    expect(summary.totals).toEqual({ sessionCount: 1, minutesLogged: 30 });
    expect(summary.todaySessions).toEqual([]);
    expect(summary.recentDays[6].localDate).toBe("2026-07-14");
    expect(summary.previousWeekSessionDelta).toBe(1);
  });

  it("returns no previous-week delta in the first in-cycle week", () => {
    const firstWeekCycle: Cycle = {
      ...cycle,
      startDate: "2026-07-15",
      endDate: "2026-08-13",
    };
    const firstWeekGoal = {
      ...writeGoal,
      activeFromDate: firstWeekCycle.startDate,
    };

    const summary = build(
      [firstWeekGoal],
      [log("today", firstWeekGoal.id, "2026-07-15", 30)],
      "2026-07-15",
      [],
      firstWeekCycle,
    );

    expect(summary.week).toEqual({
      startDate: "2026-07-15",
      endDate: "2026-07-19",
      calendarDaysRemaining: 4,
    });
    expect(summary.previousWeekSessionDelta).toBeNull();
    expect(summary.recentDays.slice(0, 6).every((day) => day.sessionCount === 0)).toBe(
      true,
    );
  });
});
