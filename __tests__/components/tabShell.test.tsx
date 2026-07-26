import { Alert } from "react-native";
import { fireEvent, render, waitFor } from "@testing-library/react-native";
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
const mockLoadReminder = jest.fn();
const mockSaveReminder = jest.fn();
const mockSetDailyReminder = jest.fn();
const mockOpenSettings = jest.fn();

jest.mock("expo-router", () => {
  return {
    ...jest.requireActual("expo-router"),
    useRouter: () => ({ push: mockPush, navigate: mockNavigate }),
  };
});

jest.mock("expo-router/unstable-native-tabs", () => {
  const React = require("react") as typeof import("react");
  const { Text } = require("react-native") as typeof import("react-native");

  function MockNativeTabs({ children }: { children: React.ReactNode }) {
    return <>{children}</>;
  }

  function MockTrigger({ children }: { children: React.ReactNode }) {
    return <>{children}</>;
  }

  MockTrigger.Label = function MockLabel({ children }: { children?: string }) {
    return <Text accessibilityRole="tab">{children}</Text>;
  };

  MockTrigger.Icon = function MockIcon() {
    return null;
  };

  MockTrigger.VectorIcon = function MockVectorIcon() {
    return null;
  };

  MockNativeTabs.Trigger = MockTrigger;

  return { NativeTabs: MockNativeTabs };
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

jest.mock("../../src/features/reminders/reminderService", () => ({
  loadReminderSettings: (...args: unknown[]) => mockLoadReminder(...args),
  saveReminderSettings: (...args: unknown[]) => mockSaveReminder(...args),
  setDailyReminder: (...args: unknown[]) => mockSetDailyReminder(...args),
  DEFAULT_REMINDER: {
    enabled: false,
    hour: 20,
    minute: 0,
    notificationIdentifier: null,
  },
}));

jest.mock("@react-native-community/datetimepicker", () => {
  const React = require("react") as typeof import("react");
  const { Text } = require("react-native") as typeof import("react-native");

  return {
    __esModule: true,
    default: function MockDateTimePicker() {
      return <Text>Time picker</Text>;
    },
  };
});

jest.mock("expo-linking", () => ({
  openSettings: (...args: unknown[]) => mockOpenSettings(...args),
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
  mockLoadReminder.mockReset();
  mockSaveReminder.mockReset();
  mockSetDailyReminder.mockReset();
  mockOpenSettings.mockReset();
  mockEndCycleEarly.mockResolvedValue(undefined);
  mockResetDatabase.mockResolvedValue(undefined);
  mockLoadReminder.mockResolvedValue({
    enabled: false,
    hour: 20,
    minute: 0,
    notificationIdentifier: null,
  });
  mockSaveReminder.mockResolvedValue(undefined);
  jest.restoreAllMocks();
});

describe("TabsLayout", () => {
  it("shows all three tabs", async () => {
    const screen = await render(<TabsLayout />);

    expect(screen.getByRole("tab", { name: "Home" })).toBeTruthy();
    expect(screen.getByRole("tab", { name: "History" })).toBeTruthy();
    expect(screen.getByRole("tab", { name: "Settings" })).toBeTruthy();
    expect(screen.queryByRole("tab", { name: "Week" })).toBeNull();
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

  it("renders the daily reminder toggle reflecting loaded settings", async () => {
    mockUseActiveCycle.mockReturnValue({
      cycle: null,
      isLoading: false,
    });
    mockLoadReminder.mockResolvedValue({
      enabled: true,
      hour: 9,
      minute: 30,
      notificationIdentifier: "notif-1",
    });

    const screen = await render(<SettingsScreen />);

    await waitFor(() => {
      expect(screen.getByLabelText("Daily reminder")).toBeTruthy();
      expect(screen.getByLabelText("Daily reminder").props.value).toBe(true);
    });
    expect(screen.getByText("Time picker")).toBeTruthy();
  });

  it("saves an enabled reminder when the toggle is turned on", async () => {
    mockUseActiveCycle.mockReturnValue({
      cycle: null,
      isLoading: false,
    });
    const enabledResult = {
      enabled: true,
      hour: 20,
      minute: 0,
      notificationIdentifier: "notif-new",
    };
    mockSetDailyReminder.mockResolvedValue(enabledResult);

    const screen = await render(<SettingsScreen />);

    await waitFor(() => {
      expect(screen.getByLabelText("Daily reminder")).toBeTruthy();
    });

    fireEvent(screen.getByLabelText("Daily reminder"), "valueChange", true);

    await waitFor(() => {
      expect(mockSetDailyReminder).toHaveBeenCalledWith({
        enabled: true,
        hour: 20,
        minute: 0,
        notificationIdentifier: null,
      });
      expect(mockSaveReminder).toHaveBeenCalledWith(expect.anything(), enabledResult);
    });
  });

  it("shows Open Settings when enabling is denied", async () => {
    mockUseActiveCycle.mockReturnValue({
      cycle: null,
      isLoading: false,
    });
    mockSetDailyReminder.mockResolvedValue({
      enabled: false,
      hour: 20,
      minute: 0,
      notificationIdentifier: null,
    });

    const screen = await render(<SettingsScreen />);
    const user = userEvent.setup();

    await waitFor(() => {
      expect(screen.getByLabelText("Daily reminder")).toBeTruthy();
    });

    fireEvent(screen.getByLabelText("Daily reminder"), "valueChange", true);

    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Open Settings" })).toBeTruthy();
      expect(screen.getByText("Notifications are off in Settings.")).toBeTruthy();
    });

    await user.press(screen.getByRole("button", { name: "Open Settings" }));
    expect(mockOpenSettings).toHaveBeenCalled();
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
