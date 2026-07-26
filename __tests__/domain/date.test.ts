import { addLocalDays, cycleEndDate, todayLocalDate, weekStart } from "../../src/features/cycles/domain/date";

describe("addLocalDays", () => {
  it("adds days without shifting across a UTC boundary", () => {
    expect(addLocalDays("2026-07-23", 1)).toBe("2026-07-24");
  });

  it("supports negative counts", () => {
    expect(addLocalDays("2026-07-23", -3)).toBe("2026-07-20");
  });

  it("rolls over month and year boundaries", () => {
    expect(addLocalDays("2026-12-30", 5)).toBe("2027-01-04");
  });
});

describe("cycleEndDate", () => {
  it("sets the inclusive end of a 30-day cycle", () => {
    expect(cycleEndDate("2026-07-01", 30)).toBe("2026-07-30");
  });

  it("sets the inclusive end of a 90-day cycle", () => {
    expect(cycleEndDate("2026-01-01", 90)).toBe("2026-03-31");
  });
});

describe("weekStart", () => {
  it("starts weeks on Monday", () => {
    expect(weekStart("2026-07-23")).toBe("2026-07-20");
  });

  it("returns the same date when it is already Monday", () => {
    expect(weekStart("2026-07-20")).toBe("2026-07-20");
  });

  it("rolls Sunday back to the preceding Monday", () => {
    expect(weekStart("2026-07-26")).toBe("2026-07-20");
  });
});

describe("todayLocalDate", () => {
  it("formats a Date's local year/month/day, zero-padded", () => {
    expect(todayLocalDate(new Date(2026, 0, 5))).toBe("2026-01-05");
  });

  it("does not shift across a UTC boundary for late-night local times", () => {
    // 11:30pm local time must still report the local calendar day, not the
    // UTC day it may already have rolled into.
    expect(todayLocalDate(new Date(2026, 6, 24, 23, 30))).toBe("2026-07-24");
  });
});
