import {
  addLocalDays,
  cycleEndDate,
  monthEnd,
  monthKey,
  monthStart,
  todayLocalDate,
  weekStart,
} from "../../src/features/cycles/domain/date";

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

describe("monthStart", () => {
  it("returns the first of a 31-day month", () => {
    expect(monthStart("2026-01-31")).toBe("2026-01-01");
  });

  it("returns the first of a 30-day month", () => {
    expect(monthStart("2026-04-15")).toBe("2026-04-01");
  });

  it("returns the first of a 28-day February", () => {
    expect(monthStart("2026-02-28")).toBe("2026-02-01");
  });

  it("returns the first of a leap-year February", () => {
    expect(monthStart("2028-02-29")).toBe("2028-02-01");
  });
});

describe("monthEnd", () => {
  it("ends a 31-day month on the 31st", () => {
    expect(monthEnd("2026-01-04")).toBe("2026-01-31");
  });

  it("ends a 30-day month on the 30th", () => {
    expect(monthEnd("2026-04-01")).toBe("2026-04-30");
  });

  it("ends a 28-day February on the 28th", () => {
    expect(monthEnd("2026-02-10")).toBe("2026-02-28");
  });

  it("ends a leap-year February on the 29th", () => {
    expect(monthEnd("2028-02-01")).toBe("2028-02-29");
  });

  it("ends December on the 31st without rolling the year", () => {
    expect(monthEnd("2026-12-15")).toBe("2026-12-31");
  });

  it("uses the day before January to close December across the year boundary", () => {
    expect(monthEnd("2026-12-31")).toBe("2026-12-31");
    expect(addLocalDays(monthStart("2027-01-01"), -1)).toBe("2026-12-31");
  });

  it("keeps March intact across the US spring-forward DST transition", () => {
    expect(monthStart("2026-03-08")).toBe("2026-03-01");
    expect(monthEnd("2026-03-08")).toBe("2026-03-31");
    expect(monthKey("2026-03-08")).toBe("2026-03");
  });

  it("keeps November intact across the US fall-back DST transition", () => {
    expect(monthStart("2026-11-01")).toBe("2026-11-01");
    expect(monthEnd("2026-11-01")).toBe("2026-11-30");
    expect(monthKey("2026-11-01")).toBe("2026-11");
  });
});

describe("monthKey", () => {
  it("returns YYYY-MM for dates inside the month", () => {
    expect(monthKey("2026-07-23")).toBe("2026-07");
    expect(monthKey("2026-01-01")).toBe("2026-01");
    expect(monthKey("2026-12-31")).toBe("2026-12");
  });
});
