import { act, render, renderHook, waitFor } from "@testing-library/react-native";
import { userEvent } from "@testing-library/react-native";

import CycleLandingScreen from "../../app/(tabs)/index";
import { CycleCalendar } from "../../src/features/cycles/components/CycleCalendar";
import { addLocalDays } from "../../src/features/cycles/domain/date";
import type { CycleGoal } from "../../src/features/cycles/domain/types";
import { useCycleLanding, type CycleLandingState } from "../../src/features/cycles/hooks/useCycleLanding";
import { createCycle } from "../../src/test/factories";

// ---------------------------------------------------------------------------
// CycleCalendar (pure component)
// ---------------------------------------------------------------------------

describe("CycleCalendar", () => {
  const dayData = Array.from({ length: 30 }, (_, index) => ({
    localDate: addLocalDays("2026-07-01", index),
    intensity: 0 as const,
  }));

  it("renders 30 cells and identifies the current day", async () => {
    const screen = await render(
      <CycleCalendar durationDays={30} todayIndex={11} days={dayData} />,
    );
    expect(screen.getAllByRole("button", { name: /cycle day/i })).toHaveLength(30);
    expect(screen.getByRole("button", { name: "Cycle day 12, today" })).toBeTruthy();
  });
});

// ---------------------------------------------------------------------------
// useCycleLanding (hook, repositories mocked)
// ---------------------------------------------------------------------------

const mockGetActiveCycle = jest.fn();
const mockListForCycle = jest.fn();
const mockListRevisions = jest.fn();
const mockListSessionLogs = jest.fn();
const mockCreateSessionLog = jest.fn();

// Stable `db` reference — a fresh `{}` each render would recreate `load` in
// useCycleLanding (deps include `db`) and loop forever under RNTL's async act.
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
    getActiveCycle: () => mockGetActiveCycle(),
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
    create: (...args: unknown[]) => mockCreateSessionLog(...args),
  }),
}));

const strengthGoal: CycleGoal = {
  id: "goal-strength",
  cycleId: "cycle-1",
  name: "Strength",
  cadence: "weekly",
  weeklyTargetCount: 3,
  expectedDurationMinutes: 60,
  createdAt: "2026-07-01T00:00:00.000Z",
};

const readGoal: CycleGoal = {
  id: "goal-read",
  cycleId: "cycle-1",
  name: "Read",
  cadence: "daily",
  weeklyTargetCount: 7,
  expectedDurationMinutes: 20,
  createdAt: "2026-07-01T00:00:00.000Z",
};

function logOn(cycleGoalId: string, localDate: string, durationMinutes: number) {
  return {
    id: `log-${cycleGoalId}-${localDate}`,
    cycleGoalId,
    localDate,
    durationMinutes,
    createdAt: `${localDate}T00:00:00.000Z`,
  };
}

beforeEach(() => {
  mockGetActiveCycle.mockReset();
  mockListForCycle.mockReset();
  mockListRevisions.mockReset();
  mockListSessionLogs.mockReset();
  mockCreateSessionLog.mockReset();
  mockListRevisions.mockResolvedValue([]);
});

