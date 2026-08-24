import {
  calculateGoalStreak,
  calculateGoalWeekProgress,
  calendarDayIntensity,
  goalConfigurationOn,
} from "../../src/features/cycles/domain/cycleProgress";
import type { CycleGoal, GoalRevision, SessionLog } from "../../src/features/cycles/domain/types";

const strengthGoal: CycleGoal = {
  id: "goal-strength",
  cycleId: "cycle-1",
  name: "Strength",
  cadence: "weekly",
  weeklyTargetCount: 3,
  expectedDurationMinutes: 60,
  createdAt: "2026-07-01T00:00:00.000Z",
};

const strengthLogs: SessionLog[] = [
  { id: "log-1", cycleGoalId: "goal-strength", localDate: "2026-07-21", startedAt: "2026-07-21T00:00:00.000Z", durationMinutes: 60, createdAt: "2026-07-21T00:00:00.000Z" },
  { id: "log-2", cycleGoalId: "goal-strength", localDate: "2026-07-23", startedAt: "2026-07-23T00:00:00.000Z", durationMinutes: 68, createdAt: "2026-07-23T00:00:00.000Z" },
  { id: "log-3", cycleGoalId: "goal-strength", localDate: "2026-07-13", startedAt: "2026-07-13T00:00:00.000Z", durationMinutes: 45, createdAt: "2026-07-13T00:00:00.000Z" },
];

describe("calculateGoalWeekProgress", () => {
  it("counts sessions and minutes only inside the current week", () => {
    const progress = calculateGoalWeekProgress(strengthGoal, [], strengthLogs, "2026-07-23");
    expect(progress).toEqual({
      sessionCount: 2,
      sessionTarget: 3,
      minutesLogged: 128,
      minutesTarget: 180,
    });
  });

  it("returns a null minutesTarget when the goal has no expected duration", () => {
    const countOnlyGoal: CycleGoal = { ...strengthGoal, id: "goal-count-only", expectedDurationMinutes: null };
    const progress = calculateGoalWeekProgress(countOnlyGoal, [], [], "2026-07-23");
    expect(progress.minutesTarget).toBeNull();
  });

  it("applies the goal revision effective on the reference date", () => {
    const revisions: GoalRevision[] = [
      { id: "rev-1", cycleGoalId: strengthGoal.id, effectiveDate: "2026-07-15", name: "Strength", cadence: "weekly", weeklyTargetCount: 2, expectedDurationMinutes: 45 },
    ];
    const progress = calculateGoalWeekProgress(strengthGoal, revisions, [], "2026-07-23");
    expect(progress.sessionTarget).toBe(2);
    expect(progress.minutesTarget).toBe(90);
  });
});

describe("goalConfigurationOn", () => {
  const revisions: GoalRevision[] = [
    { id: "rev-1", cycleGoalId: strengthGoal.id, effectiveDate: "2026-07-15", name: "Strength", cadence: "weekly", weeklyTargetCount: 2, expectedDurationMinutes: 45 },
    { id: "rev-2", cycleGoalId: strengthGoal.id, effectiveDate: "2026-07-25", name: "Strength", cadence: "weekly", weeklyTargetCount: 4, expectedDurationMinutes: 60 },
  ];

  it("uses the revision active on the given date", () => {
    expect(goalConfigurationOn(strengthGoal, revisions, "2026-07-22").weeklyTargetCount).toBe(2);
  });

  it("does not apply a revision that has not taken effect yet", () => {
    expect(goalConfigurationOn(strengthGoal, revisions, "2026-07-24").weeklyTargetCount).toBe(2);
  });

  it("falls back to the goal's own configuration before any revision applies", () => {
    expect(goalConfigurationOn(strengthGoal, revisions, "2026-07-10").weeklyTargetCount).toBe(3);
  });
});

describe("calendarDayIntensity", () => {
  const goals: CycleGoal[] = [
    strengthGoal,
    { ...strengthGoal, id: "goal-swim", name: "Swim" },
    { ...strengthGoal, id: "goal-yoga", name: "Yoga" },
    { ...strengthGoal, id: "goal-read", name: "Read" },
  ];

  it("returns 0 when nothing was logged that day", () => {
    expect(calendarDayIntensity(goals, [], "2026-07-23")).toBe(0);
  });

  it("returns 1 when fewer than half of goals were logged", () => {
    const logs: SessionLog[] = [
      { id: "log-1", cycleGoalId: "goal-strength", localDate: "2026-07-23", startedAt: "2026-07-23T00:00:00.000Z", durationMinutes: 60, createdAt: "2026-07-23T00:00:00.000Z" },
    ];
    expect(calendarDayIntensity(goals, logs, "2026-07-23")).toBe(1);
  });

  it("returns 2 when at least half of goals were logged", () => {
    const logs: SessionLog[] = [
      { id: "log-1", cycleGoalId: "goal-strength", localDate: "2026-07-23", startedAt: "2026-07-23T00:00:00.000Z", durationMinutes: 60, createdAt: "2026-07-23T00:00:00.000Z" },
      { id: "log-2", cycleGoalId: "goal-swim", localDate: "2026-07-23", startedAt: "2026-07-23T00:00:00.000Z", durationMinutes: 45, createdAt: "2026-07-23T00:00:00.000Z" },
    ];
    expect(calendarDayIntensity(goals, logs, "2026-07-23")).toBe(2);
  });
});

