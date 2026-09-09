import type { ReactNode } from "react";
import { Alert } from "react-native";
import { fireEvent, render, waitFor } from "@testing-library/react-native";
import { userEvent } from "@testing-library/react-native";

import RootLayout from "../../app/_layout";
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
const mockListActiveForCycle = jest.fn();
const mockUseActiveCycle = jest.fn();
const mockLoadReminder = jest.fn();
const mockSaveReminder = jest.fn();
const mockSetDailyReminder = jest.fn();
const mockOpenSettings = jest.fn();

jest.mock("expo-router", () => {
  const React = require("react") as typeof import("react");
  const { Text } = require("react-native") as typeof import("react-native");

  function MockStack({ children }: { children: React.ReactNode }) {
    return <>{children}</>;
  }
  MockStack.Screen = function MockStackScreen({
    name,
    options,
  }: {
    name: string;
    options?: { title?: string };
  }) {
    return <Text>{`${name}:${options?.title ?? ""}`}</Text>;
  };

  return {
    ...jest.requireActual("expo-router"),
    Stack: MockStack,
    useFocusEffect: (callback: () => void | (() => void)) => {
      React.useEffect(callback, [callback]);
    },
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
    DatabaseProvider: ({ children }: { children: ReactNode }) => <>{children}</>,
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
    listActiveForCycle: (...args: unknown[]) =>
      mockListActiveForCycle(...args),
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
    default: function MockDateTimePicker({
      onValueChange,
    }: {
      onValueChange?: (_event: unknown, date: Date) => void;
    }) {
      return (
        <Text
          onPress={() =>
            onValueChange?.(
              { nativeEvent: { timestamp: 0, utcOffset: 0 } },
              new Date(2000, 0, 1, 7, 45),
            )
          }
        >
          Time picker
        </Text>
      );
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
  activeFromDate: "2026-07-01",
  inactiveFromDate: null,
  createdAt: "2026-07-01T00:00:00.000Z",
};

beforeEach(() => {
  mockPush.mockReset();
  mockNavigate.mockReset();
  mockResetDatabase.mockReset();
  mockGetActiveCycle.mockReset();
  mockEndCycleEarly.mockReset();
  mockListActiveForCycle.mockReset();
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

describe("RootLayout", () => {
  it("registers the native add-practice modal route", async () => {
    const screen = await render(<RootLayout />);

    expect(
      screen.getByText("cycles/[cycleId]/add-goal:Add practice"),
    ).toBeTruthy();
    expect(
      screen.getByText("cycles/[cycleId]/summary:Cycle wrap-up"),
    ).toBeTruthy();
  });
});

describe("SettingsScreen", () => {
  it("lists active-cycle goals and navigates to the edit-goal route", async () => {
    mockUseActiveCycle.mockReturnValue({
      cycle: createCycle({ id: "cycle-1" }),
      isLoading: false,
    });
    mockListActiveForCycle.mockResolvedValue([strengthGoal]);

    const screen = await render(<SettingsScreen />);
    const user = userEvent.setup();

    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Strength" })).toBeTruthy();
    });
    expect(mockListActiveForCycle).toHaveBeenCalledWith(
      "cycle-1",
      todayLocalDate(),
    );

    await user.press(screen.getByRole("button", { name: "Strength" }));
    expect(mockPush).toHaveBeenCalledWith("/cycles/cycle-1/edit-goal/goal-strength");
  });

  it("shows Add practice for an active cycle and opens its routed modal", async () => {
    mockUseActiveCycle.mockReturnValue({
      cycle: createCycle({ id: "cycle-1" }),
      isLoading: false,
    });
    mockListActiveForCycle.mockResolvedValue([strengthGoal]);

    const screen = await render(<SettingsScreen />);
    const user = userEvent.setup();

    await user.press(screen.getByRole("button", { name: "Add practice" }));
    expect(mockPush).toHaveBeenCalledWith("/cycles/cycle-1/add-goal");
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
    expect(screen.queryByRole("button", { name: "Add practice" })).toBeNull();
    expect(screen.queryByRole("button", { name: "End cycle early" })).toBeNull();
    expect(mockListActiveForCycle).not.toHaveBeenCalled();
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

  it("saves reminder time changes through the current picker callback", async () => {
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
    const changedResult = {
      enabled: true,
      hour: 7,
      minute: 45,
      notificationIdentifier: "notif-2",
    };
    mockSetDailyReminder.mockResolvedValue(changedResult);
    const user = userEvent.setup();
    const screen = await render(<SettingsScreen />);

    await user.press(await screen.findByText("Time picker"));

    await waitFor(() => {
      expect(mockSetDailyReminder).toHaveBeenCalledWith({
        enabled: true,
        hour: 7,
        minute: 45,
        notificationIdentifier: "notif-1",
      });
      expect(mockSaveReminder).toHaveBeenCalledWith(expect.anything(), changedResult);
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
    mockListActiveForCycle.mockResolvedValue([strengthGoal]);

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