describe("useCycleLanding", () => {
  it("computes the header, calendar, and goal rows for the active cycle", async () => {
    mockGetActiveCycle.mockResolvedValue(
      createCycle({
        id: "cycle-1",
        name: "Summer Focus",
        startDate: "2026-07-01",
        durationDays: 30,
        endDate: "2026-07-30",
      }),
    );
    mockListForCycle.mockResolvedValue([strengthGoal, readGoal]);
    mockListSessionLogs.mockResolvedValue([
      logOn("goal-read", "2026-07-20", 20),
      logOn("goal-read", "2026-07-21", 20),
      logOn("goal-read", "2026-07-22", 20),
      logOn("goal-read", "2026-07-23", 20),
      logOn("goal-read", "2026-07-24", 20),
      logOn("goal-strength", "2026-07-21", 60),
      logOn("goal-strength", "2026-07-23", 60),
    ]);

    // RNTL 14: renderHook is async (same pattern as DatabaseProvider.test.tsx).
    const { result } = await renderHook(() => useCycleLanding("2026-07-24"));

    await waitFor(() => {
      expect(result.current.status).toBe("ready");
    });

    const state = result.current;
    if (state.status !== "ready") {
      throw new Error("expected ready state");
    }

    expect(state.header).toEqual({
      cycleName: "Summer Focus",
      dayLabel: "Day 24 / 30",
      daysRemainingLabel: "6 days remaining",
      overallProgressRatio: 5 / 24,
    });
    expect(state.calendarDays).toHaveLength(30);
    expect(state.calendarDays[23]).toEqual({
      localDate: "2026-07-24",
      intensity: 2,
      isToday: true,
    });
    expect(state.goals).toEqual([
      {
        goalId: "goal-strength",
        name: "Strength",
        streakLabel: "No streak yet",
        weeklyProgressLabel: "2/3 this week",
        weeklyProgressRatio: 2 / 3,
        expectedDurationMinutes: 60,
      },
      {
        goalId: "goal-read",
        name: "Read",
        streakLabel: "5 days streak",
        weeklyProgressLabel: "5/7 this week",
        weeklyProgressRatio: 5 / 7,
        expectedDurationMinutes: 20,
      },
    ]);
  });

  it("is unavailable when there is no active cycle", async () => {
    mockGetActiveCycle.mockResolvedValue(null);

    const { result } = await renderHook(() => useCycleLanding("2026-07-24"));

    await waitFor(() => {
      expect(result.current.status).toBe("unavailable");
    });
    expect(mockListForCycle).not.toHaveBeenCalled();
  });

  it("reloads when reloadToken changes", async () => {
    mockGetActiveCycle.mockResolvedValue(
      createCycle({
        id: "cycle-1",
        name: "First Focus",
        startDate: "2026-07-01",
        durationDays: 30,
        endDate: "2026-07-30",
      }),
    );
    mockListForCycle.mockResolvedValue([strengthGoal]);
    mockListSessionLogs.mockResolvedValue([]);

    const { result, rerender } = await renderHook(
      ({ token }: { token: number }) => useCycleLanding("2026-07-24", token),
      { initialProps: { token: 0 } },
    );

    await waitFor(() => {
      expect(result.current.status).toBe("ready");
    });
    if (result.current.status !== "ready") {
      throw new Error("expected ready state");
    }
    expect(result.current.header.cycleName).toBe("First Focus");

    mockGetActiveCycle.mockResolvedValue(
      createCycle({
        id: "cycle-1",
        name: "Second Focus",
        startDate: "2026-07-01",
        durationDays: 30,
        endDate: "2026-07-30",
      }),
    );

    rerender({ token: 1 });

    await waitFor(() => {
      expect(result.current.status).toBe("ready");
      if (result.current.status === "ready") {
        expect(result.current.header.cycleName).toBe("Second Focus");
      }
    });
  });
});

// ---------------------------------------------------------------------------
// CycleLandingScreen (route composition; useCycleLanding mocked wholesale)
// ---------------------------------------------------------------------------

const mockPush = jest.fn();
const mockNavigate = jest.fn();
const mockUseCycleLanding = jest.fn();
let mockFocusEffectCallback: (() => void) | undefined;

jest.mock("expo-router", () => {
  const React = require("react") as typeof import("react");
  return {
    ...jest.requireActual("expo-router"),
    useRouter: () => ({ push: mockPush, navigate: mockNavigate }),
    useFocusEffect: (cb: () => void) => {
      mockFocusEffectCallback = cb;
      React.useEffect(() => {
        cb();
      }, [cb]);
    },
  };
});

// Fall back to the real hook unless a screen test configures the mock —
// otherwise the hoisted mock would also break the useCycleLanding unit tests
// that live in this same file.
jest.mock("../../src/features/cycles/hooks/useCycleLanding", () => {
  const actual = jest.requireActual(
    "../../src/features/cycles/hooks/useCycleLanding",
  ) as typeof import("../../src/features/cycles/hooks/useCycleLanding");
  return {
    ...actual,
    useCycleLanding: (...args: Parameters<typeof actual.useCycleLanding>) => {
      if (mockUseCycleLanding.getMockImplementation()) {
        return mockUseCycleLanding(...args);
      }
      return actual.useCycleLanding(...args);
    },
  };
});

function buildCalendarDays() {
  return Array.from({ length: 30 }, (_, index) => ({
    localDate: addLocalDays("2026-07-01", index),
    intensity: 0 as const,
    isToday: index === 23,
  }));
}

