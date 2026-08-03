import { render, waitFor } from "@testing-library/react-native";
import { userEvent } from "@testing-library/react-native";

import { LogSessionSheet } from "../../src/features/logging/components/LogSessionSheet";

const mockCreateSessionLog = jest.fn();
const createSessionLog = mockCreateSessionLog;

jest.mock("../../src/db/DatabaseProvider", () => ({
  useDatabase: () => ({ db: {}, isLoading: false, error: null }),
}));

jest.mock("../../src/features/logging/data/sessionRepository", () => ({
  createSessionRepository: () => ({
    create: (...args: unknown[]) => mockCreateSessionLog(...args),
  }),
}));

const strengthGoal = {
  id: "goal-strength",
  name: "Strength",
  expectedDurationMinutes: 60,
};

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
  mockCreateSessionLog.mockReset();
  mockCreateSessionLog.mockResolvedValue({
    id: "log-1",
    cycleGoalId: "goal-strength",
    localDate: "2026-07-24",
    durationMinutes: 45,
    createdAt: "2026-07-24T00:00:00.000Z",
  });
});

it("preselects the expected duration and saves the actual selection", async () => {
  const onDismiss = jest.fn();
  const screen = await render(
    <LogSessionSheet goal={strengthGoal} visible onDismiss={onDismiss} />,
  );
  const user = userEvent.setup();

  expect(screen.getByRole("button", { name: "60 min" })).toBeSelected();

  await user.press(screen.getByRole("button", { name: "45 min" }));
  await user.press(screen.getByRole("button", { name: "Log 45 min" }));

  expect(createSessionLog).toHaveBeenCalledWith(
    expect.objectContaining({
      cycleGoalId: "goal-strength",
      durationMinutes: 45,
    }),
  );
  await waitFor(() => {
    expect(onDismiss).toHaveBeenCalled();
  });
});

it("adds a non-standard expected duration to the selectable defaults", async () => {
  const onDismiss = jest.fn();
  const screen = await render(
    <LogSessionSheet
      goal={{ ...strengthGoal, expectedDurationMinutes: 20 }}
      visible
      onDismiss={onDismiss}
    />,
  );
  const user = userEvent.setup();

  expect(screen.getByRole("button", { name: "20 min" })).toBeSelected();

  await user.press(screen.getByRole("button", { name: "Log 20 min" }));

  expect(createSessionLog).toHaveBeenCalledWith(
    expect.objectContaining({ cycleGoalId: "goal-strength", durationMinutes: 20 }),
  );
  await waitFor(() => {
    expect(onDismiss).toHaveBeenCalled();
  });
});

it("allows saving with no duration for a count-only save", async () => {
  const onDismiss = jest.fn();
  const screen = await render(
    <LogSessionSheet
      goal={{ id: "goal-read", name: "Read", expectedDurationMinutes: null }}
      visible
      onDismiss={onDismiss}
    />,
  );
  const user = userEvent.setup();

  await user.press(screen.getByRole("button", { name: "Log session" }));

  expect(createSessionLog).toHaveBeenCalledWith(
    expect.objectContaining({ cycleGoalId: "goal-read", durationMinutes: null }),
  );
  await waitFor(() => {
    expect(onDismiss).toHaveBeenCalled();
  });
});

it("shows today's sessions and delegates undoing the latest one", async () => {
  const onDismiss = jest.fn();
  const onUndoLog = jest.fn().mockResolvedValue(undefined);
  const latestLog = {
    id: "log-latest",
    cycleGoalId: "goal-strength",
    localDate: "2026-07-24",
    durationMinutes: 45,
    createdAt: "2026-07-24T19:00:00.000Z",
  };
  const screen = await render(
    <LogSessionSheet
      goal={strengthGoal}
      visible
      onDismiss={onDismiss}
      onUndoLog={onUndoLog}
      todayLogs={[
        latestLog,
        {
          ...latestLog,
          id: "log-earlier",
          durationMinutes: 30,
          createdAt: "2026-07-24T07:00:00.000Z",
        },
      ]}
    />,
  );
  const user = userEvent.setup();

  expect(screen.getByText("Today")).toBeTruthy();

  await user.press(screen.getByRole("button", { name: "Undo last log" }));

  expect(onUndoLog).toHaveBeenCalledWith(latestLog);
  await waitFor(() => {
    expect(onDismiss).toHaveBeenCalled();
  });
});

it("disables Save while pending and shows a retryable error on failure", async () => {
  const deferred = createDeferred<unknown>();
  mockCreateSessionLog.mockReturnValueOnce(deferred.promise);
  const onDismiss = jest.fn();
  const screen = await render(
    <LogSessionSheet goal={strengthGoal} visible onDismiss={onDismiss} />,
  );
  const user = userEvent.setup();

  await user.press(screen.getByRole("button", { name: "Log 60 min" }));
  await waitFor(() => {
    expect(screen.getByRole("button", { name: "Log 60 min" })).toBeDisabled();
  });

  deferred.reject(new Error("Could not save. Try again."));

  await waitFor(() => {
    expect(screen.getByText("Could not save. Try again.")).toBeTruthy();
  });
  expect(onDismiss).not.toHaveBeenCalled();
  expect(screen.getByRole("button", { name: "Log 60 min" })).toBeEnabled();
});

it("calls onDismiss without saving when Cancel is pressed", async () => {
  const onDismiss = jest.fn();
  const screen = await render(
    <LogSessionSheet goal={strengthGoal} visible onDismiss={onDismiss} />,
  );
  const user = userEvent.setup();

  await user.press(screen.getByRole("button", { name: "Cancel" }));

  expect(onDismiss).toHaveBeenCalledTimes(1);
  expect(createSessionLog).not.toHaveBeenCalled();
});
