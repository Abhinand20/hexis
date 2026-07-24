import { render, waitFor } from "@testing-library/react-native";
import { userEvent } from "@testing-library/react-native";

import { CycleSetupScreen } from "../../app/cycles/new";
import type { CreateCycleInput } from "../../src/features/cycles/data/cycleRepository";
import type { Cycle } from "../../src/features/cycles/domain/types";

const mockReplace = jest.fn();
const mockCreateCycle = jest.fn();

jest.mock("expo-router", () => ({
  ...jest.requireActual("expo-router"),
  useRouter: () => ({ replace: mockReplace }),
}));

jest.mock("../../src/features/cycles/hooks/useCreateCycle", () => {
  const React = require("react") as typeof import("react");

  return {
    useCreateCycle: () => {
      const [isPending, setIsPending] = React.useState(false);
      const [error, setError] = React.useState<Error | null>(null);

      return {
        isPending,
        error,
        createCycle: async (input: CreateCycleInput) => {
          setIsPending(true);
          setError(null);
          try {
            const result = await mockCreateCycle(input);
            return result;
          } catch (err) {
            const nextError =
              err instanceof Error ? err : new Error(String(err));
            setError(nextError);
            throw nextError;
          } finally {
            setIsPending(false);
          }
        },
      };
    },
  };
});

declare global {
  namespace jest {
    interface Matchers<R> {
      toHaveAccessibilityState(state: {
        selected?: boolean;
        disabled?: boolean;
        checked?: boolean;
      }): R;
    }
  }
}

// RNTL 14 replaced this matcher with toBeSelected(); keep the Task 5 literal API.
expect.extend({
  toHaveAccessibilityState(
    received: { props?: { accessibilityState?: Record<string, unknown> } },
    expected: Record<string, unknown>,
  ) {
    const state = received?.props?.accessibilityState ?? {};
    const pass = Object.entries(expected).every(
      ([key, value]) => state[key] === value,
    );
    return {
      pass,
      message: () =>
        pass
          ? `Expected element not to have accessibilityState ${JSON.stringify(expected)}`
          : `Expected accessibilityState to include ${JSON.stringify(expected)}, received ${JSON.stringify(state)}`,
    };
  },
});

function createDeferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

async function advanceToPractices(
  screen: Awaited<ReturnType<typeof render>>,
  user: ReturnType<typeof userEvent.setup>,
) {
  await user.press(screen.getByRole("button", { name: "Continue" }));
}

async function advanceToReview(
  screen: Awaited<ReturnType<typeof render>>,
  user: ReturnType<typeof userEvent.setup>,
) {
  await advanceToPractices(screen, user);
  await user.press(screen.getByRole("button", { name: "Continue" }));
}

beforeEach(() => {
  mockReplace.mockReset();
  mockCreateCycle.mockReset();
});

it("starts with 30 days and permits a 60-day cycle", async () => {
  const screen = await render(<CycleSetupScreen />);
  expect(screen.getByRole("button", { name: "30 days" })).toHaveAccessibilityState({ selected: true });
  const user = userEvent.setup();
  await user.press(screen.getByRole("button", { name: "60 days" }));
  expect(screen.getByRole("button", { name: "60 days" })).toHaveAccessibilityState({ selected: true });
});

it("disables practices Continue until at least one practice is included", async () => {
  const screen = await render(<CycleSetupScreen />);
  const user = userEvent.setup();
  await advanceToPractices(screen, user);

  await user.press(screen.getByRole("switch", { name: "Strength" }));
  await user.press(screen.getByRole("switch", { name: "Swim" }));
  await user.press(screen.getByRole("switch", { name: "Yoga" }));
  await user.press(screen.getByRole("switch", { name: "Read" }));

  expect(screen.getByRole("button", { name: "Continue" })).toBeDisabled();

  await user.press(screen.getByRole("switch", { name: "Yoga" }));
  expect(screen.getByRole("button", { name: "Continue" })).toBeEnabled();
});

it("adds a custom practice via GoalEditor and shows it on review", async () => {
  const screen = await render(<CycleSetupScreen />);
  const user = userEvent.setup();
  await advanceToPractices(screen, user);

  await user.press(screen.getByRole("button", { name: "Add custom practice" }));
  await user.type(screen.getByLabelText("Practice name"), "Meditation");
  await user.clear(screen.getByLabelText("Weekly target count"));
  await user.type(screen.getByLabelText("Weekly target count"), "5");
  await user.clear(screen.getByLabelText("Expected duration (minutes)"));
  await user.type(screen.getByLabelText("Expected duration (minutes)"), "20");
  await user.press(screen.getByRole("button", { name: "Save" }));

  expect(screen.getByText("Meditation")).toBeTruthy();

  await user.press(screen.getByRole("button", { name: "Continue" }));
  expect(screen.getByText("Meditation")).toBeTruthy();
  expect(screen.getByText(/5\/week/i)).toBeTruthy();
});

it("starts a cycle once, disables Start while pending, and navigates on success", async () => {
  const deferred = createDeferred<Cycle>();
  mockCreateCycle.mockReturnValueOnce(deferred.promise);

  const screen = await render(<CycleSetupScreen />);
  const user = userEvent.setup();
  await advanceToReview(screen, user);

  await user.press(screen.getByRole("button", { name: "Start" }));

  expect(mockCreateCycle).toHaveBeenCalledTimes(1);
  const input = mockCreateCycle.mock.calls[0][0] as CreateCycleInput;
  expect(input.durationDays).toBe(30);
  expect(input.name).toBe("30-Day Cycle");
  expect(input.startDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  expect(input.goals).toEqual([
    {
      name: "Strength",
      cadence: "weekly",
      weeklyTargetCount: 3,
      expectedDurationMinutes: 60,
    },
    {
      name: "Swim",
      cadence: "weekly",
      weeklyTargetCount: 2,
      expectedDurationMinutes: 60,
    },
    {
      name: "Yoga",
      cadence: "weekly",
      weeklyTargetCount: 1,
      expectedDurationMinutes: 60,
    },
    {
      name: "Read",
      cadence: "daily",
      weeklyTargetCount: 7,
      expectedDurationMinutes: 30,
    },
  ]);

  await waitFor(() => {
    expect(screen.getByRole("button", { name: "Start" })).toBeDisabled();
  });
  expect(mockReplace).not.toHaveBeenCalled();

  deferred.resolve({
    id: "cycle_abc",
    name: input.name,
    startDate: input.startDate,
    durationDays: input.durationDays,
    endDate: "2026-08-22",
    status: "active",
    createdAt: "2026-07-24T00:00:00.000Z",
  });

  await waitFor(() => {
    expect(mockReplace).toHaveBeenCalledWith("/cycles/cycle_abc");
  });
  expect(mockCreateCycle).toHaveBeenCalledTimes(1);
});

it("shows a retryable error when createCycle fails and does not navigate", async () => {
  mockCreateCycle.mockRejectedValueOnce(new Error("An active cycle already exists"));

  const screen = await render(<CycleSetupScreen />);
  const user = userEvent.setup();
  await advanceToReview(screen, user);

  await user.press(screen.getByRole("button", { name: "Start" }));

  await waitFor(() => {
    expect(screen.getByText("An active cycle already exists")).toBeTruthy();
  });
  expect(screen.getByRole("button", { name: "Start" })).toBeEnabled();
  expect(mockReplace).not.toHaveBeenCalled();
});
