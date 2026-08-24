import { render, waitFor } from "@testing-library/react-native";
import { userEvent } from "@testing-library/react-native";

import AddGoalScreen from "../../app/cycles/[cycleId]/add-goal";
import { todayLocalDate } from "../../src/features/cycles/domain/date";
import type { CycleGoal } from "../../src/features/cycles/domain/types";
import { createCycle } from "../../src/test/factories";

const mockBack = jest.fn();
const mockSetOptions = jest.fn();
const mockGetActiveCycle = jest.fn();
const mockCreateForActiveCycle = jest.fn();

jest.mock("expo-router", () => ({
  ...jest.requireActual("expo-router"),
  useLocalSearchParams: () => ({ cycleId: "cycle-1" }),
  useNavigation: () => ({ setOptions: mockSetOptions }),
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
    getActiveCycle: (...args: unknown[]) => mockGetActiveCycle(...args),
  }),
}));

jest.mock("../../src/features/goals/data/goalRepository", () => ({
  createGoalRepository: () => ({
    createForActiveCycle: (...args: unknown[]) =>
      mockCreateForActiveCycle(...args),
  }),
}));

function createDeferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

function addedGoal(overrides: Partial<CycleGoal> = {}): CycleGoal {
  return {
    id: "goal-added",
    cycleId: "cycle-1",
    name: "Strength",
    cadence: "daily",
    weeklyTargetCount: 7,
    expectedDurationMinutes: 30,
    activeFromDate: todayLocalDate(),
    inactiveFromDate: null,
    createdAt: new Date().toISOString(),
    ...overrides,
  };
}

beforeEach(() => {
  mockBack.mockReset();
  mockSetOptions.mockReset();
  mockGetActiveCycle.mockReset();
  mockCreateForActiveCycle.mockReset();
  mockGetActiveCycle.mockResolvedValue(
    createCycle({ id: "cycle-1", name: "Summer reset" }),
  );
  mockCreateForActiveCycle.mockResolvedValue(addedGoal());
});

async function renderReadyScreen() {
  const screen = await render(<AddGoalScreen />);
  await waitFor(() => {
    expect(screen.getByLabelText("Practice name")).toBeTruthy();
  });
  return screen;
}

