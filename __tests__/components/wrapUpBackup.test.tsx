import type { ReactNode } from "react";
import { render, waitFor } from "@testing-library/react-native";
import { userEvent } from "@testing-library/react-native";

import CycleWrapUpScreen from "../../app/cycles/[cycleId]/summary";
import { DatabaseProvider } from "../../src/db/DatabaseProvider";
import {
  ICLOUD_DRIVE_INSTRUCTION,
  SHARE_HONESTY_COPY,
} from "../../src/features/backup/hooks/useCreateBackup";
import type { WrapUpMetrics } from "../../src/features/cycles/domain/cycleWrapUp";
import type { CycleWrapUpState } from "../../src/features/cycles/hooks/useCycleWrapUp";
import { createCycle } from "../../src/test/factories";
import { cleanupBackupTempDir, makeBackupTempDir } from "../backup/helpers";

const mockShareAsync = jest.fn();
const mockPush = jest.fn();

jest.mock("expo-sharing", () => ({
  shareAsync: (...args: unknown[]) => mockShareAsync(...args),
}));

jest.mock("expo-router", () => {
  const React = require("react") as typeof import("react");
  return {
    ...jest.requireActual("expo-router"),
    useFocusEffect: (callback: () => void) => {
      React.useEffect(() => {
        callback();
      }, [callback]);
    },
    useLocalSearchParams: () => ({ cycleId: "cycle-done" }),
    useRouter: () => ({ push: mockPush, back: jest.fn() }),
  };
});

jest.mock("../../src/features/cycles/hooks/useCycleWrapUp", () => ({
  useCycleWrapUp: () => mockReadyState,
}));

const metrics: WrapUpMetrics = {
  cycleDays: 30,
  sessions: 12,
  recordedMinutes: 180,
  sessionsWithRecordedDuration: 12,
  activeDays: 8,
  activityDayPercentage: 26.6666666667,
  sessionsPerWeek: 2.8,
  recordedMinutesPerWeek: 42,
  longestActiveDayRun: 3,
  busiestWeek: null,
  mostLoggedPractices: [],
};

const mockReadyState: CycleWrapUpState = {
  status: "ready",
  cycle: createCycle({
    id: "cycle-done",
    name: "Summer Focus",
    startDate: "2026-07-01",
    endDate: "2026-07-30",
    status: "completed",
  }),
  metrics,
  baselines: [],
  comparison: null,
};

function wrapper({ children }: { children: ReactNode }) {
  return <DatabaseProvider>{children}</DatabaseProvider>;
}

describe("Backing up from the cycle wrap-up", () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = makeBackupTempDir();
    mockShareAsync.mockReset();
    mockShareAsync.mockResolvedValue(undefined);
  });

  afterEach(() => {
    cleanupBackupTempDir(tempDir);
    jest.restoreAllMocks();
  });

  it("states the freshness and durability limits before sharing", async () => {
    const screen = await render(<CycleWrapUpScreen />, { wrapper });

    await waitFor(() => {
      expect(screen.getByText("No backup yet.")).toBeTruthy();
    });
    expect(screen.getByText(SHARE_HONESTY_COPY)).toBeTruthy();
    expect(screen.getByText(ICLOUD_DRIVE_INSTRUCTION)).toBeTruthy();
  });

  it("records the backup and repeats where to save it on success", async () => {
    const screen = await render(<CycleWrapUpScreen />, { wrapper });
    const user = userEvent.setup();

    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Back up data" })).toBeTruthy();
    });
    await user.press(screen.getByRole("button", { name: "Back up data" }));

    await waitFor(() => {
      expect(screen.getByText(/is ready\./)).toBeTruthy();
    });
    expect(mockShareAsync).toHaveBeenCalled();
    expect(
      screen.getByText(/Completing the share sheet does not prove iCloud/),
    ).toBeTruthy();
    // The success state must still say where the file belongs.
    expect(screen.getAllByText(ICLOUD_DRIVE_INSTRUCTION).length).toBe(2);
    expect(screen.getByText("Last backup created today.")).toBeTruthy();
  });

  it("records no timestamp when the share sheet is cancelled", async () => {
    mockShareAsync.mockRejectedValue(new Error("User cancelled share"));
    const screen = await render(<CycleWrapUpScreen />, { wrapper });
    const user = userEvent.setup();

    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Back up data" })).toBeTruthy();
    });
    await user.press(screen.getByRole("button", { name: "Back up data" }));

    await waitFor(() => {
      expect(
        screen.getByText("Share was cancelled. No backup time was recorded."),
      ).toBeTruthy();
    });
    expect(screen.getByText("No backup yet.")).toBeTruthy();
  });

  it("offers a retry when snapshot creation fails", async () => {
    mockShareAsync.mockRejectedValue(new Error("disk full"));
    const screen = await render(<CycleWrapUpScreen />, { wrapper });
    const user = userEvent.setup();

    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Back up data" })).toBeTruthy();
    });
    await user.press(screen.getByRole("button", { name: "Back up data" }));

    await waitFor(() => {
      expect(screen.getByText("disk full")).toBeTruthy();
      expect(screen.getByRole("button", { name: "Retry" })).toBeTruthy();
    });
    expect(screen.getByText("No backup yet.")).toBeTruthy();
  });
});
