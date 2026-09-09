import { act, render, renderHook, waitFor } from "@testing-library/react-native";

import { DatabaseProvider, useDatabase } from "../../src/db/DatabaseProvider";
import { useActiveCycle } from "../../src/features/cycles/hooks/useActiveCycle";
import { createCycleRepository } from "../../src/features/cycles/data/cycleRepository";
import { createCycleInput } from "../../src/test/factories";

jest.mock("../../src/db/client", () => {
  const actual = jest.requireActual("../../src/db/client") as typeof import("../../src/db/client");
  return {
    ...actual,
    openDatabase: jest.fn(actual.openDatabase),
  };
});

const mockedClient = jest.requireMock("../../src/db/client") as {
  openDatabase: jest.Mock;
};

describe("DatabaseProvider reload and startup error", () => {
  afterEach(() => {
    mockedClient.openDatabase.mockImplementation(
      jest.requireActual("../../src/db/client").openDatabase,
    );
  });

  it("reloadAll causes useActiveCycle to refetch", async () => {
    const { result } = await renderHook(
      () => ({ db: useDatabase(), cycle: useActiveCycle() }),
      { wrapper: DatabaseProvider },
    );

    await waitFor(() => {
      expect(result.current.db.isLoading).toBe(false);
      expect(result.current.cycle.isLoading).toBe(false);
    });
    expect(result.current.cycle.cycle).toBeNull();

    await act(async () => {
      await createCycleRepository(result.current.db.db!).createCycle(
        createCycleInput({ startDate: "2026-09-01" }),
      );
      result.current.db.reloadAll();
    });

    await waitFor(() => {
      expect(result.current.cycle.cycle?.name).toBe("Summer Focus");
    });
  });

  it("startup error state offers Retry and Restore from backup", async () => {
    mockedClient.openDatabase.mockRejectedValue(new Error("file is encrypted or is not a database"));

    const screen = await render(
      <DatabaseProvider>
        <></>
      </DatabaseProvider>,
    );

    await waitFor(() => {
      expect(
        screen.getByText("Hexis could not open its database"),
      ).toBeTruthy();
    });
    expect(screen.getByRole("button", { name: "Retry" })).toBeTruthy();
    expect(
      screen.getByRole("button", { name: "Restore from backup" }),
    ).toBeTruthy();
    expect(
      screen.getByText("file is encrypted or is not a database"),
    ).toBeTruthy();
  });
});
