import { render, userEvent } from "@testing-library/react-native";

import { buildDaySummary, buildWeekSummary } from "../../src/features/cycles/domain/cycleSummary";
import { isGoalActiveOn } from "../../src/features/cycles/domain/goalMembership";
import type { CycleGoal, SessionLog } from "../../src/features/cycles/domain/types";
import { ActivityEditorSheet } from "../../src/features/logging/components/ActivityEditorSheet";
import { createCycle } from "../../src/test/factories";

const cycle = createCycle({
  id: "cycle-1",
  startDate: "2026-08-01",
  endDate: "2026-08-30",
  durationDays: 30,
});

const strength: CycleGoal = {
  id: "goal-strength",
  cycleId: cycle.id,
  name: "Strength",
  cadence: "weekly",
  weeklyTargetCount: 3,
  expectedDurationMinutes: 45,
  activeFromDate: "2026-08-01",
  inactiveFromDate: "2026-08-15",
  createdAt: "2026-08-01T07:00:00.000Z",
};

const read: CycleGoal = {
  ...strength,
  id: "goal-read",
  name: "Read",
  cadence: "daily",
  weeklyTargetCount: 7,
  expectedDurationMinutes: 20,
  activeFromDate: "2026-08-18",
  inactiveFromDate: null,
  createdAt: "2026-08-18T07:00:00.000Z",
};

const goals = [strength, read];

function log(goal: CycleGoal, localDate: string): SessionLog {
  return {
    id: `log-${goal.id}-${localDate}`,
    cycleGoalId: goal.id,
    localDate,
    startedAt: `${localDate}T16:00:00.000Z`,
    durationMinutes: goal.expectedDurationMinutes,
    createdAt: `${localDate}T16:00:00.000Z`,
  };
}

it("keeps historical summaries while excluding practices outside the selected day", async () => {
  const logs = [log(strength, "2026-08-10"), log(read, "2026-08-20")];

  expect(buildDaySummary(goals, [], logs, "2026-08-10").practices).toEqual([
    expect.objectContaining({ goalId: strength.id, logged: true }),
  ]);
  expect(buildDaySummary(goals, [], logs, "2026-08-20").practices).toEqual([
    expect.objectContaining({ goalId: read.id, logged: true }),
  ]);

  const boundaryWeek = buildWeekSummary(goals, [], logs, "2026-08-17", cycle);
  expect(boundaryWeek.practiceProgress).toEqual([
    expect.objectContaining({
      goalId: read.id,
      sessionCount: 1,
      membership: "partial",
      met: null,
    }),
  ]);

  const screen = await render(
    <ActivityEditorSheet
      mode="add"
      visible
      practices={[]}
      practicesForDate={(localDate) =>
        goals
          .filter((goal) => isGoalActiveOn(goal, localDate))
          .map((goal) => ({ id: goal.id, name: goal.name }))
      }
      initialValue={{
        practiceId: read.id,
        localDate: "2026-08-20",
        startedTime: "09:00",
        durationMinutes: null,
      }}
      minDate={cycle.startDate}
      maxDate={cycle.endDate}
      onDismiss={jest.fn()}
      onSave={jest.fn()}
    />,
  );

  expect(screen.queryByRole("radio", { name: "Strength" })).toBeNull();
  expect(screen.getByRole("radio", { name: "Read" })).toBeChecked();

  const user = userEvent.setup();
  await user.clear(screen.getByLabelText("Activity date"));
  await user.type(screen.getByLabelText("Activity date"), "2026-08-10");

  expect(screen.getByRole("radio", { name: "Strength" })).toBeTruthy();
  expect(screen.queryByRole("radio", { name: "Read" })).toBeNull();
});
