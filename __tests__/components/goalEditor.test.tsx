import { render, waitFor } from "@testing-library/react-native";
import { userEvent } from "@testing-library/react-native";

import EditGoalScreen from "../../app/cycles/[cycleId]/edit-goal/[goalId]";
import type { Cycle, CycleGoal, GoalRevision } from "../../src/features/cycles/domain/types";
import {
  GoalEditor,
  type GoalEditorValue,
} from "../../src/features/goals/components/GoalEditor";
import { createCycle } from "../../src/test/factories";

const mockBack = jest.fn();
const mockCreateRevision = jest.fn();
const createRevision = mockCreateRevision;
const mockGetActiveCycle = jest.fn();
const mockListForCycle = jest.fn();
const mockListRevisions = jest.fn();

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

jest.mock("../../src/features/goals/data/goalRepository", () => ({
  createGoalRepository: () => ({
    listForCycle: (...args: unknown[]) => mockListForCycle(...args),
    listRevisions: (...args: unknown[]) => mockListRevisions(...args),
    createRevision: (...args: unknown[]) => mockCreateRevision(...args),
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

const editorValue: GoalEditorValue = {
  name: "Strength",
  cadence: "weekly",
  weeklyTargetCount: 3,
  expectedDurationMinutes: 60,
};

function formatLocalDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function createDeferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

beforeEach(() => {
  mockBack.mockReset();
  createRevision.mockReset();
  mockGetActiveCycle.mockReset();
  mockListForCycle.mockReset();
  mockListRevisions.mockReset();

  mockGetActiveCycle.mockResolvedValue(createCycle({ id: "cycle-1" }));
  mockListForCycle.mockResolvedValue([strengthGoal]);
  mockListRevisions.mockResolvedValue([]);
  createRevision.mockResolvedValue({
    id: "revision-1",
    cycleGoalId: "goal-strength",
    effectiveDate: formatLocalDate(new Date()),
    name: "Strength",
    cadence: "weekly",
    weeklyTargetCount: 3,
    expectedDurationMinutes: 60,
  } satisfies GoalRevision);
});

async function renderReadyScreen() {
  const screen = await render(<EditGoalScreen />);
  await waitFor(() => {
    expect(screen.getByLabelText("Practice name")).toBeTruthy();
  });
  return screen;
}

it("saves a revision for today and navigates back on success", async () => {
  const deferred = createDeferred<GoalRevision>();
  createRevision.mockReturnValueOnce(deferred.promise);

  const screen = await renderReadyScreen();
  const user = userEvent.setup();

  expect(screen.getByLabelText("Practice name").props.value).toBe("Strength");
  expect(screen.getByLabelText("Weekly target count").props.value).toBe("3");
  expect(
    screen.getByLabelText("Expected duration (minutes)").props.value,
  ).toBe("60");

  await user.clear(screen.getByLabelText("Weekly target count"));
  await user.type(screen.getByLabelText("Weekly target count"), "4");
  await user.press(screen.getByRole("button", { name: "Save updates" }));

  const today = formatLocalDate(new Date());
  expect(createRevision).toHaveBeenCalledTimes(1);
  expect(createRevision).toHaveBeenCalledWith(
    expect.objectContaining({
      cycleGoalId: "goal-strength",
      effectiveDate: today,
      weeklyTargetCount: 4,
    }),
  );
  expect(mockBack).not.toHaveBeenCalled();

  deferred.resolve({
    id: "revision-1",
    cycleGoalId: "goal-strength",
    effectiveDate: today,
    name: "Strength",
    cadence: "weekly",
    weeklyTargetCount: 4,
    expectedDurationMinutes: 60,
  });

  await waitFor(() => {
    expect(mockBack).toHaveBeenCalled();
  });
});

it("shows an unavailable state when the cycle is not active", async () => {
  mockGetActiveCycle.mockResolvedValue(null);

  const screen = await render(<EditGoalScreen />);
  const user = userEvent.setup();

  await waitFor(() => {
    expect(screen.getByText("This cycle is no longer active.")).toBeTruthy();
  });
  expect(screen.getByRole("button", { name: "Back to cycle" })).toBeTruthy();
  expect(screen.queryByLabelText("Practice name")).toBeNull();
  expect(mockListForCycle).not.toHaveBeenCalled();

  await user.press(screen.getByRole("button", { name: "Back to cycle" }));
  expect(mockBack).toHaveBeenCalled();
});

it("shows a retryable error when createRevision fails and does not navigate", async () => {
  createRevision.mockRejectedValueOnce(new Error("Effective date must fall within the cycle"));

  const screen = await renderReadyScreen();
  const user = userEvent.setup();

  await user.press(screen.getByRole("button", { name: "Save updates" }));

  await waitFor(() => {
    expect(
      screen.getByText("Effective date must fall within the cycle"),
    ).toBeTruthy();
  });
  expect(screen.getByRole("button", { name: "Save updates" })).toBeEnabled();
  expect(mockBack).not.toHaveBeenCalled();
});

it("shows an unavailable state when the active cycle id does not match", async () => {
  mockGetActiveCycle.mockResolvedValue(
    createCycle({ id: "cycle-other" }) satisfies Cycle,
  );

  const screen = await render(<EditGoalScreen />);

  await waitFor(() => {
    expect(screen.getByText("This cycle is no longer active.")).toBeTruthy();
  });
  expect(screen.queryByLabelText("Practice name")).toBeNull();
});

it("supports route-level helper, pending, error, and secondary-action states", async () => {
  const secondaryAction = jest.fn();
  const screen = await render(
    <GoalEditor
      helperText="Starts today. Earlier days stay unchanged."
      initialValue={editorValue}
      isSaving
      mode="create"
      onCancel={jest.fn()}
      onSave={jest.fn()}
      saveLabel="Add practice"
      secondaryAction={{
        label: "Stop tracking this practice",
        onPress: secondaryAction,
        accessibilityHint: "Keeps earlier activity in history",
      }}
      submitError="Couldn't save. Try again."
    />,
  );
  const user = userEvent.setup();

  expect(
    screen.getByText("Starts today. Earlier days stay unchanged."),
  ).toBeTruthy();
  expect(screen.getByText("Couldn't save. Try again.")).toBeTruthy();
  expect(screen.getByRole("button", { name: "Saving…" })).toBeDisabled();

  const stopButton = screen.getByRole("button", {
    name: "Stop tracking this practice",
  });
  expect(stopButton.props.accessibilityHint).toBe(
    "Keeps earlier activity in history",
  );
  await user.press(stopButton);
  expect(secondaryAction).toHaveBeenCalledTimes(1);
});
