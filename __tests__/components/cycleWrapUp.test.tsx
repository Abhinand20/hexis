import { act, render, renderHook, waitFor } from "@testing-library/react-native";
import { userEvent } from "@testing-library/react-native";

import CycleWrapUpScreen from "../../app/cycles/[cycleId]/summary";
import {
  ICLOUD_DRIVE_INSTRUCTION,
  SHARE_HONESTY_COPY,
} from "../../src/features/backup/hooks/useCreateBackup";
import type {
  WrapUpComparison,
  WrapUpMetrics,
} from "../../src/features/cycles/domain/cycleWrapUp";
import type { Cycle, CycleGoal } from "../../src/features/cycles/domain/types";
import {
  useCycleWrapUp,
  type CycleWrapUpState,
} from "../../src/features/cycles/hooks/useCycleWrapUp";
import { createCycle, createCycleGoal } from "../../src/test/factories";

const mockGetActiveCycle = jest.fn();
const mockGetCycleById = jest.fn();
const mockListCycles = jest.fn();
const mockListGoalsForCycle = jest.fn();
const mockListRevisions = jest.fn();
const mockListSessionLogs = jest.fn();
const mockPush = jest.fn();
const mockBack = jest.fn();
let mockSearchParams: { cycleId?: string } = {};
let mockFocusEffectCallback: (() => void) | undefined;

jest.mock("expo-router", () => {
  const React = require("react") as typeof import("react");
  return {
    ...jest.requireActual("expo-router"),
    useFocusEffect: (callback: () => void) => {
      mockFocusEffectCallback = callback;
      React.useEffect(() => {
        callback();
      }, [callback]);
    },
    useLocalSearchParams: () => mockSearchParams,
    useRouter: () => ({ push: mockPush, back: mockBack }),
  };
});

jest.mock("../../src/features/cycles/domain/date", () => {
  const actual = jest.requireActual(
    "../../src/features/cycles/domain/date",
  ) as typeof import("../../src/features/cycles/domain/date");
  return {
    ...actual,
    todayLocalDate: () => "2026-08-15",
  };
});

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
    listForCycle: (...args: unknown[]) => mockListGoalsForCycle(...args),
    listRevisions: (...args: unknown[]) => mockListRevisions(...args),
  }),
}));

jest.mock("../../src/features/logging/data/sessionRepository", () => ({
  createSessionRepository: () => ({
    listForCycle: (...args: unknown[]) => mockListSessionLogs(...args),
  }),
}));

const selectedCycle = createCycle({
  id: "cycle-selected",
  name: "Summer Focus",
  startDate: "2026-07-01",
  durationDays: 30,
  endDate: "2026-07-30",
  status: "completed",
});

const baselineCycle = createCycle({
  id: "cycle-baseline",
  name: "Spring Reset",
  startDate: "2026-05-01",
  durationDays: 30,
  endDate: "2026-05-30",
  status: "completed",
});

const olderBaseline = createCycle({
  id: "cycle-older",
  name: "Winter Base",
  startDate: "2026-03-01",
  durationDays: 30,
  endDate: "2026-03-30",
  status: "ended_early",
});

const selectedGoal: CycleGoal = createCycleGoal({
  id: "goal-write",
  cycleId: selectedCycle.id,
  name: "Write",
  activeFromDate: selectedCycle.startDate,
});

const baselineGoal: CycleGoal = createCycleGoal({
  id: "goal-run",
  cycleId: baselineCycle.id,
  name: "Run",
  activeFromDate: baselineCycle.startDate,
});

function log(
  cycleGoalId: string,
  localDate: string,
  durationMinutes: number | null,
  id = `log-${cycleGoalId}-${localDate}`,
) {
  return {
    id,
    cycleGoalId,
    localDate,
    startedAt: `${localDate}T12:00:00.000Z`,
    durationMinutes,
    createdAt: `${localDate}T12:00:00.000Z`,
  };
}

beforeEach(() => {
  mockGetActiveCycle.mockReset();
  mockGetCycleById.mockReset();
  mockListCycles.mockReset();
  mockListGoalsForCycle.mockReset();
  mockListRevisions.mockReset();
  mockListSessionLogs.mockReset();
  mockPush.mockReset();
  mockBack.mockReset();
  mockSearchParams = {};
  mockFocusEffectCallback = undefined;
  mockGetActiveCycle.mockResolvedValue(null);
  mockListRevisions.mockResolvedValue([]);
});

