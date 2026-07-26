import { hasCycleEnded } from "../../src/features/cycles/domain/cycleLifecycle";

describe("hasCycleEnded", () => {
  it("returns false when today is on or before the inclusive endDate", () => {
    expect(hasCycleEnded({ endDate: "2026-06-30" }, "2026-06-30")).toBe(false);
    expect(hasCycleEnded({ endDate: "2026-06-30" }, "2026-06-29")).toBe(false);
  });

  it("returns true when today is after the inclusive endDate", () => {
    expect(hasCycleEnded({ endDate: "2026-06-30" }, "2026-07-01")).toBe(true);
  });
});
