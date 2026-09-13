import { Alert } from "react-native";
import { render, waitFor } from "@testing-library/react-native";
import { userEvent } from "@testing-library/react-native";
import type { SQLiteDatabase } from "expo-sqlite";

import WeightScreen from "../../app/(tabs)/weight";
import { openDatabase } from "../../src/db/client";
import { createWeightRepository } from "../../src/features/weight/data/weightRepository";
import { formatWeight } from "../../src/features/weight/domain/units";

const mockToday = "2026-09-12";
const mockPush = jest.fn();
let mockDb: SQLiteDatabase;

jest.mock("expo-router", () => {
  const React = require("react") as typeof import("react");
  return {
    ...jest.requireActual("expo-router"),
    // Read through a closure: this factory runs before `mockPush` is assigned.
    router: { push: (href: string) => mockPush(href) },
    useFocusEffect: (callback: () => void | (() => void)) => {
      React.useEffect(callback, [callback]);
    },
  };
});

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

async function renderWeight(
  seed?: (repository: ReturnType<typeof createWeightRepository>) => Promise<void>,
) {
  mockDb = await openDatabase(":memory:");
  if (seed) {
    await seed(createWeightRepository(mockDb));
  }
  return render(<WeightScreen />);
}

beforeEach(() => {
  jest.restoreAllMocks();
  mockPush.mockClear();
});

