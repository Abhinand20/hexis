import {
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
  { id: "log-1", cycleGoalId: "goal-strength", localDate: "2026-07-21", durationMinutes: 60, createdAt: "2026-07-21T00:00:00.000Z" },
  { id: "log-2", cycleGoalId: "goal-strength", localDate: "2026-07-23", durationMinutes: 68, createdAt: "2026-07-23T00:00:00.000Z" },
  { id: "log-3", cycleGoalId: "goal-strength", localDate: "2026-07-13", durationMinutes: 45, createdAt: "2026-07-13T00:00:00.000Z" },
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
      { id: "log-1", cycleGoalId: "goal-strength", localDate: "2026-07-23", durationMinutes: 60, createdAt: "2026-07-23T00:00:00.000Z" },
    ];
    expect(calendarDayIntensity(goals, logs, "2026-07-23")).toBe(1);
  });

  it("returns 2 when at least half of goals were logged", () => {
    const logs: SessionLog[] = [
      { id: "log-1", cycleGoalId: "goal-strength", localDate: "2026-07-23", durationMinutes: 60, createdAt: "2026-07-23T00:00:00.000Z" },
      { id: "log-2", cycleGoalId: "goal-swim", localDate: "2026-07-23", durationMinutes: 45, createdAt: "2026-07-23T00:00:00.000Z" },
    ];
    expect(calendarDayIntensity(goals, logs, "2026-07-23")).toBe(2);
  });
});
