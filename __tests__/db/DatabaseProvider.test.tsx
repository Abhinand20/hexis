import { renderHook, waitFor } from "@testing-library/react-native";

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
