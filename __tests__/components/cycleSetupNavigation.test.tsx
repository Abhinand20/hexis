import type { ReactNode } from "react";
import { act, render, renderHook, waitFor } from "@testing-library/react-native";
import { userEvent } from "@testing-library/react-native";
import { Pressable, Text } from "react-native";

import { CancelButton } from "../../app/setup/_layout";
import DurationScreen from "../../app/setup/duration";
import PracticesScreen from "../../app/setup/practices";
import ReviewScreen from "../../app/setup/review";
import type { CreateCycleInput } from "../../src/features/cycles/data/cycleRepository";
import type {
  Cycle,
  CycleGoal,
  GoalRevision,
} from "../../src/features/cycles/domain/types";
import {
  CycleSetupProvider,
  useCycleSetupState,
} from "../../src/features/cycles/hooks/useCycleSetupState";

const mockPush = jest.fn();
const mockDismiss = jest.fn();
const mockDismissTo = jest.fn();
const mockCreateCycle = jest.fn();
const mockGetActiveCycle = jest.fn();
const mockGetCycleById = jest.fn();
const mockListForCycle = jest.fn();
const mockListRevisions = jest.fn();
const mockRunAsync = jest.fn();
const mockWithTransactionAsync = jest.fn();
const mockDatabase = {
  runAsync: mockRunAsync,
  withTransactionAsync: mockWithTransactionAsync,
};
let mockSearchParams: { repeatCycleId?: string | string[] } = {};

jest.mock("../../src/db/DatabaseProvider", () => ({
  useDatabase: () => ({
    db: mockDatabase,
    isLoading: false,
    error: null,
    resetDatabase: jest.fn(),
  }),
}));

jest.mock("../../src/features/cycles/data/cycleRepository", () => ({
  createCycleRepository: () => ({
    getActiveCycle: (...args: unknown[]) => mockGetActiveCycle(...args),
    getCycleById: (...args: unknown[]) => mockGetCycleById(...args),
  }),
}));

jest.mock("../../src/features/goals/data/goalRepository", () => ({
  createGoalRepository: () => ({
    listForCycle: (...args: unknown[]) => mockListForCycle(...args),
    listRevisions: (...args: unknown[]) => mockListRevisions(...args),
  }),
}));

jest.mock("expo-router", () => {
  const React = require("react") as typeof import("react");

  function MockStack({ children }: { children: React.ReactNode }) {
    return <>{children}</>;
  }
  MockStack.Screen = function MockStackScreen() {
    return null;
  };

  return {
    ...jest.requireActual("expo-router"),
    useRouter: () => ({
      push: mockPush,
      dismiss: mockDismiss,
      dismissTo: mockDismissTo,
    }),
    useLocalSearchParams: () => mockSearchParams,
    Stack: MockStack,
  };
});

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

function wrapper({ children }: { children: ReactNode }) {
  return <CycleSetupProvider>{children}</CycleSetupProvider>;
}

const completedCycle: Cycle = {
  id: "cycle-finished",
  name: "Spring Reset",
  startDate: "2026-07-01",
  durationDays: 30,
  endDate: "2026-07-30",
  status: "completed",
  createdAt: "2026-07-01T08:00:00.000Z",
};

const completedGoals: CycleGoal[] = [
  {
    id: "goal-meditate",
    cycleId: completedCycle.id,
    name: "Meditate",
    cadence: "daily",
    weeklyTargetCount: 7,
    expectedDurationMinutes: 10,
    activeFromDate: completedCycle.startDate,
    inactiveFromDate: null,
    createdAt: "2026-07-01T08:00:00.000Z",
  },
  {
    id: "goal-walk",
    cycleId: completedCycle.id,
    name: "Walk",
    cadence: "weekly",
    weeklyTargetCount: 3,
    expectedDurationMinutes: 30,
    activeFromDate: completedCycle.startDate,
    inactiveFromDate: null,
    createdAt: "2026-07-01T08:01:00.000Z",
  },
];

const meditateRevision: GoalRevision = {
  id: "revision-meditate",
  cycleGoalId: "goal-meditate",
  effectiveDate: "2026-07-15",
  name: "Morning meditation",
  cadence: "daily",
  weeklyTargetCount: 7,
  expectedDurationMinutes: 15,
};

function RepeatSetupProbe() {
  const state = useCycleSetupState();
  return (
    <>
      <Text testID="repeat-duration">{state.durationDays}</Text>
      <Text testID="repeat-selected-templates">
        {state.templates.filter((template) => template.selected).length}
      </Text>
      <Text testID="repeat-practices">
        {state.customPractices
          .map(
            (practice) =>
              `${practice.id}:${practice.name}:${practice.weeklyTargetCount}:${practice.expectedDurationMinutes}`,
          )
          .join("|")}
      </Text>
      <Pressable
        accessibilityRole="button"
        onPress={() =>
          state.setCustomPractices((current) =>
            current.map((practice, index) =>
              index === 0
                ? { ...practice, name: "Edited meditation" }
                : practice,
            ),
          )
        }
      >
        <Text>Edit repeated practice</Text>
      </Pressable>
    </>
  );
}