describe("WeightScreen", () => {
  it("shows only the today input when nothing has been recorded", async () => {
    const screen = await renderWeight();

    await waitFor(() => {
      expect(screen.getByLabelText("Today's weight")).toBeTruthy();
    });
    expect(screen.getByRole("button", { name: "Save" })).toBeTruthy();
    expect(screen.getByText("No weights recorded yet.")).toBeTruthy();
    expect(screen.queryByText("This week")).toBeNull();
    expect(screen.queryByText("This month")).toBeNull();
    expect(screen.queryByText("Recent")).toBeNull();
    expect(screen.queryByText("Add an earlier day")).toBeNull();
  });

  it("records today's weight and turns the action into Update with the value prefilled", async () => {
    const screen = await renderWeight();
    const user = userEvent.setup();

    await waitFor(() => {
      expect(screen.getByLabelText("Today's weight")).toBeTruthy();
    });

    await user.type(screen.getByLabelText("Today's weight"), "70.0");
    await user.press(screen.getByRole("button", { name: "Save" }));

    await waitFor(() => {
      expect(screen.getByText("Recorded 70.0 kg.")).toBeTruthy();
      expect(screen.getByRole("button", { name: "Update" })).toBeTruthy();
      expect(screen.getByLabelText("Today's weight").props.value).toBe("70.0");
    });
    expect(
      screen.getByLabelText("Weight for 2026-09-12, 70.0 kg"),
    ).toBeTruthy();
  });

  it("updates today's row in place instead of appending", async () => {
    const screen = await renderWeight(async (repository) => {
      await repository.save({ localDate: "2026-09-12", weightGrams: 70000 });
    });
    const user = userEvent.setup();

    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Update" })).toBeTruthy();
    });

    await user.clear(screen.getByLabelText("Today's weight"));
    await user.type(screen.getByLabelText("Today's weight"), "70.5");
    await user.press(screen.getByRole("button", { name: "Update" }));

    await waitFor(() => {
      expect(screen.getByText("Recorded 70.5 kg.")).toBeTruthy();
      expect(screen.getByLabelText("Today's weight").props.value).toBe("70.5");
    });
    expect(screen.getAllByLabelText(/^Weight for /)).toHaveLength(1);
    expect(
      screen.getByLabelText("Weight for 2026-09-12, 70.5 kg"),
    ).toBeTruthy();
    expect(
      await createWeightRepository(mockDb).listRecent(10),
    ).toHaveLength(1);
  });

  it("opens the earlier-day modal instead of logging inline", async () => {
    const screen = await renderWeight(async (repository) => {
      await repository.save({ localDate: "2026-09-12", weightGrams: 70000 });
    });
    const user = userEvent.setup();

    await waitFor(() => {
      expect(
        screen.getByRole("button", { name: "Add an earlier day" }),
      ).toBeTruthy();
    });
    // The date picker and its own input belong to the modal now.
    expect(screen.queryByLabelText("Earlier day weight")).toBeNull();

    await user.press(screen.getByRole("button", { name: "Add an earlier day" }));

    expect(mockPush).toHaveBeenCalledWith("/log-weight");
  });

  it("refuses an implausible value with a readable message", async () => {
    const screen = await renderWeight();
    const user = userEvent.setup();

    await waitFor(() => {
      expect(screen.getByLabelText("Today's weight")).toBeTruthy();
    });

    await user.type(screen.getByLabelText("Today's weight"), "700");
    await user.press(screen.getByRole("button", { name: "Save" }));

    await waitFor(() => {
      expect(
        screen.getByText("Weight must be between 20 kg and 500 kg."),
      ).toBeTruthy();
    });
    expect(screen.queryByRole("button", { name: "Update" })).toBeNull();
    expect(
      await createWeightRepository(mockDb).getByDate("2026-09-12"),
    ).toBeNull();
  });

  it("updates the week average and coverage after a delete", async () => {
    const screen = await renderWeight(async (repository) => {
      await repository.save({ localDate: "2026-09-10", weightGrams: 70000 });
      await repository.save({ localDate: "2026-09-12", weightGrams: 71000 });
    });
    const user = userEvent.setup();

    await waitFor(() => {
      expect(screen.getByLabelText("This week average, 70.5 kg")).toBeTruthy();
      expect(
        screen.getByLabelText("This week coverage, 2 of 7 days"),
      ).toBeTruthy();
    });

    const alertSpy = jest
      .spyOn(Alert, "alert")
      .mockImplementation((_title, _message, buttons) => {
        const confirm = buttons?.find((button) => button.style === "destructive");
        confirm?.onPress?.();
      });

    await user.press(
      screen.getByRole("button", { name: "Delete weight for 2026-09-10" }),
    );

    await waitFor(() => {
      expect(screen.getByLabelText("This week average, 71.0 kg")).toBeTruthy();
      expect(
        screen.getByLabelText("This week coverage, 1 of 7 days"),
      ).toBeTruthy();
    });
    expect(screen.queryByLabelText(/Weight for 2026-09-10/)).toBeNull();
    alertSpy.mockRestore();
  });

  it("changes displayed values and the today input together when toggling units", async () => {
    const screen = await renderWeight(async (repository) => {
      await repository.save({ localDate: "2026-09-12", weightGrams: 70000 });
    });
    const user = userEvent.setup();

    await waitFor(() => {
      expect(screen.getByLabelText("Today's weight").props.value).toBe("70.0");
      expect(screen.getByLabelText("This week average, 70.0 kg")).toBeTruthy();
    });

    await user.press(screen.getByRole("button", { name: "lb" }));

    await waitFor(() => {
      expect(screen.getByLabelText("Today's weight").props.value).toBe("154.3");
      expect(
        screen.getByLabelText(`This week average, ${formatWeight(70000, "lb")}`),
      ).toBeTruthy();
    });
  });

  it("abandons an open edit draft when the unit changes", async () => {
    const screen = await renderWeight(async (repository) => {
      await repository.save({ localDate: "2026-09-12", weightGrams: 70000 });
    });
    const user = userEvent.setup();

    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Edit" })).toBeTruthy();
    });

    await user.press(screen.getByRole("button", { name: "Edit" }));
    await user.clear(screen.getByLabelText("Edit weight for 2026-09-12"));
    await user.type(screen.getByLabelText("Edit weight for 2026-09-12"), "69.5");
    await user.press(screen.getByRole("button", { name: "lb" }));

    // 69.5 was typed as kg, so it must not survive into an lb save.
    await waitFor(() => {
      expect(screen.queryByLabelText("Edit weight for 2026-09-12")).toBeNull();
    });
    expect(
      (await createWeightRepository(mockDb).getByDate("2026-09-12"))
        ?.weightGrams,
    ).toBe(70000);
  });

  it("shows coverage for an incomplete week and the wrap-up comparison fallback", async () => {
    const screen = await renderWeight(async (repository) => {
      await repository.save({ localDate: "2026-09-10", weightGrams: 70000 });
      await repository.save({ localDate: "2026-09-12", weightGrams: 71000 });
    });

    await waitFor(() => {
      expect(
        screen.getByLabelText("This week coverage, 2 of 7 days"),
      ).toBeTruthy();
      expect(
        screen.getByText("Your next week will have a comparison"),
      ).toBeTruthy();
    });
  });
});
