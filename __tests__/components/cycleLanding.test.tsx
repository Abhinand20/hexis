import { act, render, renderHook, waitFor } from "@testing-library/react-native";
import { userEvent } from "@testing-library/react-native";

import CycleLandingScreen from "../../app/(tabs)/index";
import { CycleCalendar } from "../../src/features/cycles/components/CycleCalendar";
import { addLocalDays } from "../../src/features/cycles/domain/date";
import type { CycleGoal } from "../../src/features/cycles/domain/types";
import { useCycleLanding, type CycleLandingState } from "../../src/features/cycles/hooks/useCycleLanding";
import type { CycleAchievementSummary } from "../../src/features/cycles/domain/cycleSummary";
import type {
  HomeDashboardPractice,
  HomeDashboardSummary,
} from "../../src/features/cycles/domain/homeDashboard";
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
    const onSelectDay = jest.fn();
    const screen = await render(
      <CycleCalendar
        durationDays={30}
        todayIndex={11}
        days={dayData}
        maximumInteractiveDate="2026-07-12"
        onSelectDay={onSelectDay}
        selectedDate="2026-07-10"
      />,
    );
    expect(screen.getAllByTestId(/cycle-day-/)).toHaveLength(30);
    expect(screen.getAllByRole("button", { name: /cycle day/i })).toHaveLength(12);
    expect(screen.getByRole("button", { name: "Cycle day 12, today" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Cycle day 10" })).toBeSelected();
    expect(screen.queryByRole("button", { name: "Cycle day 13" })).toBeNull();

    const user = userEvent.setup();
    await user.press(screen.getByRole("button", { name: "Cycle day 10" }));
    expect(onSelectDay).toHaveBeenCalledWith("2026-07-10");
  });
});

// ---------------------------------------------------------------------------
// useCycleLanding (hook, repositories mocked)
// ---------------------------------------------------------------------------

const mockGetActiveCycle = jest.fn();
const mockGetMostRecentCycle = jest.fn();
const mockListForCycle = jest.fn();
const mockListActiveForCycle = jest.fn();
const mockListRevisions = jest.fn();
const mockListSessionLogs = jest.fn();
const mockCreateSessionLog = jest.fn();
const mockDeleteSessionLog = jest.fn();
const mockImpactAsync = jest.fn();

jest.mock("expo-haptics", () => ({
  ImpactFeedbackStyle: { Light: "light" },
  impactAsync: (...args: unknown[]) => mockImpactAsync(...args),
}));

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
    getActiveCycle: (...args: unknown[]) => mockGetActiveCycle(...args),
    getMostRecentCycle: () => mockGetMostRecentCycle(),
  }),
}));

jest.mock("../../src/features/goals/data/goalRepository", () => ({
  createGoalRepository: () => ({
    listForCycle: (...args: unknown[]) => mockListForCycle(...args),
    listActiveForCycle: (...args: unknown[]) => mockListActiveForCycle(...args),
    listRevisions: (...args: unknown[]) => mockListRevisions(...args),
  }),
}));