describe("useCycleWrapUp", () => {
  it("returns not_found for a missing cycle id", async () => {
    const { result } = await renderHook(() =>
      useCycleWrapUp(undefined, null, 0),
    );

    await waitFor(() => {
      expect(result.current.status).toBe("not_found");
    });
    expect(mockGetCycleById).not.toHaveBeenCalled();
  });

  it("returns not_found for an unknown cycle", async () => {
    mockGetCycleById.mockResolvedValue(null);

    const { result } = await renderHook(() =>
      useCycleWrapUp("missing", null, 0),
    );

    await waitFor(() => {
      expect(result.current.status).toBe("not_found");
    });
  });

  it("returns active_cycle instead of fabricating a wrap-up", async () => {
    const active = createCycle({ status: "active" });
    mockGetCycleById.mockResolvedValue(active);

    const { result } = await renderHook(() =>
      useCycleWrapUp(active.id, null, 0),
    );

    await waitFor(() => {
      expect(result.current.status).toBe("active_cycle");
    });
    if (result.current.status !== "active_cycle") {
      throw new Error("expected active_cycle");
    }
    expect(result.current.cycle.id).toBe(active.id);
    expect(mockListSessionLogs).not.toHaveBeenCalled();
  });

  it("loads selected and default baseline detail records only", async () => {
    mockGetCycleById.mockResolvedValue(selectedCycle);
    mockListCycles.mockResolvedValue([selectedCycle, baselineCycle, olderBaseline]);
    mockListGoalsForCycle.mockImplementation(async (cycleId: string) => {
      if (cycleId === selectedCycle.id) {
        return [selectedGoal];
      }
      if (cycleId === baselineCycle.id) {
        return [baselineGoal];
      }
      throw new Error(`unexpected cycle load ${cycleId}`);
    });
    mockListSessionLogs.mockImplementation(async (cycleId: string) => {
      if (cycleId === selectedCycle.id) {
        return [log(selectedGoal.id, "2026-07-02", 30)];
      }
      if (cycleId === baselineCycle.id) {
        return [log(baselineGoal.id, "2026-05-02", 45)];
      }
      throw new Error(`unexpected session load ${cycleId}`);
    });

    const { result } = await renderHook(() =>
      useCycleWrapUp(selectedCycle.id, null, 0),
    );

    await waitFor(() => {
      expect(result.current.status).toBe("ready");
    });
    if (result.current.status !== "ready") {
      throw new Error("expected ready");
    }
    expect(result.current.metrics.sessions).toBe(1);
    expect(result.current.baselines.map((cycle) => cycle.id)).toEqual([
      baselineCycle.id,
      olderBaseline.id,
    ]);
    expect(result.current.comparison?.baseline.id).toBe(baselineCycle.id);
    expect(result.current.comparison?.baselineMetrics.sessions).toBe(1);
    expect(mockListGoalsForCycle.mock.calls.map((call) => call[0])).toEqual([
      selectedCycle.id,
      baselineCycle.id,
    ]);
  });

  it("recalculates both sides after a focus refresh following a correction", async () => {
    mockGetCycleById.mockResolvedValue(selectedCycle);
    mockListCycles.mockResolvedValue([selectedCycle, baselineCycle]);
    mockListGoalsForCycle.mockImplementation(async (cycleId: string) =>
      cycleId === selectedCycle.id ? [selectedGoal] : [baselineGoal],
    );
    mockListSessionLogs
      .mockResolvedValueOnce([log(selectedGoal.id, "2026-07-02", 10)])
      .mockResolvedValueOnce([log(baselineGoal.id, "2026-05-02", 20)])
      .mockResolvedValueOnce([
        log(selectedGoal.id, "2026-07-02", 10),
        log(selectedGoal.id, "2026-07-03", 15, "corrected-extra"),
      ])
      .mockResolvedValueOnce([
        log(baselineGoal.id, "2026-05-02", 20),
        log(baselineGoal.id, "2026-05-03", 25, "baseline-corrected"),
      ]);

    const { result, rerender } = await renderHook(
      ({ version }: { version: number }) =>
        useCycleWrapUp(selectedCycle.id, null, version),
      { initialProps: { version: 0 } },
    );

    await waitFor(() => {
      expect(result.current.status).toBe("ready");
    });
    if (result.current.status !== "ready") {
      throw new Error("expected ready");
    }
    expect(result.current.metrics.sessions).toBe(1);
    expect(result.current.comparison?.baselineMetrics.sessions).toBe(1);

    rerender({ version: 1 });

    await waitFor(() => {
      if (result.current.status !== "ready") {
        throw new Error("expected ready");
      }
      expect(result.current.metrics.sessions).toBe(2);
      expect(result.current.comparison?.baselineMetrics.sessions).toBe(2);
    });
  });

  it("returns an error state when loading fails", async () => {
    mockGetActiveCycle.mockRejectedValue(new Error("db unavailable"));

    const { result } = await renderHook(() =>
      useCycleWrapUp(selectedCycle.id, null, 0),
    );

    await waitFor(() => {
      expect(result.current.status).toBe("error");
    });
    if (result.current.status !== "error") {
      throw new Error("expected error");
    }
    expect(result.current.message).toBe("db unavailable");
  });
});