it("creates exactly one distinct practice effective today, locks while pending, and dismisses", async () => {
  const deferred = createDeferred<CycleGoal>();
  mockCreateForActiveCycle.mockReturnValueOnce(deferred.promise);
  const screen = await renderReadyScreen();
  const user = userEvent.setup();

  expect(
    screen.getByText(
      `Selected: Custom practice. Adding one practice to Summer reset. It starts today (${todayLocalDate()}); earlier cycle days stay unchanged. Duplicate names are allowed—this practice keeps its own activity history.`,
    ),
  ).toBeTruthy();

  // A duplicate display name is intentionally valid; the new row receives its
  // own goal identity and is identified by the single editor selection.
  await user.type(screen.getByLabelText("Practice name"), "Strength");
  await user.press(screen.getByRole("button", { name: "Daily" }));
  await user.clear(screen.getByLabelText("Weekly target count"));
  await user.type(screen.getByLabelText("Weekly target count"), "7");
  await user.type(
    screen.getByLabelText("Expected duration (minutes)"),
    "30",
  );
  await user.press(screen.getByRole("button", { name: "Add practice" }));

  expect(mockCreateForActiveCycle).toHaveBeenCalledTimes(1);
  expect(mockCreateForActiveCycle).toHaveBeenCalledWith(
    {
      cycleId: "cycle-1",
      name: "Strength",
      cadence: "daily",
      weeklyTargetCount: 7,
      expectedDurationMinutes: 30,
    },
    todayLocalDate(),
  );
  await waitFor(() => {
    expect(screen.getByRole("button", { name: "Saving…" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Cancel" })).toBeDisabled();
    expect(screen.getByLabelText("Practice name").props.editable).toBe(false);
    expect(
      screen.getByRole("button", { name: "Strength template" }),
    ).toBeDisabled();
    expect(mockSetOptions).toHaveBeenCalledWith({
      gestureEnabled: false,
      headerBackVisible: false,
    });
  });
  expect(mockBack).not.toHaveBeenCalled();

  deferred.resolve(addedGoal());
  await waitFor(() => {
    expect(mockBack).toHaveBeenCalledTimes(1);
  });
});

it("prefills from a shared starter template and can return to a blank custom practice", async () => {
  const screen = await renderReadyScreen();
  const user = userEvent.setup();

  expect(
    screen.getByRole("button", { name: "Custom practice" }),
  ).toBeSelected();
  await user.press(screen.getByRole("button", { name: "Strength template" }));

  expect(
    screen.getByRole("button", { name: "Strength template" }),
  ).toBeSelected();
  expect(screen.getByLabelText("Practice name").props.value).toBe("Strength");
  expect(screen.getByLabelText("Weekly target count").props.value).toBe("3");
  expect(
    screen.getByLabelText("Expected duration (minutes)").props.value,
  ).toBe("60");
  expect(screen.getByText(/^Selected: Strength\./)).toBeTruthy();

  await user.press(screen.getByRole("button", { name: "Custom practice" }));
  expect(screen.getByLabelText("Practice name").props.value).toBe("");
  expect(screen.getByLabelText("Weekly target count").props.value).toBe("1");
  expect(
    screen.getByLabelText("Expected duration (minutes)").props.value,
  ).toBe("");
});

it("validates the shared practice fields before calling the repository", async () => {
  const screen = await renderReadyScreen();
  const user = userEvent.setup();

  await user.press(screen.getByRole("button", { name: "Custom practice" }));
  await user.press(screen.getByRole("button", { name: "Add practice" }));
  expect(screen.getByText("Name is required.")).toBeTruthy();
  expect(mockCreateForActiveCycle).not.toHaveBeenCalled();

  await user.type(screen.getByLabelText("Practice name"), "Meditate");
  await user.clear(screen.getByLabelText("Weekly target count"));
  await user.type(screen.getByLabelText("Weekly target count"), "0");
  await user.press(screen.getByRole("button", { name: "Add practice" }));
  expect(
    screen.getByText("Weekly target must be a positive whole number."),
  ).toBeTruthy();
  expect(mockCreateForActiveCycle).not.toHaveBeenCalled();
});

it("shows a retryable repository error and saves on the next attempt", async () => {
  mockCreateForActiveCycle
    .mockRejectedValueOnce(new Error("Cycle ended before this practice was added"))
    .mockResolvedValueOnce(addedGoal({ name: "Meditate" }));
  const screen = await renderReadyScreen();
  const user = userEvent.setup();

  await user.type(screen.getByLabelText("Practice name"), "Meditate");
  await user.press(screen.getByRole("button", { name: "Add practice" }));

  await waitFor(() => {
    expect(
      screen.getByText("Cycle ended before this practice was added"),
    ).toBeTruthy();
  });
  expect(screen.getByRole("button", { name: "Add practice" })).toBeEnabled();
  expect(mockBack).not.toHaveBeenCalled();

  await user.press(screen.getByRole("button", { name: "Add practice" }));
  await waitFor(() => {
    expect(mockCreateForActiveCycle).toHaveBeenCalledTimes(2);
    expect(mockBack).toHaveBeenCalledTimes(1);
  });
});

it("does not expose the editor when the requested cycle is not active", async () => {
  mockGetActiveCycle.mockResolvedValue(null);
  const screen = await render(<AddGoalScreen />);
  const user = userEvent.setup();

  await waitFor(() => {
    expect(
      screen.getByText("Practices can only be added to the active cycle."),
    ).toBeTruthy();
  });
  expect(screen.queryByLabelText("Practice name")).toBeNull();

  await user.press(screen.getByRole("button", { name: "Back to settings" }));
  expect(mockBack).toHaveBeenCalledTimes(1);
});
