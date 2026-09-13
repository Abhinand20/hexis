import { render, waitFor } from "@testing-library/react-native";
import { userEvent } from "@testing-library/react-native";
import type { SQLiteDatabase } from "expo-sqlite";

import LogWeightScreen from "../../app/log-weight";
import { openDatabase } from "../../src/db/client";
import { createWeightRepository } from "../../src/features/weight/data/weightRepository";

const mockToday = "2026-09-12";
const mockBack = jest.fn();
let mockDb: SQLiteDatabase;

jest.mock("expo-router", () => ({
  ...jest.requireActual("expo-router"),
  // Read through a closure: this factory runs before `mockBack` is assigned.
  router: { back: () => mockBack() },
}));

jest.mock("../../src/db/DatabaseProvider", () => ({
  useDatabase: () => ({
    db: mockDb,
    isLoading: false,
    error: null,
    dataVersion: 0,
    reloadAll: jest.fn(),
  }),
}));

jest.mock("../../src/features/cycles/domain/date", () => {
  const actual = jest.requireActual(
    "../../src/features/cycles/domain/date",
  ) as typeof import("../../src/features/cycles/domain/date");
  return {
    ...actual,
    todayLocalDate: (referenceDate?: Date) =>
      referenceDate === undefined
        ? mockToday
        : actual.todayLocalDate(referenceDate),
  };
});

jest.mock("@react-native-community/datetimepicker", () => {
  const React = require("react") as typeof import("react");
  const { Pressable, Text } =
    require("react-native") as typeof import("react-native");

  return {
    __esModule: true,
    default: function MockDateTimePicker({
      maximumDate,
      onValueChange,
    }: {
      maximumDate?: Date;
      onValueChange?: (event: unknown, date: Date) => void;
    }) {
      const choose = (date: Date) => () =>
        onValueChange?.({ nativeEvent: { timestamp: 0, utcOffset: 0 } }, date);

      return (
        <>
          <Text>{`Picker max ${maximumDate?.getDate() ?? "none"}`}</Text>
          <Pressable accessibilityRole="button" onPress={choose(new Date(2026, 8, 10))}>
            <Text>Choose 2026-09-10</Text>
          </Pressable>
          <Pressable accessibilityRole="button" onPress={choose(new Date(2026, 8, 13))}>
            <Text>Choose 2026-09-13</Text>
          </Pressable>
        </>
      );
    },
  };
});

async function renderModal(
  seed?: (repository: ReturnType<typeof createWeightRepository>) => Promise<void>,
) {
  mockDb = await openDatabase(":memory:");
  if (seed) {
    await seed(createWeightRepository(mockDb));
  }
  return render(<LogWeightScreen />);
}

beforeEach(() => {
  jest.restoreAllMocks();
  mockBack.mockClear();
});

describe("LogWeightScreen", () => {
  it("records an earlier day and closes itself", async () => {
    const screen = await renderModal();
    const user = userEvent.setup();

    await waitFor(() => {
      expect(screen.getByLabelText("Weight to record")).toBeTruthy();
    });

    await user.press(screen.getByText("Choose 2026-09-10"));
    expect(screen.getByLabelText("Selected day 2026-09-10")).toBeTruthy();

    await user.type(screen.getByLabelText("Weight to record"), "69.5");
    await user.press(screen.getByRole("button", { name: "Save weight" }));

    await waitFor(() => {
      expect(mockBack).toHaveBeenCalledTimes(1);
    });
    expect(
      (await createWeightRepository(mockDb).getByDate("2026-09-10"))
        ?.weightGrams,
    ).toBe(69500);
  });

  it("caps the picker at today and refuses a future day", async () => {
    const screen = await renderModal();
    const user = userEvent.setup();

    await waitFor(() => {
      expect(screen.getByText("Picker max 12")).toBeTruthy();
    });

    await user.press(screen.getByText("Choose 2026-09-13"));
    await user.type(screen.getByLabelText("Weight to record"), "71.0");
    await user.press(screen.getByRole("button", { name: "Save weight" }));

    await waitFor(() => {
      expect(
        screen.getByText("A weight cannot be recorded for a future date."),
      ).toBeTruthy();
    });
    expect(mockBack).not.toHaveBeenCalled();
    expect(
      await createWeightRepository(mockDb).getByDate("2026-09-13"),
    ).toBeNull();
  });

  it("says so before replacing a day that already has a weight", async () => {
    const screen = await renderModal(async (repository) => {
      await repository.save({ localDate: "2026-09-10", weightGrams: 70000 });
    });
    const user = userEvent.setup();

    await waitFor(() => {
      expect(screen.getByText("Choose 2026-09-10")).toBeTruthy();
    });

    await user.press(screen.getByText("Choose 2026-09-10"));

    await waitFor(() => {
      expect(
        screen.getByText("This day already has a weight. Saving replaces it."),
      ).toBeTruthy();
    });

    await user.type(screen.getByLabelText("Weight to record"), "69.5");
    await user.press(screen.getByRole("button", { name: "Replace weight" }));

    await waitFor(() => {
      expect(mockBack).toHaveBeenCalledTimes(1);
    });
    const entries = await createWeightRepository(mockDb).listRecent(10);
    expect(entries).toHaveLength(1);
    expect(entries[0].weightGrams).toBe(69500);
  });

  it("refuses a value that is not a number and stays open", async () => {
    const screen = await renderModal();
    const user = userEvent.setup();

    await waitFor(() => {
      expect(screen.getByLabelText("Weight to record")).toBeTruthy();
    });

    await user.type(screen.getByLabelText("Weight to record"), "abc");
    await user.press(screen.getByRole("button", { name: "Save weight" }));

    await waitFor(() => {
      expect(screen.getByText("Enter a weight using numbers.")).toBeTruthy();
    });
    expect(mockBack).not.toHaveBeenCalled();
  });

  it("records in the saved display unit", async () => {
    const screen = await renderModal(async (repository) => {
      await repository.setUnit("lb");
    });
    const user = userEvent.setup();

    await waitFor(() => {
      expect(screen.getByText("Recording in lb.")).toBeTruthy();
    });

    await user.press(screen.getByText("Choose 2026-09-10"));
    await user.type(screen.getByLabelText("Weight to record"), "154.3");
    await user.press(screen.getByRole("button", { name: "Save weight" }));

    await waitFor(() => {
      expect(mockBack).toHaveBeenCalledTimes(1);
    });
    expect(
      (await createWeightRepository(mockDb).getByDate("2026-09-10"))
        ?.weightGrams,
    ).toBe(69989);
  });
});