const mockUseCycleWrapUp = jest.fn();

jest.mock("../../src/features/cycles/hooks/useCycleWrapUp", () => {
  const actual = jest.requireActual(
    "../../src/features/cycles/hooks/useCycleWrapUp",
  ) as typeof import("../../src/features/cycles/hooks/useCycleWrapUp");
  return {
    ...actual,
    useCycleWrapUp: (...args: Parameters<typeof actual.useCycleWrapUp>) => {
      if (mockUseCycleWrapUp.getMockImplementation()) {
        return mockUseCycleWrapUp(...args);
      }
      return actual.useCycleWrapUp(...args);
    },
  };
});

function metrics(overrides: Partial<WrapUpMetrics> = {}): WrapUpMetrics {
  return {
    cycleDays: 30,
    sessions: 12,
    recordedMinutes: 180,
    sessionsWithRecordedDuration: 12,
    activeDays: 8,
    activityDayPercentage: 26.6666666667,
    sessionsPerWeek: 2.8,
    recordedMinutesPerWeek: 42,
    longestActiveDayRun: 3,
    busiestWeek: {
      weekStartDate: "2026-07-06",
      weekEndDate: "2026-07-12",
      sessions: 5,
      recordedMinutes: 80,
      isPartialWeek: false,
    },
    mostLoggedPractices: [
      { goalId: "goal-write", name: "Write", sessions: 8 },
    ],
    ...overrides,
  };
}

function comparisonFor(
  selected: WrapUpMetrics,
  baseline: Cycle,
  baselineMetrics: WrapUpMetrics,
): WrapUpComparison {
  return {
    baseline,
    selected,
    baselineMetrics,
    differences: {
      sessions: selected.sessions - baselineMetrics.sessions,
      recordedMinutes: selected.recordedMinutes - baselineMetrics.recordedMinutes,
      activeDays: selected.activeDays - baselineMetrics.activeDays,
      activityDayPercentagePoints:
        selected.activityDayPercentage - baselineMetrics.activityDayPercentage,
      sessionsPerWeek: selected.sessionsPerWeek - baselineMetrics.sessionsPerWeek,
      recordedMinutesPerWeek:
        selected.recordedMinutesPerWeek - baselineMetrics.recordedMinutesPerWeek,
    },
    hasDifferentLengths: selected.cycleDays !== baselineMetrics.cycleDays,
  };
}

function readyState(
  overrides: Partial<Extract<CycleWrapUpState, { status: "ready" }>> = {},
): Extract<CycleWrapUpState, { status: "ready" }> {
  const selectedMetrics = metrics();
  const baselineMetrics = metrics({
    sessions: 6,
    recordedMinutes: 90,
    activeDays: 4,
    activityDayPercentage: 13.3333333333,
    sessionsPerWeek: 1.4,
    recordedMinutesPerWeek: 21,
    mostLoggedPractices: [
      { goalId: "goal-run", name: "Run", sessions: 6 },
    ],
  });
  return {
    status: "ready",
    cycle: selectedCycle,
    metrics: selectedMetrics,
    baselines: [baselineCycle, olderBaseline],
    comparison: comparisonFor(selectedMetrics, baselineCycle, baselineMetrics),
    ...overrides,
  };
}