describe("calculateGoalStreak", () => {
  const dailyGoal: CycleGoal = {
    id: "goal-read",
    cycleId: "cycle-1",
    name: "Read",
    cadence: "daily",
    weeklyTargetCount: 7,
    expectedDurationMinutes: 20,
    createdAt: "2026-07-01T00:00:00.000Z",
  };

  function logOn(cycleGoalId: string, localDate: string): SessionLog {
    return {
      id: `log-${cycleGoalId}-${localDate}`,
      cycleGoalId,
      localDate,
      startedAt: `${localDate}T00:00:00.000Z`,
      durationMinutes: 20,
      createdAt: `${localDate}T00:00:00.000Z`,
    };
  }

  describe("daily cadence", () => {
    it("counts consecutive days ending yesterday when today has no log yet", () => {
      const logs = [
        logOn(dailyGoal.id, "2026-07-21"),
        logOn(dailyGoal.id, "2026-07-22"),
        logOn(dailyGoal.id, "2026-07-23"),
      ];
      expect(calculateGoalStreak(dailyGoal, [], logs, "2026-07-24")).toBe(3);
    });

    it("extends the streak to include today once today is logged", () => {
      const logs = [
        logOn(dailyGoal.id, "2026-07-22"),
        logOn(dailyGoal.id, "2026-07-23"),
        logOn(dailyGoal.id, "2026-07-24"),
      ];
      expect(calculateGoalStreak(dailyGoal, [], logs, "2026-07-24")).toBe(3);
    });

    it("is zero once a gap reaches yesterday, even with older logs", () => {
      const logs = [
        logOn(dailyGoal.id, "2026-07-20"),
        logOn(dailyGoal.id, "2026-07-22"),
      ];
      expect(calculateGoalStreak(dailyGoal, [], logs, "2026-07-24")).toBe(0);
    });
  });

  describe("weekly cadence", () => {
    it("counts consecutive prior weeks that met target while the current week is still in progress", () => {
      const logs = [
        // Current week (2026-07-20..26): only 1 session so far, target not yet met.
        logOn(strengthGoal.id, "2026-07-21"),
        // Prior week (2026-07-13..19): met target of 3.
        logOn(strengthGoal.id, "2026-07-14"),
        logOn(strengthGoal.id, "2026-07-15"),
        logOn(strengthGoal.id, "2026-07-16"),
        // Two weeks prior (2026-07-06..12): met target of 3.
        logOn(strengthGoal.id, "2026-07-07"),
        logOn(strengthGoal.id, "2026-07-08"),
        logOn(strengthGoal.id, "2026-07-09"),
      ];
      expect(calculateGoalStreak(strengthGoal, [], logs, "2026-07-24")).toBe(2);
    });

    it("includes the current week once it has already met its target", () => {
      const logs = [
        logOn(strengthGoal.id, "2026-07-20"),
        logOn(strengthGoal.id, "2026-07-21"),
        logOn(strengthGoal.id, "2026-07-22"),
        logOn(strengthGoal.id, "2026-07-14"),
        logOn(strengthGoal.id, "2026-07-15"),
        logOn(strengthGoal.id, "2026-07-16"),
      ];
      expect(calculateGoalStreak(strengthGoal, [], logs, "2026-07-24")).toBe(2);
    });

    it("stops at the first prior week that missed its target", () => {
      const logs = [
        // Prior week met.
        logOn(strengthGoal.id, "2026-07-14"),
        logOn(strengthGoal.id, "2026-07-15"),
        logOn(strengthGoal.id, "2026-07-16"),
        // Two weeks prior missed (only 1 session).
        logOn(strengthGoal.id, "2026-07-07"),
      ];
      expect(calculateGoalStreak(strengthGoal, [], logs, "2026-07-24")).toBe(1);
    });

    it("uses the weekly target that was effective for each historical week", () => {
      const revisions: GoalRevision[] = [
        {
          id: "rev-1",
          cycleGoalId: strengthGoal.id,
          effectiveDate: "2026-07-15",
          name: "Strength",
          cadence: "weekly",
          weeklyTargetCount: 2,
          expectedDurationMinutes: 45,
        },
      ];
      const logs = [
        // Prior week (2026-07-13..19): revision drops target to 2, effective mid-week.
        logOn(strengthGoal.id, "2026-07-16"),
        logOn(strengthGoal.id, "2026-07-17"),
      ];
      expect(calculateGoalStreak(strengthGoal, revisions, logs, "2026-07-24")).toBe(1);
    });
  });
});
