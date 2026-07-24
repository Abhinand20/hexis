import { Redirect } from "expo-router";

import { useActiveCycle } from "../src/features/cycles/hooks/useActiveCycle";

export default function IndexScreen() {
  const { cycle, isLoading } = useActiveCycle();

  if (isLoading) {
    return null;
  }

  if (cycle) {
    return <Redirect href={{ pathname: "/cycles/[cycleId]", params: { cycleId: cycle.id } }} />;
  }

  return <Redirect href="/cycles/new" />;
}
