import { act, renderHook, waitFor } from "@testing-library/react-native";

import { DatabaseProvider, useDatabase } from "../../src/db/DatabaseProvider";

it("opens a database and exposes it once ready", async () => {
  const { result } = await renderHook(() => useDatabase(), {
    wrapper: DatabaseProvider,
  });

  await waitFor(() => {
    expect(result.current.isLoading).toBe(false);
  });

  expect(result.current.db).not.toBeNull();
  expect(result.current.error).toBeNull();
});

it("resetDatabase closes the current connection and reopens a fresh, migrated one", async () => {
  const { result } = await renderHook(() => useDatabase(), {
    wrapper: DatabaseProvider,
  });

  await waitFor(() => {
    expect(result.current.isLoading).toBe(false);
  });

  const originalDb = result.current.db;
  expect(originalDb).not.toBeNull();
  await originalDb!.runAsync(
    "INSERT INTO cycles (id, name, start_date, duration_days, end_date, status, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)",
    ["cycle-1", "Test", "2026-07-01", 30, "2026-07-30", "active", "2026-07-01T00:00:00.000Z"],
  );

  await act(async () => {
    await result.current.resetDatabase();
  });

  await waitFor(() => {
    expect(result.current.isLoading).toBe(false);
  });

  expect(result.current.error).toBeNull();
  expect(result.current.db).not.toBeNull();
  expect(result.current.db).not.toBe(originalDb);

  const rows = await result.current.db!.getAllAsync("SELECT * FROM cycles");
  expect(rows).toEqual([]);
});
