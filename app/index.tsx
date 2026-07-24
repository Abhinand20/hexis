import { Redirect } from "expo-router";

import { useActiveCycle } from "../src/features/cycles/hooks/useActiveCycle";

export default function IndexScreen() {
  const { cycle, isLoading } = useActiveCycle();

  if (isLoading) {
    return null;
  }

  // `useActiveCycle` always returns `null` until Task 4 adds real persistence.
  // Once the active-cycle landing route exists (Task 7), branch here to
  // `/cycles/${cycle.id}` when `cycle` is set.
  void cycle;
  return <Redirect href="/cycles/new" />;
}