jest.mock("../../src/features/logging/data/sessionRepository", () => ({
  createSessionRepository: () => ({
    listForCycle: (...args: unknown[]) => mockListSessionLogs(...args),
    create: (...args: unknown[]) => mockCreateSessionLog(...args),
    deleteById: (...args: unknown[]) => mockDeleteSessionLog(...args),
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
    durationMinutes,
    startedAt: `${localDate}T00:00:00.000Z`,
    createdAt: `${localDate}T00:00:00.000Z`,
  };
}

beforeEach(() => {
  mockGetActiveCycle.mockReset();
  mockGetMostRecentCycle.mockReset();
  mockListForCycle.mockReset();
  mockListActiveForCycle.mockReset();
  mockListRevisions.mockReset();
  mockListSessionLogs.mockReset();
  mockCreateSessionLog.mockReset();
  mockDeleteSessionLog.mockReset();
  mockImpactAsync.mockReset();
  mockListRevisions.mockResolvedValue([]);
  mockListActiveForCycle.mockImplementation((...args: unknown[]) =>
    mockListForCycle(...args),
  );
  mockGetMostRecentCycle.mockResolvedValue(null);
  mockImpactAsync.mockResolvedValue(undefined);
  mockDeleteSessionLog.mockResolvedValue(undefined);
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
    });
    expect(state.calendarDays).toHaveLength(30);
    expect(state.calendarDays[23]).toEqual({
      localDate: "2026-07-24",
      intensity: 2,
      isToday: true,
    });
    expect(state.dashboard.sessions).toEqual({
      logged: 7,
      target: 10,
      remaining: 3,
      progressRatio: 0.7,
    });
    expect(state.dashboard.minutes).toEqual({
      logged: 220,
      target: 320,
      remaining: 100,
      progressRatio: 220 / 320,
    });
    expect(state.actionablePractices.map((practice) => practice.goalId)).toEqual([
      "goal-strength",
      "goal-read",
    ]);
    expect(state.actionablePractices[0]).toMatchObject({
      name: "Strength",
      membership: "full",
      state: "in_progress",
      sessionCount: 2,
      sessionTarget: 3,
      sessionRemaining: 1,
      expectedDurationMinutes: 60,
    });
    expect(state.actionablePractices[1]).toMatchObject({
      name: "Read",
      membership: "full",
      sessionCount: 5,
      sessionTarget: 7,
      sessionRemaining: 2,
      currentStreak: 5,
      todaySessions: [logOn("goal-read", "2026-07-24", 20)],
    });
  });

  it("shows only date-active practices while retaining stopped practices in the calendar", async () => {
    const stoppedStrength = {
      ...strengthGoal,
      inactiveFromDate: "2026-07-24",
    };
    const addedRead = {
      ...readGoal,
      activeFromDate: "2026-07-24",
    };
    mockGetActiveCycle.mockResolvedValue(
      createCycle({
        id: "cycle-1",
        startDate: "2026-07-01",
        durationDays: 30,
        endDate: "2026-07-30",
      }),
    );
    mockListForCycle.mockResolvedValue([stoppedStrength, addedRead]);
    mockListActiveForCycle.mockResolvedValue([addedRead]);
    mockListSessionLogs.mockResolvedValue([
      logOn("goal-strength", "2026-07-23", 60),
    ]);

    const { result } = await renderHook(() => useCycleLanding("2026-07-24"));

    await waitFor(() => expect(result.current.status).toBe("ready"));
    if (result.current.status !== "ready") {
      throw new Error("expected ready state");
    }

    expect(mockListActiveForCycle).toHaveBeenCalledWith("cycle-1", "2026-07-24");
    expect(result.current.dashboard.practices.map((goal) => goal.goalId)).toEqual([
      "goal-strength",
      "goal-read",
    ]);
    expect(
      result.current.actionablePractices.map((goal) => goal.goalId),
    ).toEqual(["goal-read"]);
    expect(result.current.dashboard.totals).toEqual({
      sessionCount: 1,
      minutesLogged: 60,
    });
    expect(result.current.actionablePractices[0]).toEqual(
      expect.objectContaining({
        membership: "partial",
        state: "partial_week",
        sessionCount: 0,
        sessionTarget: null,
      }),
    );
    expect(
      result.current.calendarDays.find((day) => day.localDate === "2026-07-23")
        ?.intensity,
    ).toBeGreaterThan(0);
  });

  it("is empty when no cycle has ever existed", async () => {
    mockGetActiveCycle.mockResolvedValue(null);
    mockGetMostRecentCycle.mockResolvedValue(null);

    const { result } = await renderHook(() => useCycleLanding("2026-07-24"));

    await waitFor(() => {
      expect(result.current.status).toBe("empty");
    });
    expect(mockListForCycle).not.toHaveBeenCalled();
  });

  it("returns a completed summary when the most recent cycle has ended", async () => {
    mockGetActiveCycle.mockResolvedValue(null);
    mockGetMostRecentCycle.mockResolvedValue(
      createCycle({
        id: "cycle-1",
        name: "Summer Focus",
        startDate: "2026-07-01",
        durationDays: 30,
        endDate: "2026-07-30",
        status: "completed",
      }),
    );
    mockListForCycle.mockResolvedValue([strengthGoal, readGoal]);
    mockListSessionLogs.mockResolvedValue([
      logOn("goal-read", "2026-07-20", 20),
      logOn("goal-read", "2026-07-21", 20),
      logOn("goal-strength", "2026-07-21", 60),
    ]);

    const { result } = await renderHook(() => useCycleLanding("2026-07-31"));

    await waitFor(() => {
      expect(result.current.status).toBe("completed");
    });

    const state = result.current;
    if (state.status !== "completed") {
      throw new Error("expected completed state");
    }

    expect(state.cycleId).toBe("cycle-1");
    expect(state.cycleName).toBe("Summer Focus");
    expect(state.summary.activeDayCount).toBe(30);
    expect(state.summary.loggedDayCount).toBe(2);
    expect(state.summary.practiceTotals).toEqual([
      {
        goalId: "goal-strength",
        name: "Strength",
        completedCount: 1,
        minutesLogged: 60,
      },
      {
        goalId: "goal-read",
        name: "Read",
        completedCount: 2,
        minutesLogged: 40,
      },
    ]);
    expect(state.summary.mostLoggedPracticeName).toBe("Read");
    expect(typeof state.refresh).toBe("function");
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

function buildPractice(
  overrides: Partial<HomeDashboardPractice> = {},
): HomeDashboardPractice {
  return {
    goalId: "goal-strength",
    name: "Strength",
    cadence: "weekly",
    expectedDurationMinutes: 60,
    membership: "full",
    state: "in_progress",
    sessionCount: 2,
    sessionTarget: 3,
    sessionRemaining: 1,
    sessionProgressRatio: 2 / 3,
    minutesLogged: 120,
    minutesTarget: 180,
    minutesRemaining: 60,
    minutesProgressRatio: 2 / 3,
    currentStreak: 0,
    todaySessions: [],
    ...overrides,
  };
}

function buildDashboard(
  practices: HomeDashboardPractice[] = [],
  overrides: Partial<HomeDashboardSummary> = {},
): HomeDashboardSummary {
  return {
    throughDate: "2026-07-24",
    week: {
      startDate: "2026-07-20",
      endDate: "2026-07-26",
      calendarDaysRemaining: 2,
    },
    totals: { sessionCount: 7, minutesLogged: 220 },
    sessions: { logged: 7, target: 10, remaining: 3, progressRatio: 0.7 },
    minutes: { logged: 220, target: 320, remaining: 100, progressRatio: 220 / 320 },
    previousWeekSessionDelta: 2,
    recentDays: Array.from({ length: 7 }, (_, index) => ({
      localDate: addLocalDays("2026-07-18", index),
      sessionCount: index === 6 ? 1 : 0,
      minutesLogged: index === 6 ? 20 : 0,
    })),
    hasPartialMembership: practices.some(
      (practice) => practice.membership === "partial",
    ),
    practices,
    todaySessions: practices.flatMap((practice) => practice.todaySessions),
    ...overrides,
  };
}

function buildReadyState(
  practices: HomeDashboardPractice[] = [],
  refresh: () => Promise<void> = jest.fn().mockResolvedValue(undefined),
  dashboardOverrides: Partial<HomeDashboardSummary> = {},
): Extract<CycleLandingState, { status: "ready" }> {
  return {
    status: "ready",
    header: {
      cycleName: "Summer Focus",
      dayLabel: "Day 24 / 30",
      daysRemainingLabel: "6 days remaining",
    },
    calendarDays: buildCalendarDays(),
    dashboard: buildDashboard(practices, dashboardOverrides),
    actionablePractices: practices,
    refresh,
  };
}

describe("CycleLandingScreen", () => {
  beforeEach(() => {
    mockPush.mockReset();
    mockNavigate.mockReset();
    mockUseCycleLanding.mockReset();
    mockFocusEffectCallback = undefined;
  });

  it("announces loading and preserves an explicit error state", async () => {
    mockUseCycleLanding.mockReturnValue({ status: "loading" } satisfies CycleLandingState);
    const loading = await render(<CycleLandingScreen />);

    expect(loading.getByLabelText("Loading your cycle")).toBeTruthy();

    await loading.unmount();
    mockUseCycleLanding.mockReturnValue({
      status: "error",
      message: "Could not load dashboard",
    } satisfies CycleLandingState);
    const error = await render(<CycleLandingScreen />);

    expect(error.getByText("Could not load dashboard")).toBeTruthy();
  });

  it("renders the header, calendar, and goal rows from a ready state", async () => {
    const readyState = buildReadyState([
      buildPractice(),
      buildPractice({
        goalId: "goal-read",
        name: "Read",
        cadence: "daily",
        expectedDurationMinutes: 20,
        sessionCount: 5,
        sessionTarget: 7,
        sessionRemaining: 2,
        sessionProgressRatio: 5 / 7,
        minutesLogged: 100,
        minutesTarget: 140,
        minutesRemaining: 40,
        minutesProgressRatio: 5 / 7,
        currentStreak: 5,
      }),
    ]);
    mockUseCycleLanding.mockReturnValue(readyState);

    const screen = await render(<CycleLandingScreen />);

    expect(screen.getByText("Summer Focus")).toBeTruthy();
    expect(
      screen.getByLabelText("Day 24 / 30. 6 days remaining."),
    ).toBeTruthy();
    expect(screen.getAllByRole("button", { name: /cycle day/i })).toHaveLength(24);
    expect(screen.getByRole("button", { name: "Cycle day 24, today" })).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Cycle day 25" })).toBeNull();

    expect(screen.getByText("Strength")).toBeTruthy();
    expect(screen.getByText("No streak yet")).toBeTruthy();
    expect(screen.getByText("2 of 3 · 1 remaining")).toBeTruthy();
    expect(
      screen.getByRole("button", {
        name: "Log Strength: 2 of 3 sessions this week; 1 remaining.",
      }),
    ).toBeTruthy();

    expect(screen.getByText("Read")).toBeTruthy();
    expect(screen.getByText("5 days streak")).toBeTruthy();
    expect(screen.getByText("5 of 7 · 2 remaining")).toBeTruthy();
    expect(
      screen.getByRole("button", {
        name: "Log Read: 5 of 7 sessions this week; 2 remaining.",
      }),
    ).toBeTruthy();
    expect(screen.getByRole("header", { name: "This week" })).toBeTruthy();
    expect(screen.getByRole("header", { name: "Recent rhythm" })).toBeTruthy();
    expect(screen.getByRole("header", { name: "Cycle contribution" })).toBeTruthy();
  });

  it("opens an elapsed calendar date in canonical Day history", async () => {
    mockUseCycleLanding.mockReturnValue(buildReadyState());

    const screen = await render(<CycleLandingScreen />);
    const user = userEvent.setup();

    await user.press(screen.getByRole("button", { name: "Cycle day 10" }));

    expect(mockPush).toHaveBeenCalledWith("/history?filter=day&date=2026-07-10");
    expect(screen.queryByRole("button", { name: "Cycle day 25" })).toBeNull();
  });

  it("labels met and partial practices without relying on color or minute targets", async () => {
    const overTarget = buildPractice({
      state: "met",
      expectedDurationMinutes: null,
      sessionCount: 4,
      sessionTarget: 3,
      sessionRemaining: 0,
      sessionProgressRatio: 1,
      minutesLogged: 0,
      minutesTarget: null,
      minutesRemaining: null,
      minutesProgressRatio: null,
    });
    const partial = buildPractice({
      goalId: "goal-added",
      name: "Yoga",
      membership: "partial",
      state: "partial_week",
      expectedDurationMinutes: null,
      sessionCount: 1,
      sessionTarget: null,
      sessionRemaining: null,
      sessionProgressRatio: null,
      minutesLogged: 0,
      minutesTarget: null,
      minutesRemaining: null,
      minutesProgressRatio: null,
    });
    mockUseCycleLanding.mockReturnValue(
      buildReadyState([overTarget, partial], undefined, {
        minutes: {
          logged: 0,
          target: null,
          remaining: null,
          progressRatio: null,
        },
        hasPartialMembership: true,
      }),
    );

    const screen = await render(<CycleLandingScreen />);

    expect(screen.getByText("4 of 3 · target met")).toBeTruthy();
    expect(
      screen.getByLabelText(
        "1 session · partial week. Target not scored for a partial week.",
      ),
    ).toBeTruthy();
    expect(
      screen.getByRole("button", {
        name: "Log Yoga: partial week, 1 session logged; target not scored.",
      }),
    ).toBeTruthy();
    expect(screen.queryByLabelText(/weekly minute target/i)).toBeNull();
  });

  it("shows an empty state with a way to start a cycle when there is no active cycle", async () => {
    mockUseCycleLanding.mockReturnValue({ status: "empty" } satisfies CycleLandingState);

    const screen = await render(<CycleLandingScreen />);
    const user = userEvent.setup();

    expect(screen.getByText("There's no active cycle right now.")).toBeTruthy();
    await user.press(screen.getByRole("button", { name: "Start a cycle" }));
    expect(mockPush).toHaveBeenCalledWith("/setup/duration");
  });

  it("shows a completed-cycle summary and a way to start a new cycle", async () => {
    const summary: CycleAchievementSummary = {
      activeDayCount: 30,
      loggedDayCount: 12,
      practiceTotals: [
        {
          goalId: "goal-strength",
          name: "Strength",
          completedCount: 8,
          minutesLogged: 480,
        },
        {
          goalId: "goal-read",
          name: "Read",
          completedCount: 20,
          minutesLogged: 400,
        },
      ],
      strongestWeekLabel: "Jul 20 – Jul 26",
      mostLoggedPracticeName: "Read",
    };
    mockUseCycleLanding.mockReturnValue({
      status: "completed",
      cycleId: "cycle-1",
      cycleName: "Summer Focus",
      summary,
      refresh: jest.fn(),
    } satisfies CycleLandingState);

    const screen = await render(<CycleLandingScreen />);
    const user = userEvent.setup();

    expect(screen.getByText("Summer Focus")).toBeTruthy();
    expect(screen.getByText(/30 active days/i)).toBeTruthy();
    expect(screen.getByText(/12 days with logged effort/i)).toBeTruthy();
    expect(screen.getByText("Strength")).toBeTruthy();
    expect(screen.getByText("Read")).toBeTruthy();
    expect(screen.getByText(/Jul 20 – Jul 26/)).toBeTruthy();
    expect(screen.getByText(/Most logged/i)).toBeTruthy();

    await user.press(screen.getByRole("button", { name: "View wrap-up" }));
    expect(mockPush).toHaveBeenCalledWith("/cycles/cycle-1/summary");

    await user.press(screen.getByRole("button", { name: "Start a new cycle" }));
    expect(mockPush).toHaveBeenCalledWith("/setup/duration");
  });

  it("refetches landing data when the screen gains focus", async () => {
    mockUseCycleLanding.mockReturnValue({ status: "empty" } satisfies CycleLandingState);

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

  it("logs the expected duration immediately and refreshes the landing data", async () => {
    const refresh = jest.fn();
    mockUseCycleLanding.mockReturnValue(buildReadyState([buildPractice()], refresh));
    mockCreateSessionLog.mockResolvedValue({
      id: "log-1",
      cycleGoalId: "goal-strength",
      localDate: "2026-07-25",
      startedAt: "2026-07-25T00:00:00.000Z",
      durationMinutes: 60,
      createdAt: "2026-07-25T00:00:00.000Z",
    });

    const screen = await render(<CycleLandingScreen />);
    const user = userEvent.setup();

    await user.press(
      screen.getByRole("button", {
        name: "Log Strength: 2 of 3 sessions this week; 1 remaining.",
      }),
    );

    await waitFor(() => {
      expect(refresh).toHaveBeenCalledTimes(1);
    });
    expect(screen.getByText("Logged · 60 min")).toBeTruthy();
    expect(mockImpactAsync).toHaveBeenCalledWith("light");
    expect(mockCreateSessionLog).toHaveBeenCalledWith({
      cycleGoalId: "goal-strength",
      durationMinutes: 60,
    });

    await user.press(screen.getByRole("button", { name: "Undo last log" }));
    await waitFor(() => {
      expect(mockDeleteSessionLog).toHaveBeenCalledWith("log-1");
    });
    expect(refresh).toHaveBeenCalledTimes(2);
  });

  it("opens log details to choose a duration before saving", async () => {
    const refresh = jest.fn();
    mockUseCycleLanding.mockReturnValue(buildReadyState([buildPractice()], refresh));
    mockCreateSessionLog.mockResolvedValue({
      id: "log-1",
      cycleGoalId: "goal-strength",
      localDate: "2026-07-25",
      startedAt: "2026-07-25T00:00:00.000Z",
      durationMinutes: 45,
      createdAt: "2026-07-25T00:00:00.000Z",
    });

    const screen = await render(<CycleLandingScreen />);
    const user = userEvent.setup();

    await user.press(screen.getByRole("button", { name: "Log details for Strength" }));
    await user.press(screen.getByRole("button", { name: "45 min" }));
    await user.press(screen.getByRole("button", { name: "Log 45 min" }));

    await waitFor(() => {
      expect(refresh).toHaveBeenCalledTimes(1);
    });
    expect(mockCreateSessionLog).toHaveBeenCalledWith({
      cycleGoalId: "goal-strength",
      durationMinutes: 45,
    });
  });
});
