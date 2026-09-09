import type { ReactNode } from "react";
import { File } from "expo-file-system";
import { render, waitFor } from "@testing-library/react-native";
import { userEvent } from "@testing-library/react-native";

import SettingsScreen from "../../app/(tabs)/settings/index";
import { DatabaseProvider } from "../../src/db/DatabaseProvider";
import { createSnapshot } from "../../src/features/backup/data/snapshot";
import { fileUriToPath } from "../../src/features/backup/data/paths";
import { ICLOUD_DRIVE_INSTRUCTION, SHARE_HONESTY_COPY } from "../../src/features/backup/hooks/useCreateBackup";
import {
  cleanupBackupTempDir,
  makeBackupTempDir,
  openLiveDatabase,
} from "../backup/helpers";

const mockPush = jest.fn();
const mockNavigate = jest.fn();
const mockReplace = jest.fn();
const mockShareAsync = jest.fn();
const mockUseActiveCycle = jest.fn();
const mockLoadReminder = jest.fn();
const mockSaveReminder = jest.fn();
const mockSetDailyReminder = jest.fn();

jest.mock("expo-sharing", () => ({
  shareAsync: (...args: unknown[]) => mockShareAsync(...args),
}));

jest.mock("expo-router", () => {
  const React = require("react") as typeof import("react");
  return {
    ...jest.requireActual("expo-router"),
    useFocusEffect: (callback: () => void | (() => void)) => {
      React.useEffect(callback, [callback]);
    },
    useRouter: () => ({
      push: mockPush,
      navigate: mockNavigate,
      replace: mockReplace,
    }),
  };
});

jest.mock("../../src/features/cycles/hooks/useActiveCycle", () => ({
  useActiveCycle: (...args: unknown[]) => mockUseActiveCycle(...args),
}));

jest.mock("../../src/features/reminders/reminderService", () => ({
  loadReminderSettings: (...args: unknown[]) => mockLoadReminder(...args),
  saveReminderSettings: (...args: unknown[]) => mockSaveReminder(...args),
  setDailyReminder: (...args: unknown[]) => mockSetDailyReminder(...args),
  clearDailyReminder: jest.fn(),
  DEFAULT_REMINDER: {
    enabled: false,
    hour: 20,
    minute: 0,
    notificationIdentifier: null,
  },
}));

jest.mock("../../src/features/cycles/data/cycleRepository", () => ({
  createCycleRepository: () => ({
    getActiveCycle: async () => null,
    endCycleEarly: jest.fn(),
  }),
}));

jest.mock("../../src/features/goals/data/goalRepository", () => ({
  createGoalRepository: () => ({
    listActiveForCycle: async () => [],
  }),
}));

function wrapper({ children }: { children: ReactNode }) {
  return <DatabaseProvider>{children}</DatabaseProvider>;
}

describe("Settings data & backup", () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = makeBackupTempDir();
    mockShareAsync.mockReset();
    mockShareAsync.mockResolvedValue(undefined);
    mockReplace.mockReset();
    mockUseActiveCycle.mockReturnValue({
      cycle: null,
      isLoading: false,
    });
    mockLoadReminder.mockResolvedValue({
      enabled: false,
      hour: 20,
      minute: 0,
      notificationIdentifier: null,
    });
    mockSaveReminder.mockResolvedValue(undefined);
    mockPickFile({ canceled: true, result: null });
  });

  afterEach(() => {
    cleanupBackupTempDir(tempDir);
    jest.restoreAllMocks();
  });

  it("renders backup status, honesty copy, and the iCloud Drive instruction", async () => {
    const screen = await render(<SettingsScreen />, { wrapper });
    await waitFor(() => {
      expect(screen.getByText("No backup yet.")).toBeTruthy();
    });
    expect(screen.getByText(SHARE_HONESTY_COPY)).toBeTruthy();
    expect(screen.getAllByText(ICLOUD_DRIVE_INSTRUCTION).length).toBeGreaterThan(
      0,
    );
    expect(screen.getByRole("button", { name: "Create backup" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Check a backup file" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Restore backup" })).toBeTruthy();
  });

  it("records no timestamp when the share sheet is cancelled", async () => {
    mockShareAsync.mockRejectedValue(new Error("User cancelled share"));
    const screen = await render(<SettingsScreen />, { wrapper });
    const user = userEvent.setup();
    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Create backup" })).toBeTruthy();
    });
    await user.press(screen.getByRole("button", { name: "Create backup" }));
    await waitFor(() => {
      expect(
        screen.getByText("Share was cancelled. No backup time was recorded."),
      ).toBeTruthy();
      expect(screen.getByText("No backup yet.")).toBeTruthy();
    });
  });

  it("changes nothing when the file picker is cancelled", async () => {
    const screen = await render(<SettingsScreen />, { wrapper });
    const user = userEvent.setup();
    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Restore backup" })).toBeTruthy();
    });
    await user.press(screen.getByRole("button", { name: "Restore backup" }));
    await waitFor(() => {
      expect(screen.queryByText("Confirm restore")).toBeNull();
      expect(screen.getByText("No backup yet.")).toBeTruthy();
    });
  });

  it("requires confirmation before restore", async () => {
    const db = await openLiveDatabase();
    const snapshot = await createSnapshot(db, {
      appVersion: "0.1.0",
      now: new Date(2026, 8, 8, 12),
    });
    const picked = new File("file:///mock/document/restore-pick.db");
    picked.create({ overwrite: true });
    picked.write(
      new Uint8Array(
        require("fs").readFileSync(fileUriToPath(snapshot.uri)),
      ),
    );
    mockPickFile({
      canceled: false,
      result: picked,
    });

    const screen = await render(<SettingsScreen />, { wrapper });
    const user = userEvent.setup();
    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Restore backup" })).toBeTruthy();
    });
    expect(screen.queryByRole("button", { name: "Confirm restore" })).toBeNull();

    await user.press(screen.getByRole("button", { name: "Restore backup" }));
    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Confirm restore" })).toBeTruthy();
    });
    expect(
      screen.getByText("This replaces all data on this phone and does not merge."),
    ).toBeTruthy();
    expect(mockReplace).not.toHaveBeenCalled();
  });

  it("shows a readable retryable error when backup creation fails", async () => {
    mockShareAsync.mockRejectedValue(new Error("disk full"));
    const screen = await render(<SettingsScreen />, { wrapper });
    const user = userEvent.setup();
    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Create backup" })).toBeTruthy();
    });
    await user.press(screen.getByRole("button", { name: "Create backup" }));
    await waitFor(() => {
      expect(screen.getByText("disk full")).toBeTruthy();
      expect(screen.getByRole("button", { name: "Retry" })).toBeTruthy();
    });
  });
});

function mockPickFile(result: { canceled: boolean; result: File | null }): void {
  jest
    .spyOn(File, "pickFileAsync")
    .mockImplementation((async () => result) as never);
}
