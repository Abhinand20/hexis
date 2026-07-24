import type { Cycle } from "../domain/types";

export type ActiveCycleState = {
  cycle: Cycle | null;
  isLoading: boolean;
};

/**
 * Temporary stub: there is no persistence layer yet (see implementation-plan.md
 * Task 4), so no cycle can exist. Replace this body with a `CycleRepository
 * .getActiveCycle()` read once the repository lands; the return shape should
 * not need to change.
 */
export function useActiveCycle(): ActiveCycleState {
  return { cycle: null, isLoading: false };
}
