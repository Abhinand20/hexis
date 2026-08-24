import { render, waitFor } from "@testing-library/react-native";
import { userEvent } from "@testing-library/react-native";
import { Alert } from "react-native";

import EditGoalScreen from "../../app/cycles/[cycleId]/edit-goal/[goalId]";
import type { CycleGoal } from "../../src/features/cycles/domain/types";
import { createCycle } from "../../src/test/factories";

const TODAY = "2026-07-15";
const mockBack = jest.fn();
const mockCreateRevision = jest.fn();
const mockGetActiveCycle = jest.fn();
const mockListForCycle = jest.fn();
const mockListRevisions = jest.fn();
const mockStopTracking = jest.fn();

jest.mock("expo-router", () => ({
  ...jest.requireActual("expo-router"),
  useLocalSearchParams: () => ({
    cycleId: "cycle-1",
    goalId: "goal-strength",
  }),
  useRouter: () => ({ back: mockBack }),
}));

jest.mock("../../src/db/DatabaseProvider", () => {
  const db = {};
  return {
    useDatabase: () => ({
      db,
      isLoading: false,
      error: null,
    }),
  };
});

jest.mock("../../src/features/cycles/data/cycleRepository", () => ({
  createCycleRepository: () => ({
    getActiveCycle: () => mockGetActiveCycle(),
  }),
}));

jest.mock("../../src/features/cycles/domain/date", () => ({
  ...jest.requireActual("../../src/features/cycles/domain/date"),
  todayLocalDate: () => TODAY,
}));

jest.mock("../../src/features/goals/data/goalRepository", () => ({
  createGoalRepository: () => ({
    createRevision: (...args: unknown[]) => mockCreateRevision(...args),
    listForCycle: (...args: unknown[]) => mockListForCycle(...args),
    listRevisions: (...args: unknown[]) => mockListRevisions(...args),
    stopTracking: (...args: unknown[]) => mockStopTracking(...args),
  }),
}));

const strengthGoal: CycleGoal = {
  id: "goal-strength",
  cycleId: "cycle-1",
  name: "Strength",
  cadence: "weekly",
  weeklyTargetCount: 3,
  expectedDurationMinutes: 60,
  activeFromDate: "2026-07-01",
  inactiveFromDate: null,
  createdAt: "2026-07-01T00:00:00.000Z",
};

const mockAlert = jest.spyOn(Alert, "alert").mockImplementation(() => {});

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((res) => {
    resolve = res;
  });
  return { promise, resolve };
}

function respondToAlertWith(label: string) {
  mockAlert.mockImplementationOnce((_title, _message, buttons) => {
    const action = buttons?.find((button) => button.text === label);
    if (!action) {
      throw new Error(`Alert action not found: ${label}`);
    }
    action.onPress?.();
  });
}

async function renderReadyScreen() {
  const screen = await render(<EditGoalScreen />);
  await waitFor(() => {
    expect(
      screen.getByRole("button", { name: "Stop tracking this practice" }),
    ).toBeTruthy();
  });
  return screen;
}

beforeEach(() => {
  mockAlert.mockClear();
  mockBack.mockReset();
  mockCreateRevision.mockReset();
  mockGetActiveCycle.mockReset();
  mockListForCycle.mockReset();
  mockListRevisions.mockReset();
  mockStopTracking.mockReset();

  mockGetActiveCycle.mockResolvedValue(createCycle({ id: "cycle-1" }));
  mockListForCycle.mockResolvedValue([strengthGoal]);
  mockListRevisions.mockResolvedValue([]);
  mockStopTracking.mockResolvedValue({
    ...strengthGoal,
    inactiveFromDate: TODAY,
  });
});

it("confirms the effective date and preserves earlier history before stopping", async () => {
  const screen = await renderReadyScreen();
  const user = userEvent.setup();
  respondToAlertWith("Stop tracking");

  await user.press(
    screen.getByRole("button", { name: "Stop tracking this practice" }),
  );

  expect(mockAlert).toHaveBeenCalledWith(
    "Stop tracking Strength?",
    `This takes effect today, ${TODAY}. Earlier logs and history for this practice will remain unchanged.`,
    expect.arrayContaining([
      expect.objectContaining({ text: "Cancel", style: "cancel" }),
      expect.objectContaining({ text: "Stop tracking", style: "destructive" }),
    ]),
  );

  expect(mockStopTracking).toHaveBeenCalledTimes(1);
  expect(mockStopTracking).toHaveBeenCalledWith("goal-strength", TODAY);
  await waitFor(() => {
    expect(mockBack).toHaveBeenCalledTimes(1);
  });
});

