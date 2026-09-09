import { act, render, renderHook, waitFor } from "@testing-library/react-native";
import { userEvent } from "@testing-library/react-native";

import HistoryScreen from "../../app/(tabs)/history";
import type { Cycle, CycleGoal } from "../../src/features/cycles/domain/types";
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
const mockGetCycleById = jest.fn();
const mockListCycles = jest.fn();
const mockListForCycle = jest.fn();
const mockListRevisions = jest.fn();
const mockListSessionLogs = jest.fn();
const mockSetParams = jest.fn();
const mockPush = jest.fn();
let mockSearchParams: { cycleId?: string; filter?: string; date?: string } = {};

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
    useRouter: () => ({ push: mockPush, setParams: mockSetParams }),
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
    getCycleById: (...args: unknown[]) => mockGetCycleById(...args),
    listCycles: () => mockListCycles(),
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
  mockGetCycleById.mockReset();
  mockListCycles.mockReset();
  mockListForCycle.mockReset();
  mockListRevisions.mockReset();
  mockListSessionLogs.mockReset();
  mockSetParams.mockReset();
  mockPush.mockReset();
  mockSearchParams = {};
  mockListRevisions.mockResolvedValue([]);
  mockGetCycleById.mockResolvedValue(null);
  mockListCycles.mockResolvedValue([]);
});

