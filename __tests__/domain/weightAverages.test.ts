import {
  buildMonthlyPeriods,
  buildWeeklyPeriods,
  compareWithPrevious,
} from "../../src/features/weight/domain/weightAverages";
import type { WeightEntry } from "../../src/features/weight/domain/types";

function entry(localDate: string, weightGrams: number): WeightEntry {
  return {
    id: `weight-${localDate}`,
    localDate,
    weightGrams,
    createdAt: `${localDate}T12:00:00.000Z`,
    updatedAt: `${localDate}T12:00:00.000Z`,
  };
}

describe("buildWeeklyPeriods", () => {
  it("averages a full seven-day week over recorded days only", () => {
    // Hand-calculated: 70000+70200+70400+70600+70800+71000+71200 = 494200
    // 494200 / 7 = 70600 g
    const entries = [
      entry("2026-09-07", 70000),
      entry("2026-09-08", 70200),
      entry("2026-09-09", 70400),
      entry("2026-09-10", 70600),
      entry("2026-09-11", 70800),
      entry("2026-09-12", 71000),
      entry("2026-09-13", 71200),
    ];

    const periods = buildWeeklyPeriods(entries, "2026-09-13");

    expect(periods).toHaveLength(1);
    expect(periods[0]).toEqual({
      key: "2026-09-07",
      startDate: "2026-09-07",
      endDate: "2026-09-13",
      averageGrams: 70600,
      recordedDays: 7,
      periodDays: 7,
      lowestGrams: 70000,
      highestGrams: 71200,
      firstGrams: 70000,
      lastGrams: 71200,
      isPartialPeriod: true,
    });
  });

  it("reports coverage 3 of 7 and does not treat missing days as zero", () => {
    // Hand-calculated: (70000 + 71000 + 72000) / 3 = 71000 g
    // Missing days stay unknown: not (70000+71000+72000)/7 = 30428.57
    const entries = [
      entry("2026-09-14", 70000),
      entry("2026-09-16", 71000),
      entry("2026-09-18", 72000),
    ];

    const [week] = buildWeeklyPeriods(entries, "2026-09-20");

    expect(week).toMatchObject({
      key: "2026-09-14",
      averageGrams: 71000,
      recordedDays: 3,
      periodDays: 7,
      lowestGrams: 70000,
      highestGrams: 72000,
      firstGrams: 70000,
      lastGrams: 72000,
    });
  });

  it("uses a single entry as the period average", () => {
    const periods = buildWeeklyPeriods(
      [entry("2026-09-12", 69500)],
      "2026-09-12",
    );

    expect(periods[0]).toMatchObject({
      key: "2026-09-07",
      averageGrams: 69500,
      recordedDays: 1,
      periodDays: 7,
      lowestGrams: 69500,
      highestGrams: 69500,
      firstGrams: 69500,
      lastGrams: 69500,
    });
    expect(
      compareWithPrevious(periods, "2026-09-07").averageDifferenceGrams,
    ).toBeNull();
    expect(compareWithPrevious(periods, "2026-09-07").previous).toBeNull();
  });

  it("includes the empty current week so a Monday opening still has this week", () => {
    const periods = buildWeeklyPeriods(
      [entry("2026-09-11", 70000)],
      "2026-09-14",
    );

    expect(periods.map((period) => period.key)).toEqual([
      "2026-09-07",
      "2026-09-14",
    ]);
    expect(periods[1]).toEqual({
      key: "2026-09-14",
      startDate: "2026-09-14",
      endDate: "2026-09-20",
      averageGrams: null,
      recordedDays: 0,
      periodDays: 7,
      lowestGrams: null,
      highestGrams: null,
      firstGrams: null,
      lastGrams: null,
      isPartialPeriod: true,
    });
  });

  it("keeps a week that spans a month boundary in one week bucket", () => {
    const entries = [
      entry("2026-08-31", 70000),
      entry("2026-09-02", 71000),
      entry("2026-09-06", 72000),
    ];

    const weeks = buildWeeklyPeriods(entries, "2026-09-06");

    expect(weeks).toHaveLength(1);
    expect(weeks[0]).toMatchObject({
      key: "2026-08-31",
      startDate: "2026-08-31",
      endDate: "2026-09-06",
      averageGrams: 71000,
      recordedDays: 3,
      periodDays: 7,
    });
  });

  it("buckets unsorted entries by the Monday of their week", () => {
    const entries = [
      entry("2026-09-13", 71200),
      entry("2026-09-07", 70000),
      entry("2026-09-10", 70600),
      entry("2026-09-08", 70200),
      entry("2026-09-12", 71000),
      entry("2026-09-09", 70400),
      entry("2026-09-11", 70800),
    ];

    const [week] = buildWeeklyPeriods(entries, "2026-09-13");

    expect(week.averageGrams).toBe(70600);
    expect(week.firstGrams).toBe(70000);
    expect(week.lastGrams).toBe(71200);
  });
});

