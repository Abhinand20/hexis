import { Alert } from "react-native";
import { render, waitFor } from "@testing-library/react-native";
import { userEvent } from "@testing-library/react-native";

import TabsLayout from "../../app/(tabs)/_layout";
import SettingsScreen from "../../app/(tabs)/settings/index";
import { todayLocalDate } from "../../src/features/cycles/domain/date";
import type { CycleGoal } from "../../src/features/cycles/domain/types";
import { createCycle } from "../../src/test/factories";

const mockPush = jest.fn();
const mockNavigate = jest.fn();
const mockResetDatabase = jest.fn();
const mockGetActiveCycle = jest.fn();
const mockEndCycleEarly = jest.fn();
const mockListForCycle = jest.fn();
const mockUseActiveCycle = jest.fn();

jest.mock("expo-router", () => {
  const React = require("react") as typeof import("react");
  const { Text } = require("react-native") as typeof import("react-native");

  function MockTabs({ children }: { children: React.ReactNode }) {
    return <>{children}</>;
  }

  MockTabs.Screen = function MockTabScreen({
    name,
    options,
  }: {
    name: string;
    options?: { title?: string };
  }) {
    return <Text accessibilityRole="tab">{options?.title ?? name}</Text>;
  };

  return {
    ...jest.requireActual("expo-router"),
    useRouter: () => ({ push: mockPush, navigate: mockNavigate }),
    Tabs: MockTabs,
  };
});

jest.mock("../../src/db/DatabaseProvider", () => {
  const db = {};
  return {
    useDatabase: () => ({
      db,
      isLoading: false,
      error: null,
      resetDatabase: (...args: unknown[]) => mockResetDatabase(...args),
    }),
  };
});

jest.mock("../../src/features/cycles/hooks/useActiveCycle", () => ({
  useActiveCycle: (...args: unknown[]) => mockUseActiveCycle(...args),
}));

jest.mock("../../src/features/cycles/data/cycleRepository", () => ({
  createCycleRepository: () => ({
    getActiveCycle: () => mockGetActiveCycle(),
    endCycleEarly: (...args: unknown[]) => mockEndCycleEarly(...args),
  }),
}));

jest.mock("../../src/features/goals/data/goalRepository", () => ({
  createGoalRepository: () => ({
    listForCycle: (...args: unknown[]) => mockListForCycle(...args),
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

beforeEach(() => {
  mockPush.mockReset();
  mockNavigate.mockReset();
  mockResetDatabase.mockReset();
  mockGetActiveCycle.mockReset();
  mockEndCycleEarly.mockReset();
  mockListForCycle.mockReset();
  mockUseActiveCycle.mockReset();
  mockEndCycleEarly.mockResolvedValue(undefined);
  mockResetDatabase.mockResolvedValue(undefined);
  jest.restoreAllMocks();
});

describe("TabsLayout", () => {
  it("shows all four tabs", async () => {
    const screen = await render(<TabsLayout />);

    expect(screen.getByRole("tab", { name: "Home" })).toBeTruthy();
    expect(screen.getByRole("tab", { name: "History" })).toBeTruthy();
    expect(screen.getByRole("tab", { name: "Week" })).toBeTruthy();
    expect(screen.getByRole("tab", { name: "Settings" })).toBeTruthy();
  });
});

describe("SettingsScreen", () => {
  it("lists active-cycle goals and navigates to the edit-goal route", async () => {
    mockUseActiveCycle.mockReturnValue({
      cycle: createCycle({ id: "cycle-1" }),
      isLoading: false,
    });
    mockListForCycle.mockResolvedValue([strengthGoal]);

    const screen = await render(<SettingsScreen />);
    const user = userEvent.setup();

    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Strength" })).toBeTruthy();
    });

    await user.press(screen.getByRole("button", { name: "Strength" }));
    expect(mockPush).toHaveBeenCalledWith("/cycles/cycle-1/edit-goal/goal-strength");
  });

  it("shows a practices empty message and hides end-cycle when no cycle is active", async () => {
    mockUseActiveCycle.mockReturnValue({
      cycle: null,
      isLoading: false,
    });

    const screen = await render(<SettingsScreen />);

    expect(
      screen.getByText("Start a cycle to configure practices."),
    ).toBeTruthy();
    expect(screen.queryByRole("button", { name: "End cycle early" })).toBeNull();
    expect(mockListForCycle).not.toHaveBeenCalled();
  });

  it("renders an inert daily reminder placeholder", async () => {
    mockUseActiveCycle.mockReturnValue({
      cycle: null,
      isLoading: false,
    });

    const screen = await render(<SettingsScreen />);

    expect(screen.getByText("Daily reminder")).toBeTruthy();
    expect(screen.getByText("Coming soon")).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Daily reminder" })).toBeNull();
  });

  it("ends the active cycle early after confirmation and returns home", async () => {
    mockUseActiveCycle.mockReturnValue({
      cycle: createCycle({ id: "cycle-1" }),
      isLoading: false,
    });
    mockListForCycle.mockResolvedValue([strengthGoal]);

    const alertSpy = jest.spyOn(Alert, "alert").mockImplementation((_title, _message, buttons) => {
      const confirm = buttons?.find((button) => button.style === "destructive");
      confirm?.onPress?.();
    });

    const screen = await render(<SettingsScreen />);
    const user = userEvent.setup();

    await waitFor(() => {
      expect(screen.getByRole("button", { name: "End cycle early" })).toBeTruthy();
    });

    await user.press(screen.getByRole("button", { name: "End cycle early" }));

    await waitFor(() => {
      expect(mockEndCycleEarly).toHaveBeenCalledWith("cycle-1", todayLocalDate());
      expect(mockNavigate).toHaveBeenCalledWith("/");
    });

    alertSpy.mockRestore();
  });

  it("shows the dev-only reset-data action when __DEV__ is enabled", async () => {
    mockUseActiveCycle.mockReturnValue({
      cycle: null,
      isLoading: false,
    });

    const alertSpy = jest.spyOn(Alert, "alert").mockImplementation((_title, _message, buttons) => {
      const confirm = buttons?.find((button) => button.style === "destructive");
      confirm?.onPress?.();
    });

    const screen = await render(<SettingsScreen />);
    const user = userEvent.setup();

    expect(screen.getByRole("button", { name: "Reset all data" })).toBeTruthy();
    await user.press(screen.getByRole("button", { name: "Reset all data" }));

    await waitFor(() => {
      expect(mockResetDatabase).toHaveBeenCalled();
      expect(mockNavigate).toHaveBeenCalledWith("/");
    });

    alertSpy.mockRestore();
  });
});