describe("useCycleHistory", () => {
  it("is empty when no cycle has ever existed", async () => {
    mockGetActiveCycle.mockResolvedValue(null);
    mockListCycles.mockResolvedValue([]);

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
    mockListCycles.mockResolvedValue([cycle]);
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
    expect(mockGetActiveCycle).toHaveBeenCalledWith("2026-07-24");
    expect(state.cycles).toEqual([cycle]);
    expect(state.archiveItems).toHaveLength(1);
  });

  it("falls back to the first archive cycle when no route selection exists", async () => {
    const recent = createCycle({
      id: "cycle-1",
      name: "Summer Focus",
      startDate: "2026-07-01",
      durationDays: 30,
      endDate: "2026-07-30",
      status: "completed",
    });
    mockGetActiveCycle.mockResolvedValue(null);
    mockListCycles.mockResolvedValue([recent]);
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

  it("loads the valid route-selected cycle without changing archive order", async () => {
    const active = createCycle({ id: "cycle-active", name: "Current" });
    const archived = createCycle({
      id: "cycle-1",
      name: "Summer Focus",
      startDate: "2026-07-01",
      durationDays: 30,
      endDate: "2026-07-30",
      status: "completed",
    });
    mockGetActiveCycle.mockResolvedValue(active);
    mockListCycles.mockResolvedValue([active, archived]);
    mockGetCycleById.mockResolvedValue(archived);
    mockListForCycle.mockImplementation(async (cycleId: string) =>
      cycleId === archived.id ? [strengthGoal] : [],
    );
    mockListSessionLogs.mockResolvedValue([]);

    const { result } = await renderHook(() =>
      useCycleHistory(0, archived.id),
    );

    await waitFor(() => expect(result.current.status).toBe("ready"));
    const state = result.current;
    if (state.status !== "ready") {
      throw new Error("expected ready state");
    }
    expect(state.cycle.id).toBe(archived.id);
    expect(state.cycles.map((cycle) => cycle.id)).toEqual([
      active.id,
      archived.id,
    ]);
    expect(mockGetCycleById).toHaveBeenCalledWith(archived.id);
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
  const cycle = createCycle({
    id: "cycle-1",
    name: "Summer Focus",
    startDate: "2026-07-01",
    durationDays: 30,
    endDate: "2026-07-30",
  });
  return {
    status: "ready",
    cycle,
    cycles: [cycle],
    archiveItems: [archiveItemFor(cycle)],
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

function archiveItemFor(cycle: Cycle) {
  return {
    id: cycle.id,
    name: cycle.name,
    dateRange: "Jul 1–Jul 30, 2026",
    status: cycle.status,
    sessionCount: 0,
    minutesLogged: 0,
    activeDayRatio: 0,
    practiceCount: 2,
    practiceNames: ["Strength", "Read"],
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

  it("canonicalizes a missing or invalid cycleId to the resolved archive fallback", async () => {
    mockSearchParams = { cycleId: "deleted-cycle" };
    mockUseCycleHistory.mockReturnValue(readyState());

    await render(<HistoryScreen />);

    expect(mockUseCycleHistory.mock.calls.some(([, cycleId]) =>
      cycleId === "deleted-cycle",
    )).toBe(true);
    expect(mockSetParams).toHaveBeenCalledWith({ cycleId: "cycle-1" });
  });

  it("selects an archived cycle through the route and switches all visible bounds", async () => {
    const activeState = readyState();
    if (activeState.status !== "ready") {
      throw new Error("expected ready state");
    }
    const archivedCycle = createCycle({
      id: "cycle-archived",
      name: "Spring Reset",
      startDate: "2026-04-01",
      durationDays: 30,
      endDate: "2026-04-18",
      status: "ended_early",
    });
    const archivedGoal = {
      ...strengthGoal,
      id: "goal-archived",
      cycleId: archivedCycle.id,
      activeFromDate: archivedCycle.startDate,
    };
    const archivedState: CycleHistoryState = {
      status: "ready",
      cycle: archivedCycle,
      cycles: [activeState.cycle, archivedCycle],
      archiveItems: [
        archiveItemFor(activeState.cycle),
        {
          ...archiveItemFor(archivedCycle),
          dateRange: "Apr 1–Apr 18, 2026",
          practiceNames: ["Strength"],
        },
      ],
      goals: [archivedGoal],
      revisions: [],
      logs: [logOn(archivedGoal.id, "2026-04-18", 45)],
    };
    mockSearchParams = { cycleId: activeState.cycle.id, filter: "day" };
    mockUseCycleHistory.mockImplementation(
      (_refreshVersion: number, cycleId?: string) =>
        cycleId === archivedCycle.id ? archivedState : {
          ...activeState,
          cycles: archivedState.cycles,
          archiveItems: archivedState.archiveItems,
        },
    );
    const user = userEvent.setup();
    const screen = await render(<HistoryScreen />);

    await user.press(
      screen.getByRole("button", { name: "Cycle archive, 2 cycles" }),
    );
    await user.press(
      screen.getByRole("button", { name: /Spring Reset, Ended early/ }),
    );
    expect(mockSetParams).toHaveBeenLastCalledWith({
      cycleId: archivedCycle.id,
    });

    await act(async () => {
      mockSearchParams = {
        cycleId: archivedCycle.id,
        filter: "day",
        date: "2026-07-24",
      };
      screen.rerender(<HistoryScreen />);
    });

    expect(await screen.findByText("Sat, Apr 18")).toBeTruthy();
    expect(screen.getByText("Ended early")).toBeTruthy();
    expect(screen.getAllByText("45m")).toHaveLength(2);
    expect(screen.getByLabelText("Next day")).toHaveAccessibilityState({
      disabled: true,
    });
    expect(screen.getByRole("button", { name: "View wrap-up" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Repeat cycle" })).toBeTruthy();
    await user.press(
      screen.getByRole("button", { name: /Edit Strength activity/ }),
    );
    expect(screen.getByText("Edit activity")).toBeTruthy();
    expect(
      mockUseCycleHistory.mock.calls.every(([, cycleId]) =>
        cycleId === activeState.cycle.id || cycleId === archivedCycle.id,
      ),
    ).toBe(true);
  });

  it("keeps a valid route selection through focus refreshes", async () => {
    mockSearchParams = { cycleId: "cycle-1" };
    mockUseCycleHistory.mockReturnValue(readyState());

    await render(<HistoryScreen />);

    await waitFor(() => {
      expect(
        Math.max(
          ...mockUseCycleHistory.mock.calls.map(([version]) => version as number),
        ),
      ).toBeGreaterThan(0);
    });
    expect(
      mockUseCycleHistory.mock.calls.every(([, cycleId]) =>
        cycleId === "cycle-1",
      ),
    ).toBe(true);
    expect(mockSetParams).not.toHaveBeenCalledWith({ cycleId: "cycle-1" });
  });

  it("only offers Repeat cycle for ended selections and performs navigation only", async () => {
    const completed = createCycle({
      id: "cycle-completed",
      status: "completed",
    });
    mockSearchParams = { cycleId: completed.id };
    mockUseCycleHistory.mockReturnValue(
      readyState({
        cycle: completed,
        cycles: [completed],
        archiveItems: [archiveItemFor(completed)],
      }),
    );
    const user = userEvent.setup();
    const screen = await render(<HistoryScreen />);

    await user.press(screen.getByRole("button", { name: "View wrap-up" }));
    expect(mockPush).toHaveBeenCalledWith("/cycles/cycle-completed/summary");

    await user.press(screen.getByRole("button", { name: "Repeat cycle" }));

    expect(mockPush).toHaveBeenCalledWith(
      "/setup/duration?repeatCycleId=cycle-completed",
    );
    expect(mockSetParams).not.toHaveBeenCalled();

    mockUseCycleHistory.mockReturnValue(readyState());
    mockSearchParams = { cycleId: "cycle-1" };
    await act(async () => screen.rerender(<HistoryScreen />));
    expect(screen.queryByRole("button", { name: "Repeat cycle" })).toBeNull();
    expect(screen.queryByRole("button", { name: "View wrap-up" })).toBeNull();
  });

  it("labels boundary-week work without counting it as an eligible target", async () => {
    const addedRead = { ...readGoal, activeFromDate: "2026-07-22" };
    mockUseCycleHistory.mockReturnValue(
      readyState({
        goals: [addedRead],
        logs: [logOn(addedRead.id, "2026-07-23", 20)],
      }),
    );

    const screen = await render(<HistoryScreen />);

    expect(screen.getByText(/Partial week/)).toBeTruthy();
    expect(screen.getByText("0/0")).toBeTruthy();
    expect(screen.getByText("Read reached 1 of 7 sessions")).toBeTruthy();
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
    expect(screen.getAllByText("Summer Focus")).toHaveLength(2);
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

  it("keeps hook order stable when loading finishes", async () => {
    mockUseCycleHistory.mockReturnValue({ status: "loading" } satisfies CycleHistoryState);
    const screen = await render(<HistoryScreen />);

    mockUseCycleHistory.mockReturnValue(readyState());
    await act(async () => screen.rerender(<HistoryScreen />));

    expect(screen.getByText("History")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Week" })).toHaveAccessibilityState({
      selected: true,
    });
  });
});