describe("buildMonthlyPeriods", () => {
  it("splits a week that spans a month boundary into two month buckets", () => {
    const entries = [
      entry("2026-08-31", 70000),
      entry("2026-09-02", 71000),
      entry("2026-09-06", 72000),
    ];

    const months = buildMonthlyPeriods(entries, "2026-09-06");

    expect(months.map((period) => period.key)).toEqual(["2026-08", "2026-09"]);
    expect(months[0]).toMatchObject({
      key: "2026-08",
      startDate: "2026-08-01",
      endDate: "2026-08-31",
      averageGrams: 70000,
      recordedDays: 1,
      periodDays: 31,
      firstGrams: 70000,
      lastGrams: 70000,
    });
    expect(months[1]).toMatchObject({
      key: "2026-09",
      startDate: "2026-09-01",
      endDate: "2026-09-30",
      averageGrams: 71500,
      recordedDays: 2,
      periodDays: 30,
      lowestGrams: 71000,
      highestGrams: 72000,
    });
  });

  it("counts March 2026 as 31 days across the US spring-forward DST transition", () => {
    const entries = [
      entry("2026-03-07", 70000),
      entry("2026-03-08", 70100),
      entry("2026-03-09", 70200),
    ];

    const [march] = buildMonthlyPeriods(entries, "2026-03-15");

    expect(march).toMatchObject({
      key: "2026-03",
      startDate: "2026-03-01",
      endDate: "2026-03-31",
      periodDays: 31,
      recordedDays: 3,
      averageGrams: 70100,
    });
  });
});

describe("compareWithPrevious", () => {
  it("returns a signed gram difference between consecutive periods", () => {
    const entries = [
      entry("2026-09-07", 70000),
      entry("2026-09-08", 70000),
      entry("2026-09-14", 71000),
      entry("2026-09-15", 71000),
    ];
    const weeks = buildWeeklyPeriods(entries, "2026-09-20");

    expect(compareWithPrevious(weeks, "2026-09-14")).toMatchObject({
      period: { key: "2026-09-14", averageGrams: 71000 },
      previous: { key: "2026-09-07", averageGrams: 70000 },
      averageDifferenceGrams: 1000,
    });
    expect(compareWithPrevious(weeks, "2026-09-07").averageDifferenceGrams).toBeNull();
  });

  it("returns a negative difference when the later average is lower", () => {
    const entries = [
      entry("2026-09-07", 71000),
      entry("2026-09-14", 70000),
    ];
    const weeks = buildWeeklyPeriods(entries, "2026-09-20");

    expect(compareWithPrevious(weeks, "2026-09-14").averageDifferenceGrams).toBe(
      -1000,
    );
  });

  it("yields a null difference when the predecessor has no entries", () => {
    const weeks = buildWeeklyPeriods(
      [entry("2026-09-16", 70500)],
      "2026-09-20",
    );

    expect(compareWithPrevious(weeks, "2026-09-14")).toEqual({
      period: expect.objectContaining({
        key: "2026-09-14",
        averageGrams: 70500,
      }),
      previous: null,
      averageDifferenceGrams: null,
    });
  });

  it("yields a null difference when the current period has no average", () => {
    const weeks = buildWeeklyPeriods(
      [entry("2026-09-11", 70000)],
      "2026-09-14",
    );

    expect(compareWithPrevious(weeks, "2026-09-14")).toMatchObject({
      previous: { key: "2026-09-07", averageGrams: 70000 },
      averageDifferenceGrams: null,
    });
  });
});