describe("CycleWrapUpScreen", () => {
  beforeEach(() => {
    mockUseCycleWrapUp.mockReset();
    mockSearchParams = { cycleId: selectedCycle.id };
  });

  it("shows a way back for an unknown cycle", async () => {
    mockUseCycleWrapUp.mockReturnValue({ status: "not_found" } satisfies CycleWrapUpState);
    const user = userEvent.setup();
    const screen = await render(<CycleWrapUpScreen />);

    expect(screen.getByText("This wrap-up could not be found.")).toBeTruthy();
    await user.press(screen.getByRole("button", { name: "Go back" }));
    expect(mockBack).toHaveBeenCalled();
  });

  it("shows a distinct query-error state with a way back", async () => {
    mockUseCycleWrapUp.mockReturnValue({
      status: "error",
      message: "Could not read wrap-up",
    } satisfies CycleWrapUpState);
    const user = userEvent.setup();
    const screen = await render(<CycleWrapUpScreen />);

    expect(screen.getByText("This wrap-up is unavailable.")).toBeTruthy();
    expect(screen.getByText("Could not read wrap-up")).toBeTruthy();
    await user.press(screen.getByRole("button", { name: "Go back" }));
    expect(mockBack).toHaveBeenCalled();
  });

  it("shows a way back for an active cycle", async () => {
    mockUseCycleWrapUp.mockReturnValue({
      status: "active_cycle",
      cycle: createCycle({ status: "active" }),
    } satisfies CycleWrapUpState);
    const user = userEvent.setup();
    const screen = await render(<CycleWrapUpScreen />);

    expect(screen.getByText("This cycle is still in progress.")).toBeTruthy();
    await user.press(screen.getByRole("button", { name: "Go back" }));
    expect(mockBack).toHaveBeenCalled();
  });

  it("changes the compared baseline from page state", async () => {
    const defaultReady = readyState();
    const olderMetrics = metrics({
      sessions: 3,
      recordedMinutes: 30,
      cycleDays: 10,
      activeDays: 3,
      activityDayPercentage: 30,
      sessionsPerWeek: 2.1,
      recordedMinutesPerWeek: 21,
    });
    mockUseCycleWrapUp.mockImplementation(
      (_cycleId: string | undefined, baselineId: string | null) => {
        if (baselineId === olderBaseline.id) {
          return readyState({
            comparison: comparisonFor(
              defaultReady.metrics,
              olderBaseline,
              olderMetrics,
            ),
          });
        }
        return defaultReady;
      },
    );
    const user = userEvent.setup();
    const screen = await render(<CycleWrapUpScreen />);

    expect(screen.getByText(/12 vs 6/)).toBeTruthy();
    await user.press(
      screen.getByRole("button", { name: "Winter Base, Ended early" }),
    );
    expect(screen.getByText(/12 vs 3/)).toBeTruthy();
    expect(screen.getByText(/Cycles have different lengths/)).toBeTruthy();
  });

  it("shows the empty-cycle state and still allows repeat", async () => {
    mockUseCycleWrapUp.mockReturnValue(
      readyState({
        metrics: metrics({
          sessions: 0,
          recordedMinutes: 0,
          sessionsWithRecordedDuration: 0,
          activeDays: 0,
          activityDayPercentage: 0,
          sessionsPerWeek: 0,
          recordedMinutesPerWeek: 0,
          longestActiveDayRun: 0,
          busiestWeek: null,
          mostLoggedPractices: [],
        }),
        baselines: [],
        comparison: null,
      }),
    );
    const user = userEvent.setup();
    const screen = await render(<CycleWrapUpScreen />);

    expect(screen.getByText("No sessions recorded")).toBeTruthy();
    expect(screen.getByText("Your next cycle will have a comparison.")).toBeTruthy();
    await user.press(screen.getByRole("button", { name: "Repeat cycle" }));
    expect(mockPush).toHaveBeenCalledWith(
      "/setup/duration?repeatCycleId=cycle-selected",
    );
  });

  it("navigates to History for this cycle from See full activity", async () => {
    mockUseCycleWrapUp.mockReturnValue(readyState());
    const user = userEvent.setup();
    const screen = await render(<CycleWrapUpScreen />);

    await user.press(screen.getByRole("button", { name: "See full activity" }));
    expect(mockPush).toHaveBeenCalledWith("/history?cycleId=cycle-selected");
  });

  it("keeps a long practice name readable in the wrap-up", async () => {
    const longName =
      "Morning pages at the oak desk beside the east window every weekday";
    mockUseCycleWrapUp.mockReturnValue(
      readyState({
        metrics: metrics({
          mostLoggedPractices: [
            { goalId: "goal-write", name: longName, sessions: 8 },
          ],
        }),
      }),
    );
    const screen = await render(<CycleWrapUpScreen />);
    expect(screen.getByText(new RegExp(longName))).toBeTruthy();
  });

  it("offers backup with freshness, repeat and full activity", async () => {
    mockUseCycleWrapUp.mockReturnValue(readyState());
    const screen = await render(<CycleWrapUpScreen />);

    await waitFor(() => {
      expect(screen.getByText("No backup yet.")).toBeTruthy();
    });
    expect(screen.getByText(SHARE_HONESTY_COPY)).toBeTruthy();
    expect(screen.getByText(ICLOUD_DRIVE_INSTRUCTION)).toBeTruthy();
    expect(screen.getByRole("button", { name: "Back up data" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Repeat cycle" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "See full activity" })).toBeTruthy();
  });

  it("refetches wrap-up data when the screen gains focus", async () => {
    mockUseCycleWrapUp.mockReturnValue(readyState());
    await render(<CycleWrapUpScreen />);

    await waitFor(() => {
      const versions = mockUseCycleWrapUp.mock.calls.map(
        (call) => call[2] as number,
      );
      expect(Math.max(...versions)).toBeGreaterThanOrEqual(1);
    });

    expect(mockFocusEffectCallback).toBeDefined();
    await act(async () => {
      mockFocusEffectCallback!();
    });

    await waitFor(() => {
      const versions = mockUseCycleWrapUp.mock.calls.map(
        (call) => call[2] as number,
      );
      expect(Math.max(...versions)).toBeGreaterThanOrEqual(2);
    });
  });
});
