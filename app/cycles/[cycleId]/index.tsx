import { Redirect } from "expo-router";

/**
 * Compatibility shim: setup and edit-goal still navigate to `/cycles/[cycleId]`
 * until Task 10 retargets them. Home now lives under the tabs group.
 */
export default function CycleIdRedirect() {
  return <Redirect href="/" />;
}