beforeEach(() => {
  mockPush.mockReset();
  mockDismiss.mockReset();
  mockDismissTo.mockReset();
  mockCreateCycle.mockReset();
  mockGetActiveCycle.mockReset();
  mockGetActiveCycle.mockResolvedValue(null);
  mockGetCycleById.mockReset();
  mockListForCycle.mockReset();
  mockListRevisions.mockReset();
  mockRunAsync.mockReset();
  mockWithTransactionAsync.mockReset();
  mockSearchParams = {};
});

describe("useCycleSetupState", () => {
  it("starts with 30 days and permits a 60-day cycle with a matching default name", async () => {
    const { result } = await renderHook(() => useCycleSetupState(), { wrapper });

    expect(result.current.durationDays).toBe(30);
    expect(result.current.cycleName).toBe("30-Day Cycle");

    await act(async () => {
      result.current.selectDuration(60);
    });

    expect(result.current.durationDays).toBe(60);
    expect(result.current.cycleName).toBe("60-Day Cycle");
  });

  it("stops overwriting cycleName after setCycleName marks it touched", async () => {
    const { result } = await renderHook(() => useCycleSetupState(), { wrapper });

    await act(async () => {
      result.current.setCycleName("My Focus");
    });
    await act(async () => {
      result.current.selectDuration(90);
    });

    expect(result.current.durationDays).toBe(90);
    expect(result.current.cycleName).toBe("My Focus");
  });

  it("reflects included practices and hasPractices when templates and customs change", async () => {
    const { result } = await renderHook(() => useCycleSetupState(), { wrapper });

    expect(result.current.hasPractices).toBe(true);
    expect(result.current.includedPractices).toHaveLength(4);

    await act(async () => {
      result.current.setTemplates((current) =>
        current.map((template) => ({ ...template, selected: false })),
      );
    });

    expect(result.current.hasPractices).toBe(false);
    expect(result.current.includedPractices).toHaveLength(0);

    await act(async () => {
      result.current.setTemplates((current) =>
        current.map((template) =>
          template.id === "yoga" ? { ...template, selected: true } : template,
        ),
      );
    });

    expect(result.current.hasPractices).toBe(true);
    expect(result.current.includedPractices.map((p) => p.name)).toEqual(["Yoga"]);

    await act(async () => {
      result.current.setCustomPractices([
        {
          id: "custom-1",
          name: "Meditation",
          cadence: "weekly",
          weeklyTargetCount: 5,
          expectedDurationMinutes: 20,
        },
      ]);
    });

    expect(result.current.includedPractices.map((p) => p.name)).toEqual([
      "Yoga",
      "Meditation",
    ]);
    expect(result.current.hasPractices).toBe(true);
  });
});

describe("duration screen", () => {
  it("pushes practices after selecting 60 days and Continue", async () => {
    const screen = await render(
      <CycleSetupProvider>
        <DurationScreen />
      </CycleSetupProvider>,
    );
    const user = userEvent.setup();

    expect(screen.getByRole("button", { name: "30 days" })).toHaveAccessibilityState({
      selected: true,
    });

    await user.press(screen.getByRole("button", { name: "60 days" }));
    expect(screen.getByRole("button", { name: "60 days" })).toHaveAccessibilityState({
      selected: true,
    });

    await user.press(screen.getByRole("button", { name: "Continue" }));
    expect(mockPush).toHaveBeenCalledWith("/setup/practices");
  });

  it("dismisses the setup modal from Cancel", async () => {
    const screen = await render(<CancelButton />);
    const user = userEvent.setup();

    await user.press(screen.getByRole("button", { name: "Cancel" }));
    expect(mockDismiss).toHaveBeenCalled();
  });

  it("loads a finished cycle once into fresh, editable custom practices", async () => {
    mockSearchParams = { repeatCycleId: completedCycle.id };
    mockGetCycleById.mockResolvedValue(completedCycle);
    mockListForCycle.mockResolvedValue(completedGoals);
    mockListRevisions.mockImplementation(async (goalId: string) =>
      goalId === "goal-meditate" ? [meditateRevision] : [],
    );

    const screen = await render(
      <CycleSetupProvider>
        <DurationScreen />
        <RepeatSetupProbe />
      </CycleSetupProvider>,
    );
    const user = userEvent.setup();

    await waitFor(() => {
      expect(screen.getByText("Spring Reset")).toBeTruthy();
    });
    expect(screen.getByTestId("repeat-duration").props.children).toBe(30);
    expect(screen.getByTestId("repeat-selected-templates").props.children).toBe(
      0,
    );
    expect(screen.getByTestId("repeat-practices").props.children).toBe(
      "custom-1:Morning meditation:7:15|custom-2:Walk:3:30",
    );

    await user.press(
      screen.getByRole("button", { name: "Edit repeated practice" }),
    );

    expect(screen.getByTestId("repeat-practices").props.children).toContain(
      "custom-1:Edited meditation:7:15",
    );
    expect(mockGetCycleById).toHaveBeenCalledTimes(1);
  });

  it("shows an invalid repeat source without creating or writing anything", async () => {
    mockSearchParams = { repeatCycleId: "missing-cycle" };
    mockGetCycleById.mockResolvedValue(null);

    const screen = await render(
      <CycleSetupProvider>
        <DurationScreen />
        <CancelButton />
      </CycleSetupProvider>,
    );
    const user = userEvent.setup();

    await waitFor(() => {
      expect(
        screen.getByText("The cycle you chose could not be found."),
      ).toBeTruthy();
    });
    await user.press(screen.getByRole("button", { name: "Cancel" }));

    expect(mockDismiss).toHaveBeenCalledTimes(1);
    expect(mockCreateCycle).not.toHaveBeenCalled();
    expect(mockRunAsync).not.toHaveBeenCalled();
    expect(mockWithTransactionAsync).not.toHaveBeenCalled();
  });
});

