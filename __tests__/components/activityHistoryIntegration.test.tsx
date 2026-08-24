import { act, render, userEvent, waitFor } from "@testing-library/react-native";

import HistoryScreen from "../../app/(tabs)/history";
import type { CycleHistoryState } from "../../src/features/cycles/hooks/useCycleHistory";
import { activityInstantFromLocalFields } from "../../src/features/logging/domain/activityDateTime";
import { createCycle } from "../../src/test/factories";

const mockSetParams = jest.fn();
const mockPush = jest.fn();
const mockUseCycleHistory = jest.fn();
const mockCreate = jest.fn();
const mockCorrect = jest.fn();
const mockDeleteById = jest.fn();
let mockSearchParams: { filter?: string; date?: string } = {
  filter: "day",
  date: "2026-08-20",
};

jest.mock("expo-router", () => {
  const React = require("react") as typeof import("react");
  return {
    ...jest.requireActual("expo-router"),
    useFocusEffect: (callback: () => void) => {
      React.useEffect(() => callback(), [callback]);
    },
    useLocalSearchParams: () => mockSearchParams,
    useRouter: () => ({ push: mockPush, setParams: mockSetParams }),
  };
});

jest.mock("../../src/features/cycles/domain/date", () => {
  const actual = jest.requireActual(
    "../../src/features/cycles/domain/date",
  ) as typeof import("../../src/features/cycles/domain/date");
  return { ...actual, todayLocalDate: () => "2026-08-23" };
});

jest.mock("../../src/db/DatabaseProvider", () => {
  const db = {};
  return {
    useDatabase: () => ({
      db,
      isLoading: false,
      error: null,
      resetDatabase: jest.fn(),
    }),
  };
});

jest.mock("../../src/features/cycles/hooks/useCycleHistory", () => ({
  useCycleHistory: (...args: unknown[]) => mockUseCycleHistory(...args),
}));

jest.mock("../../src/features/logging/data/sessionRepository", () => ({
  createSessionRepository: () => ({
    create: (...args: unknown[]) => mockCreate(...args),
    correct: (...args: unknown[]) => mockCorrect(...args),
    deleteById: (...args: unknown[]) => mockDeleteById(...args),
  }),
}));

const strengthGoal = {
  id: "goal-strength",
  cycleId: "cycle-1",
  name: "Strength",
  cadence: "weekly" as const,
  weeklyTargetCount: 3,
  expectedDurationMinutes: 60,
  activeFromDate: "2026-08-01",
  inactiveFromDate: null,
  createdAt: "2026-08-01T07:00:00.000Z",
};

const readGoal = {
  ...strengthGoal,
  id: "goal-read",
  name: "Read",
  cadence: "daily" as const,
  weeklyTargetCount: 7,
  expectedDurationMinutes: null,
};

const originalSession = {
  id: "log-strength",
  cycleGoalId: strengthGoal.id,
  localDate: "2026-08-20",
  startedAt: "2026-08-20T16:30:00-07:00",
  durationMinutes: 30,
  createdAt: "2026-08-20T23:30:00.000Z",
};

function readyState(): Extract<CycleHistoryState, { status: "ready" }> {
  const cycle = createCycle({
    id: "cycle-1",
    startDate: "2026-08-01",
    endDate: "2026-08-30",
    durationDays: 30,
  });
  return {
    status: "ready",
    cycle,
    cycles: [cycle],
    archiveItems: [
      {
        id: cycle.id,
        name: cycle.name,
        dateRange: "Aug 1–Aug 30, 2026",
        status: cycle.status,
        sessionCount: 1,
        minutesLogged: 30,
        activeDayRatio: 1 / 23,
        practiceCount: 2,
        practiceNames: ["Strength", "Read"],
      },
    ],
    goals: [strengthGoal, readGoal],
    revisions: [],
    logs: [originalSession],
  };
}

async function pressModalSave(
  screen: Awaited<ReturnType<typeof render>>,
  name: "Add activity" | "Save changes",
) {
  const buttons = screen.getAllByRole("button", { name });
  await userEvent.setup().press(buttons[buttons.length - 1]);
}

beforeEach(() => {
  jest.clearAllMocks();
  mockSearchParams = { filter: "day", date: "2026-08-20" };
  mockUseCycleHistory.mockReturnValue(readyState());
});

it("refreshes the loaded history when the screen receives focus", async () => {
  await render(<HistoryScreen />);

  await waitFor(() => {
    expect(
      Math.max(...mockUseCycleHistory.mock.calls.map(([version]) => version)),
    ).toBeGreaterThan(0);
  });
});

it("adds a durationless activity to an earlier day using the current local clock", async () => {
  jest.useFakeTimers();
  jest.setSystemTime(new Date("2026-08-23T17:45:00-07:00"));
  mockCreate.mockResolvedValue({
    ...originalSession,
    id: "log-added",
    startedAt: activityInstantFromLocalFields("2026-08-20", "17:45"),
    durationMinutes: null,
  });

  const screen = await render(<HistoryScreen />);
  const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });
  await user.press(screen.getByRole("button", { name: "Add activity" }));

  expect(screen.getByRole("radio", { name: "Strength" })).toBeChecked();
  expect(screen.getByDisplayValue("2026-08-20")).toBeTruthy();
  expect(screen.getByDisplayValue("17:45")).toBeTruthy();
  expect(screen.getByRole("radio", { name: "No duration" })).toBeChecked();

  const saveButtons = screen.getAllByRole("button", { name: "Add activity" });
  await user.press(saveButtons[saveButtons.length - 1]);

  await waitFor(() => {
    expect(mockCreate).toHaveBeenCalledWith({
      cycleGoalId: "goal-strength",
      startedAt: activityInstantFromLocalFields("2026-08-20", "17:45"),
      durationMinutes: null,
    });
  });
  expect(mockSetParams).toHaveBeenLastCalledWith({
    filter: "day",
    date: "2026-08-20",
  });
  expect(Math.max(...mockUseCycleHistory.mock.calls.map(([version]) => version))).toBeGreaterThan(1);
  jest.useRealTimers();
});

