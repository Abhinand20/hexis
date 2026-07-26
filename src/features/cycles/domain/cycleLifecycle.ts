import type { Cycle } from "./types";

/**
 * A cycle's inclusive `endDate` has passed — it is no longer active as of `today`.
 */
export function hasCycleEnded(cycle: Pick<Cycle, "endDate">, today: string): boolean {
  return today > cycle.endDate;
}