describe("CycleLandingScreen", () => {
  beforeEach(() => {
    mockPush.mockReset();
    mockNavigate.mockReset();
    mockUseCycleLanding.mockReset();
    mockFocusEffectCallback = undefined;
  });

  it("renders the header, calendar, and goal rows from a ready state", async () => {
    const readyState: CycleLandingState = {
      status: "ready",
      header: {
        cycleName: "Summer Focus",
        dayLabel: "Day 24 / 30",
        daysRemainingLabel: "6 days remaining",
        overallProgressRatio: 5 / 24,
      },
      calendarDays: buildCalendarDays(),
      goals: [
        {
          goalId: "goal-strength",
          name: "Strength",
          streakLabel: "No streak yet",
          weeklyProgressLabel: "2/3 this week",
          weeklyProgressRatio: 2 / 3,
          expectedDurationMinutes: 60,
        },
        {
          goalId: "goal-read",
          name: "Read",
          streakLabel: "5 days streak",
          weeklyProgressLabel: "5/7 this week",
          weeklyProgressRatio: 5 / 7,
          expectedDurationMinutes: 20,
        },
      ],
      refresh: jest.fn(),
    };
    mockUseCycleLanding.mockReturnValue(readyState);

    const screen = await render(<CycleLandingScreen />);

    expect(screen.getByText("Summer Focus")).toBeTruthy();
    expect(screen.getByText("Day 24 / 30")).toBeTruthy();
    expect(screen.getByText("6 days remaining")).toBeTruthy();
    expect(screen.getAllByRole("button", { name: /cycle day/i })).toHaveLength(30);
    expect(screen.getByRole("button", { name: "Cycle day 24, today" })).toBeTruthy();

    expect(screen.getByText("Strength")).toBeTruthy();
    expect(screen.getByText("No streak yet")).toBeTruthy();
    expect(screen.getByText("2/3 this week")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Log Strength" })).toBeTruthy();

    expect(screen.getByText("Read")).toBeTruthy();
    expect(screen.getByText("5 days streak")).toBeTruthy();
    expect(screen.getByText("5/7 this week")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Log Read" })).toBeTruthy();
  });

  it("shows an empty state with a way to start a cycle when there is no active cycle", async () => {
    mockUseCycleLanding.mockReturnValue({ status: "unavailable" } satisfies CycleLandingState);

    const screen = await render(<CycleLandingScreen />);
    const user = userEvent.setup();

    expect(screen.getByText("There's no active cycle right now.")).toBeTruthy();
    await user.press(screen.getByRole("button", { name: "Start a cycle" }));
    expect(mockPush).toHaveBeenCalledWith("/cycles/new");
  });

  it("refetches landing data when the screen gains focus", async () => {
    mockUseCycleLanding.mockReturnValue({ status: "unavailable" } satisfies CycleLandingState);

    await render(<CycleLandingScreen />);

    await waitFor(() => {
      const tokens = mockUseCycleLanding.mock.calls.map((call) => call[1] as number);
      expect(Math.max(...tokens)).toBeGreaterThanOrEqual(1);
    });

    expect(mockFocusEffectCallback).toBeDefined();
    await act(async () => {
      mockFocusEffectCallback!();
    });

    await waitFor(() => {
      const tokens = mockUseCycleLanding.mock.calls.map((call) => call[1] as number);
      expect(Math.max(...tokens)).toBeGreaterThanOrEqual(2);
    });
  });

  it("opens the log sheet from a goal row, saves a session, and refreshes the landing data", async () => {
    const refresh = jest.fn();
    mockUseCycleLanding.mockReturnValue({
      status: "ready",
      header: {
        cycleName: "Summer Focus",
        dayLabel: "Day 24 / 30",
        daysRemainingLabel: "6 days remaining",
        overallProgressRatio: 5 / 24,
      },
      calendarDays: buildCalendarDays(),
      goals: [
        {
          goalId: "goal-strength",
          name: "Strength",
          streakLabel: "No streak yet",
          weeklyProgressLabel: "2/3 this week",
          weeklyProgressRatio: 2 / 3,
          expectedDurationMinutes: 60,
        },
      ],
      refresh,
    } satisfies CycleLandingState);
    mockCreateSessionLog.mockResolvedValue({
      id: "log-1",
      cycleGoalId: "goal-strength",
      localDate: "2026-07-25",
      durationMinutes: 60,
      createdAt: "2026-07-25T00:00:00.000Z",
    });

    const screen = await render(<CycleLandingScreen />);
    const user = userEvent.setup();

    await user.press(screen.getByRole("button", { name: "Log Strength" }));
    await user.press(screen.getByRole("button", { name: "Save 60 min" }));

    await waitFor(() => {
      expect(refresh).toHaveBeenCalledTimes(1);
    });
  });
});