describe("practices screen", () => {
  it("disables Continue until at least one practice is included", async () => {
    const screen = await render(
      <CycleSetupProvider>
        <PracticesScreen />
      </CycleSetupProvider>,
    );
    const user = userEvent.setup();

    await user.press(screen.getByRole("switch", { name: "Strength" }));
    await user.press(screen.getByRole("switch", { name: "Swim" }));
    await user.press(screen.getByRole("switch", { name: "Yoga" }));
    await user.press(screen.getByRole("switch", { name: "Read" }));

    expect(screen.getByRole("button", { name: "Continue" })).toBeDisabled();

    await user.press(screen.getByRole("switch", { name: "Yoga" }));
    expect(screen.getByRole("button", { name: "Continue" })).toBeEnabled();
  });

  it("adds a custom practice via GoalEditor and shows it in the list", async () => {
    const screen = await render(
      <CycleSetupProvider>
        <PracticesScreen />
      </CycleSetupProvider>,
    );
    const user = userEvent.setup();

    await user.press(screen.getByRole("button", { name: "Add custom practice" }));
    await user.type(screen.getByLabelText("Practice name"), "Meditation");
    await user.clear(screen.getByLabelText("Weekly target count"));
    await user.type(screen.getByLabelText("Weekly target count"), "5");
    await user.clear(screen.getByLabelText("Expected duration (minutes)"));
    await user.type(screen.getByLabelText("Expected duration (minutes)"), "20");
    await user.press(screen.getByRole("button", { name: "Save" }));

    expect(screen.getByText("Meditation")).toBeTruthy();
  });

  it("pushes review on Continue", async () => {
    const screen = await render(
      <CycleSetupProvider>
        <PracticesScreen />
      </CycleSetupProvider>,
    );
    const user = userEvent.setup();

    await user.press(screen.getByRole("button", { name: "Continue" }));
    expect(mockPush).toHaveBeenCalledWith("/setup/review");
  });
});

describe("review screen", () => {
  it("starts a cycle once, disables Start while pending, and dismisses to Home on success", async () => {
    const deferred = createDeferred<Cycle>();
    mockCreateCycle.mockReturnValueOnce(deferred.promise);

    const screen = await render(
      <CycleSetupProvider>
        <ReviewScreen />
      </CycleSetupProvider>,
    );
    const user = userEvent.setup();

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
    expect(mockDismissTo).not.toHaveBeenCalled();

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
      expect(mockDismissTo).toHaveBeenCalledWith("/");
    });
    expect(mockCreateCycle).toHaveBeenCalledTimes(1);
  });

  it("shows a retryable error when createCycle fails and does not navigate", async () => {
    mockCreateCycle.mockRejectedValueOnce(
      new Error("An active cycle already exists"),
    );

    const screen = await render(
      <CycleSetupProvider>
        <ReviewScreen />
      </CycleSetupProvider>,
    );
    const user = userEvent.setup();

    await user.press(screen.getByRole("button", { name: "Start" }));

    await waitFor(() => {
      expect(screen.getByText("An active cycle already exists")).toBeTruthy();
    });
    expect(screen.getByRole("button", { name: "Start" })).toBeEnabled();
    expect(mockDismissTo).not.toHaveBeenCalled();
  });

  it("explains an active-cycle conflict before createCycle is called", async () => {
    mockGetActiveCycle.mockResolvedValue({
      ...completedCycle,
      id: "cycle-active",
      name: "Current Focus",
      status: "active",
    });

    const screen = await render(
      <CycleSetupProvider>
        <ReviewScreen />
      </CycleSetupProvider>,
    );
    const user = userEvent.setup();

    await user.press(screen.getByRole("button", { name: "Start" }));

    await waitFor(() => {
      expect(
        screen.getByText(
          "“Current Focus” is still active. End that cycle before starting a new one. Your setup changes are still here.",
        ),
      ).toBeTruthy();
    });
    expect(mockGetActiveCycle).toHaveBeenCalledTimes(1);
    expect(mockCreateCycle).not.toHaveBeenCalled();
    expect(mockDismissTo).not.toHaveBeenCalled();
  });
});