it("edits the practice, moves the day, and preserves a missing duration", async () => {
  mockCorrect.mockResolvedValue({
    ...originalSession,
    cycleGoalId: "goal-read",
    localDate: "2026-08-19",
    startedAt: activityInstantFromLocalFields("2026-08-19", "16:30"),
    durationMinutes: null,
  });
  const screen = await render(<HistoryScreen />);
  const user = userEvent.setup();

  await user.press(screen.getByRole("button", { name: /Edit Strength activity/i }));
  await user.press(screen.getByRole("radio", { name: "Read" }));
  await user.clear(screen.getByLabelText("Activity date"));
  await user.type(screen.getByLabelText("Activity date"), "2026-08-19");
  await user.press(screen.getByRole("radio", { name: "No duration" }));
  await pressModalSave(screen, "Save changes");

  await waitFor(() => {
    expect(mockCorrect).toHaveBeenCalledWith("log-strength", {
      cycleGoalId: "goal-read",
      startedAt: activityInstantFromLocalFields("2026-08-19", "16:30"),
      durationMinutes: null,
    });
  });
  expect(mockSetParams).toHaveBeenLastCalledWith({
    filter: "day",
    date: "2026-08-19",
  });
  expect(screen.queryByText("Edit activity")).toBeNull();
});

it("cancels deletion, then confirms a tombstone delete and refreshes history", async () => {
  mockDeleteById.mockResolvedValue(undefined);
  const screen = await render(<HistoryScreen />);
  const user = userEvent.setup();

  await user.press(screen.getByRole("button", { name: /Edit Strength activity/i }));
  await user.press(screen.getByRole("button", { name: "Delete activity" }));
  await user.press(screen.getByRole("button", { name: "Keep activity" }));
  expect(mockDeleteById).not.toHaveBeenCalled();

  await user.press(screen.getByRole("button", { name: "Delete activity" }));
  await user.press(screen.getByRole("button", { name: "Confirm delete" }));
  await waitFor(() => expect(mockDeleteById).toHaveBeenCalledWith("log-strength"));
  expect(screen.queryByText("Edit activity")).toBeNull();
});

it("keeps bounds and repository failures visible so an add can be retried", async () => {
  mockCreate.mockRejectedValueOnce(new Error("database busy"));
  const screen = await render(<HistoryScreen />);
  const user = userEvent.setup();

  await user.press(screen.getByRole("button", { name: "Add activity" }));
  await user.clear(screen.getByLabelText("Activity date"));
  await user.type(screen.getByLabelText("Activity date"), "2026-07-31");
  await pressModalSave(screen, "Add activity");
  expect(screen.getByText("Choose a date from 2026-08-01 through 2026-08-23.")).toBeTruthy();
  expect(mockCreate).not.toHaveBeenCalled();

  await user.clear(screen.getByLabelText("Activity date"));
  await user.type(screen.getByLabelText("Activity date"), "2026-08-20");
  await pressModalSave(screen, "Add activity");
  expect(await screen.findByRole("alert", { name: "database busy" })).toBeTruthy();
  expect(screen.getByText("Record work completed on this day.")).toBeTruthy();

  mockCreate.mockResolvedValue({ ...originalSession, id: "log-retry" });
  await act(async () => pressModalSave(screen, "Add activity"));
  await waitFor(() => expect(mockCreate).toHaveBeenCalledTimes(2));
});

it("updates add-activity practices when the draft date crosses membership boundaries", async () => {
  mockUseCycleHistory.mockReturnValue({
    ...readyState(),
    goals: [
      { ...strengthGoal, inactiveFromDate: "2026-08-15" },
      { ...readGoal, activeFromDate: "2026-08-18" },
    ],
  } satisfies CycleHistoryState);
  const screen = await render(<HistoryScreen />);
  const user = userEvent.setup();

  await user.press(screen.getByRole("button", { name: "Add activity" }));
  expect(screen.queryByRole("radio", { name: "Strength" })).toBeNull();
  expect(screen.getByRole("radio", { name: "Read" })).toBeChecked();

  await user.clear(screen.getByLabelText("Activity date"));
  await user.type(screen.getByLabelText("Activity date"), "2026-08-10");

  expect(screen.getByRole("radio", { name: "Strength" })).toBeTruthy();
  expect(screen.queryByRole("radio", { name: "Read" })).toBeNull();
});

it("grandfathers an inactive source practice only for an in-place correction", async () => {
  mockUseCycleHistory.mockReturnValue({
    ...readyState(),
    goals: [
      { ...strengthGoal, inactiveFromDate: "2026-08-15" },
      { ...readGoal, activeFromDate: "2026-08-18" },
    ],
  } satisfies CycleHistoryState);
  const screen = await render(<HistoryScreen />);
  const user = userEvent.setup();

  await user.press(screen.getByRole("button", { name: /Edit Strength activity/i }));
  expect(screen.getByRole("radio", { name: "Strength" })).toBeChecked();
  expect(screen.getByRole("radio", { name: "Read" })).toBeTruthy();

  await user.clear(screen.getByLabelText("Activity date"));
  await user.type(screen.getByLabelText("Activity date"), "2026-08-21");

  expect(screen.queryByRole("radio", { name: "Strength" })).toBeNull();
  expect(screen.getByRole("radio", { name: "Read" })).toBeTruthy();
});
