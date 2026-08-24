import { act, render, renderHook, waitFor } from "@testing-library/react-native";
import { userEvent } from "@testing-library/react-native";

import HistoryScreen from "../../app/(tabs)/history";
import type { CycleGoal } from "../../src/features/cycles/domain/types";
import {
  useCycleHistory,
  type CycleHistoryState,
} from "../../src/features/cycles/hooks/useCycleHistory";
import { createCycle } from "../../src/test/factories";

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

// RNTL 14 replaced this matcher with toBeSelected()/toBeDisabled(); keep the
// accessibilityState assertion style used elsewhere in this suite.
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

const mockGetActiveCycle = jest.fn();
const mockGetMostRecentCycle = jest.fn();
const mockListForCycle = jest.fn();
const mockListRevisions = jest.fn();
const mockListSessionLogs = jest.fn();
const mockSetParams = jest.fn();
let mockSearchParams: { filter?: string; date?: string } = {};

jest.mock("expo-router", () => {
  const React = require("react") as typeof import("react");
  return {
    ...jest.requireActual("expo-router"),
    useFocusEffect: (callback: () => void) => {
      React.useEffect(() => {
        callback();
      }, [callback]);
    },
    useLocalSearchParams: () => mockSearchParams,
    useRouter: () => ({ setParams: mockSetParams }),
  };
});

jest.mock("../../src/features/cycles/domain/date", () => {
  const actual = jest.requireActual(
    "../../src/features/cycles/domain/date",
  ) as typeof import("../../src/features/cycles/domain/date");
  return {
    ...actual,
    todayLocalDate: () => "2026-07-24",
  };
});

// Stable `db` reference — a fresh `{}` each render would recreate `load`
// (deps include `db`) and loop forever under RNTL's async act.
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

jest.mock("../../src/features/cycles/data/cycleRepository", () => ({
  createCycleRepository: () => ({
    getActiveCycle: (...args: unknown[]) => mockGetActiveCycle(...args),
    getMostRecentCycle: () => mockGetMostRecentCycle(),
  }),
}));

jest.mock("../../src/features/goals/data/goalRepository", () => ({
  createGoalRepository: () => ({
    listForCycle: (...args: unknown[]) => mockListForCycle(...args),
    listRevisions: (...args: unknown[]) => mockListRevisions(...args),
  }),
}));