it("leaves the practice unchanged when confirmation is cancelled", async () => {
  const screen = await renderReadyScreen();
  const user = userEvent.setup();
  respondToAlertWith("Cancel");

  await user.press(
    screen.getByRole("button", { name: "Stop tracking this practice" }),
  );

  expect(mockStopTracking).not.toHaveBeenCalled();
  expect(mockBack).not.toHaveBeenCalled();
  expect(
    screen.getByRole("button", { name: "Stop tracking this practice" }),
  ).toBeEnabled();
});

it("disables duplicate actions while stopping and navigates after success", async () => {
  const pendingStop = deferred<CycleGoal>();
  mockStopTracking.mockReturnValueOnce(pendingStop.promise);
  const screen = await renderReadyScreen();
  const user = userEvent.setup();
  respondToAlertWith("Stop tracking");

  await user.press(
    screen.getByRole("button", { name: "Stop tracking this practice" }),
  );

  await waitFor(() => {
    expect(
      screen.getByRole("button", { name: "Stopping practice…" }),
    ).toBeDisabled();
    expect(screen.getByRole("button", { name: "Saving…" })).toBeDisabled();
  });
  expect(mockStopTracking).toHaveBeenCalledTimes(1);

  pendingStop.resolve({ ...strengthGoal, inactiveFromDate: TODAY });
  await waitFor(() => {
    expect(mockBack).toHaveBeenCalledTimes(1);
  });
});

it("guides and allows retry when the last active practice cannot be stopped", async () => {
  mockStopTracking
    .mockRejectedValueOnce(
      new Error("An active cycle must keep at least one practice"),
    )
    .mockResolvedValueOnce({ ...strengthGoal, inactiveFromDate: TODAY });
  const screen = await renderReadyScreen();
  const user = userEvent.setup();
  respondToAlertWith("Stop tracking");

  await user.press(
    screen.getByRole("button", { name: "Stop tracking this practice" }),
  );

  await waitFor(() => {
    expect(
      screen.getByText(
        "Add another practice first, or end this cycle before stopping its last practice.",
      ),
    ).toBeTruthy();
  });
  expect(mockBack).not.toHaveBeenCalled();
  expect(
    screen.getByRole("button", { name: "Stop tracking this practice" }),
  ).toBeEnabled();

  respondToAlertWith("Stop tracking");
  await user.press(
    screen.getByRole("button", { name: "Stop tracking this practice" }),
  );

  expect(mockStopTracking).toHaveBeenCalledTimes(2);
  await waitFor(() => {
    expect(mockBack).toHaveBeenCalledTimes(1);
  });
});

it("does not offer stopping for a practice added today or already stopped", async () => {
  mockListForCycle.mockResolvedValueOnce([
    { ...strengthGoal, activeFromDate: TODAY },
  ]);
  const addedToday = await render(<EditGoalScreen />);

  await waitFor(() => {
    expect(addedToday.getByLabelText("Practice name")).toBeTruthy();
  });
  expect(
    addedToday.queryByRole("button", { name: "Stop tracking this practice" }),
  ).toBeNull();
  await addedToday.unmount();

  mockListForCycle.mockResolvedValueOnce([
    { ...strengthGoal, inactiveFromDate: TODAY },
  ]);
  const stopped = await render(<EditGoalScreen />);

  await waitFor(() => {
    expect(stopped.getByLabelText("Practice name")).toBeTruthy();
  });
  expect(
    stopped.queryByRole("button", { name: "Stop tracking this practice" }),
  ).toBeNull();
});

it("does not offer stopping when the cycle is archived", async () => {
  mockGetActiveCycle.mockResolvedValueOnce(null);
  const screen = await render(<EditGoalScreen />);

  await waitFor(() => {
    expect(screen.getByText("This cycle is no longer active.")).toBeTruthy();
  });
  expect(
    screen.queryByRole("button", { name: "Stop tracking this practice" }),
  ).toBeNull();
  expect(mockListForCycle).not.toHaveBeenCalled();
});