jest.mock("../../src/features/logging/data/sessionRepository", () => ({
  createSessionRepository: () => ({
    listForCycle: (...args: unknown[]) => mockListSessionLogs(...args),
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

const readGoal: CycleGoal = {
  id: "goal-read",
  cycleId: "cycle-1",
  name: "Read",
  cadence: "daily",
  weeklyTargetCount: 7,
  expectedDurationMinutes: 20,
  activeFromDate: "2026-07-01",
  inactiveFromDate: null,
  createdAt: "2026-07-01T00:00:00.000Z",
};

function logOn(cycleGoalId: string, localDate: string, durationMinutes: number) {
  return {
    id: `log-${cycleGoalId}-${localDate}`,
    cycleGoalId,
    localDate,
    startedAt: `${localDate}T00:00:00.000Z`,
    durationMinutes,
    createdAt: `${localDate}T00:00:00.000Z`,
  };
}

beforeEach(() => {
  mockGetActiveCycle.mockReset();
  mockGetMostRecentCycle.mockReset();
  mockListForCycle.mockReset();
  mockListRevisions.mockReset();
  mockListSessionLogs.mockReset();
  mockSetParams.mockReset();
  mockSearchParams = {};
  mockListRevisions.mockResolvedValue([]);
  mockGetMostRecentCycle.mockResolvedValue(null);
});

describe("useCycleHistory", () => {
  it("is empty when no cycle has ever existed", async () => {
    mockGetActiveCycle.mockResolvedValue(null);
    mockGetMostRecentCycle.mockResolvedValue(null);

    const { result } = await renderHook(() => useCycleHistory());

    await waitFor(() => {
      expect(result.current.status).toBe("empty");
    });
    expect(mockListForCycle).not.toHaveBeenCalled();
  });

  it("loads the active cycle with goals, revisions, and logs", async () => {
    const cycle = createCycle({
      id: "cycle-1",
      name: "Summer Focus",
      startDate: "2026-07-01",
      durationDays: 30,
      endDate: "2026-07-30",
    });
    mockGetActiveCycle.mockResolvedValue(cycle);
    mockListForCycle.mockResolvedValue([strengthGoal, readGoal]);
    mockListSessionLogs.mockResolvedValue([
      logOn("goal-strength", "2026-07-21", 60),
      logOn("goal-read", "2026-07-24", 20),
    ]);

    const { result } = await renderHook(() => useCycleHistory());

    await waitFor(() => {
      expect(result.current.status).toBe("ready");
    });

    const state = result.current;
    if (state.status !== "ready") {
      throw new Error("expected ready state");
    }

    expect(state.cycle).toEqual(cycle);
    expect(state.goals).toEqual([strengthGoal, readGoal]);
    expect(state.logs).toHaveLength(2);
    expect(mockGetMostRecentCycle).not.toHaveBeenCalled();
  });

  it("falls back to the most recent cycle when none is active", async () => {
    const recent = createCycle({
      id: "cycle-1",
      name: "Summer Focus",
      startDate: "2026-07-01",
      durationDays: 30,
      endDate: "2026-07-30",
      status: "completed",
    });
    mockGetActiveCycle.mockResolvedValue(null);
    mockGetMostRecentCycle.mockResolvedValue(recent);
    mockListForCycle.mockResolvedValue([strengthGoal]);
    mockListSessionLogs.mockResolvedValue([]);

    const { result } = await renderHook(() => useCycleHistory());

    await waitFor(() => {
      expect(result.current.status).toBe("ready");
    });

    const state = result.current;
    if (state.status !== "ready") {
      throw new Error("expected ready state");
    }
    expect(state.cycle.status).toBe("completed");
    expect(state.goals).toEqual([strengthGoal]);
  });

  it("returns an error state when loading fails", async () => {
    mockGetActiveCycle.mockRejectedValue(new Error("db unavailable"));

    const { result } = await renderHook(() => useCycleHistory());

    await waitFor(() => {
      expect(result.current.status).toBe("error");
    });
    if (result.current.status !== "error") {
      throw new Error("expected error state");
    }
    expect(result.current.message).toBe("db unavailable");
  });
});

const mockUseCycleHistory = jest.fn();

jest.mock("../../src/features/cycles/hooks/useCycleHistory", () => {
  const actual = jest.requireActual(
    "../../src/features/cycles/hooks/useCycleHistory",
  ) as typeof import("../../src/features/cycles/hooks/useCycleHistory");
  return {
    ...actual,
    useCycleHistory: (...args: Parameters<typeof actual.useCycleHistory>) => {
      if (mockUseCycleHistory.getMockImplementation()) {
        return mockUseCycleHistory(...args);
      }
      return actual.useCycleHistory(...args);
    },
  };
});

function readyState(
  overrides: Partial<Extract<CycleHistoryState, { status: "ready" }>> = {},
): CycleHistoryState {
  return {
    status: "ready",
    cycle: createCycle({
      id: "cycle-1",
      name: "Summer Focus",
      startDate: "2026-07-01",
      durationDays: 30,
      endDate: "2026-07-30",
    }),
    goals: [strengthGoal, readGoal],
    revisions: [],
    logs: [
      logOn("goal-strength", "2026-07-21", 60),
      logOn("goal-strength", "2026-07-23", 60),
      logOn("goal-read", "2026-07-20", 20),
      logOn("goal-read", "2026-07-21", 20),
      logOn("goal-read", "2026-07-22", 20),
      logOn("goal-read", "2026-07-23", 20),
      logOn("goal-read", "2026-07-24", 20),
    ],
    ...overrides,
  };
}

describe("HistoryScreen", () => {
  beforeEach(() => {
    mockUseCycleHistory.mockReset();
    mockSetParams.mockReset();
    mockSearchParams = {};
  });

  it("shows the empty copy without filter controls when no cycle exists", async () => {
    mockUseCycleHistory.mockReturnValue({ status: "empty" } satisfies CycleHistoryState);

    const screen = await render(<HistoryScreen />);

    expect(screen.getByText("Your history starts with a cycle.")).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Day" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Week" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Cycle" })).toBeNull();
  });

  it("defaults to the Week filter and shows plain-language practice progress", async () => {
    mockUseCycleHistory.mockReturnValue(readyState());

    const screen = await render(<HistoryScreen />);

    expect(screen.getByRole("button", { name: "Week" })).toHaveAccessibilityState({
      selected: true,
    });
    expect(screen.getByText("Strength reached 2 of 3 sessions")).toBeTruthy();
    expect(screen.getByText("Read reached 5 of 7 sessions")).toBeTruthy();
    expect(screen.getByLabelText("Previous week")).toBeTruthy();
    expect(screen.getByLabelText("Next week")).toHaveAccessibilityState({
      disabled: true,
    });
  });

  it("switches to the Day filter for today's practices", async () => {
    mockUseCycleHistory.mockReturnValue(readyState());
    const user = userEvent.setup();

    const screen = await render(<HistoryScreen />);
    await user.press(screen.getByRole("button", { name: "Day" }));

    expect(screen.getByRole("button", { name: "Day" })).toHaveAccessibilityState({
      selected: true,
    });
    expect(mockSetParams).toHaveBeenCalledWith({ filter: "day", date: "2026-07-24" });
    expect(screen.getAllByText("Strength")).toHaveLength(1);
    expect(screen.getByText("Not logged · 0 of 60 min")).toBeTruthy();
    expect(screen.getAllByText("Read")).toHaveLength(2);
    expect(screen.getByText("Logged · 20 of 20 min")).toBeTruthy();
    expect(screen.getByText("Activity timeline")).toBeTruthy();
    expect(screen.getAllByText("20m")).toHaveLength(2);
    expect(screen.getByLabelText("Previous day")).toHaveAccessibilityState({
      disabled: false,
    });
    expect(screen.getByLabelText("Next day")).toHaveAccessibilityState({
      disabled: true,
    });

    await user.press(screen.getByLabelText("Previous day"));
    expect(screen.getByText("Thu, Jul 23")).toBeTruthy();
    expect(mockSetParams).toHaveBeenLastCalledWith({
      filter: "day",
      date: "2026-07-23",
    });
    expect(screen.getByLabelText("Next day")).toHaveAccessibilityState({
      disabled: false,
    });
  });

  it("initializes Day from a valid route date and bounds invalid dates to the cycle", async () => {
    mockSearchParams = { filter: "day", date: "2026-07-21" };
    mockUseCycleHistory.mockReturnValue(readyState());

    const selected = await render(<HistoryScreen />);

    expect(selected.getByRole("button", { name: "Day" })).toHaveAccessibilityState({
      selected: true,
    });
    expect(selected.getByText("Tue, Jul 21")).toBeTruthy();
    expect(selected.getByText("2")).toBeTruthy();

    await act(async () => {
      mockSearchParams = { filter: "day", date: "2026-07-22" };
      selected.rerender(<HistoryScreen />);
    });
    await waitFor(() => {
      expect(selected.getByText("Wed, Jul 22")).toBeTruthy();
    });

    mockSearchParams = { filter: "day", date: "2027-01-01" };
    const bounded = await render(<HistoryScreen />);
    expect(bounded.getByText("Fri, Jul 24")).toBeTruthy();
  });

  it("shows a useful empty timeline and bounds the first cycle day", async () => {
    mockSearchParams = { filter: "day", date: "2026-07-01" };
    mockUseCycleHistory.mockReturnValue(readyState());

    const screen = await render(<HistoryScreen />);

    expect(screen.getByText("No activities logged on this day.")).toBeTruthy();
    expect(screen.getByLabelText("Previous day")).toHaveAccessibilityState({
      disabled: true,
    });
    expect(screen.getByLabelText("Next day")).toHaveAccessibilityState({
      disabled: false,
    });
  });

  it("bounds week navigation to the cycle's overlapping weeks", async () => {
    mockUseCycleHistory.mockReturnValue(readyState());
    const user = userEvent.setup();

    const screen = await render(<HistoryScreen />);

    // Start at the most recent week (max); next is disabled.
    expect(screen.getByLabelText("Next week")).toHaveAccessibilityState({
      disabled: true,
    });
    expect(screen.getByLabelText("Previous week")).toHaveAccessibilityState({
      disabled: false,
    });

    // Walk back to the earliest overlapping week (week of 2026-06-29).
    // From 2026-07-20: -7 → 07-13, -7 → 07-06, -7 → 06-29.
    await user.press(screen.getByLabelText("Previous week"));
    await user.press(screen.getByLabelText("Previous week"));
    await user.press(screen.getByLabelText("Previous week"));

    expect(screen.getByLabelText("Previous week")).toHaveAccessibilityState({
      disabled: true,
    });
    expect(screen.getByLabelText("Next week")).toHaveAccessibilityState({
      disabled: false,
    });
  });

  it("shows the cycle contribution grid and summary on the Cycle filter", async () => {
    mockUseCycleHistory.mockReturnValue(readyState());
    const user = userEvent.setup();

    const screen = await render(<HistoryScreen />);
    await user.press(screen.getByRole("button", { name: "Cycle" }));

    expect(screen.getByRole("button", { name: "Cycle" })).toHaveAccessibilityState({
      selected: true,
    });
    expect(screen.getAllByRole("button", { name: /cycle day/i })).toHaveLength(24);
    expect(screen.queryByRole("button", { name: "Cycle day 25" })).toBeNull();
    expect(screen.getByText("Summer Focus")).toBeTruthy();
    expect(screen.getByText(/30 active days/i)).toBeTruthy();
    expect(screen.getByText("Weekly trend")).toBeTruthy();
    expect(screen.getByText("Practice consistency")).toBeTruthy();
    expect(screen.getByLabelText(/Strength: .* of cycle targets reached/)).toBeTruthy();

    await user.press(screen.getByRole("button", { name: "Cycle day 10" }));
    expect(mockSetParams).toHaveBeenLastCalledWith({
      filter: "day",
      date: "2026-07-10",
    });
    expect(screen.getByText("Fri, Jul 10")).toBeTruthy();
  });

  it("makes every date in a completed cycle selectable", async () => {
    mockUseCycleHistory.mockReturnValue(readyState({
      cycle: createCycle({
        id: "cycle-1",
        name: "Summer Focus",
        startDate: "2026-07-01",
        durationDays: 30,
        endDate: "2026-07-30",
        status: "completed",
      }),
    }));
    const user = userEvent.setup();

    const screen = await render(<HistoryScreen />);
    await user.press(screen.getByRole("button", { name: "Cycle" }));

    expect(screen.getAllByRole("button", { name: /cycle day/i })).toHaveLength(30);
    expect(screen.getByRole("button", { name: "Cycle day 30" })).toBeTruthy();
  });

  it("shows a loading state and an error message on failure", async () => {
    mockUseCycleHistory.mockReturnValue({ status: "loading" } satisfies CycleHistoryState);
    const loading = await render(<HistoryScreen />);
    expect(loading.getByText("Reading your practice ledger")).toBeTruthy();

    mockUseCycleHistory.mockReturnValue({
      status: "error",
      message: "Something broke",
    } satisfies CycleHistoryState);
    const errored = await render(<HistoryScreen />);
    expect(errored.getByText("Something broke")).toBeTruthy();
  });
});
