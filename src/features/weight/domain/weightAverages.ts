import {
  addLocalDays,
  monthEnd,
  monthKey,
  monthStart,
  weekStart,
} from "../../cycles/domain/date";
import type { WeightEntry } from "./types";

export type WeightPeriod = {
  key: string;
  startDate: string;
  endDate: string;
  averageGrams: number | null;
  recordedDays: number;
  periodDays: number;
  lowestGrams: number | null;
  highestGrams: number | null;
  firstGrams: number | null;
  lastGrams: number | null;
  isPartialPeriod: boolean;
};

export type WeightPeriodComparison = {
  period: WeightPeriod;
  previous: WeightPeriod | null;
  averageDifferenceGrams: number | null;
};

function inclusiveDayCount(startDate: string, endDate: string): number {
  let count = 0;
  let cursor = startDate;
  while (cursor <= endDate) {
    count += 1;
    cursor = addLocalDays(cursor, 1);
  }
  return count;
}

function recordedRange(
  entries: WeightEntry[],
): { min: string; max: string } | null {
  if (entries.length === 0) {
    return null;
  }

  let min = entries[0].localDate;
  let max = entries[0].localDate;
  for (const entry of entries) {
    if (entry.localDate < min) {
      min = entry.localDate;
    }
    if (entry.localDate > max) {
      max = entry.localDate;
    }
  }
  return { min, max };
}

function buildPeriod(
  key: string,
  startDate: string,
  endDate: string,
  entries: WeightEntry[],
  today: string,
  range: { min: string; max: string } | null,
): WeightPeriod {
  const inPeriod = entries
    .filter(
      (entry) => entry.localDate >= startDate && entry.localDate <= endDate,
    )
    .sort((left, right) => left.localDate.localeCompare(right.localDate));

  const recordedDays = inPeriod.length;
  const grams = inPeriod.map((entry) => entry.weightGrams);
  const averageGrams =
    recordedDays === 0
      ? null
      : Math.round(grams.reduce((sum, value) => sum + value, 0) / recordedDays);
  const containsToday = today >= startDate && today <= endDate;

  return {
    key,
    startDate,
    endDate,
    averageGrams,
    recordedDays,
    periodDays: inclusiveDayCount(startDate, endDate),
    lowestGrams: recordedDays === 0 ? null : Math.min(...grams),
    highestGrams: recordedDays === 0 ? null : Math.max(...grams),
    firstGrams: recordedDays === 0 ? null : inPeriod[0].weightGrams,
    lastGrams: recordedDays === 0 ? null : inPeriod[inPeriod.length - 1].weightGrams,
    isPartialPeriod:
      containsToday ||
      range === null ||
      startDate < range.min ||
      endDate > range.max,
  };
}

export function buildWeeklyPeriods(
  entries: WeightEntry[],
  today: string,
): WeightPeriod[] {
  const range = recordedRange(entries);
  const keys = new Set<string>([weekStart(today)]);
  for (const entry of entries) {
    keys.add(weekStart(entry.localDate));
  }

  return [...keys]
    .sort()
    .map((monday) =>
      buildPeriod(monday, monday, addLocalDays(monday, 6), entries, today, range),
    );
}

export function buildMonthlyPeriods(
  entries: WeightEntry[],
  today: string,
): WeightPeriod[] {
  const range = recordedRange(entries);
  const keys = new Set<string>([monthKey(today)]);
  for (const entry of entries) {
    keys.add(monthKey(entry.localDate));
  }

  return [...keys].sort().map((key) => {
    const startDate = monthStart(`${key}-01`);
    return buildPeriod(key, startDate, monthEnd(startDate), entries, today, range);
  });
}

function previousPeriodKey(key: string): string {
  if (key.length === 7) {
    return monthKey(addLocalDays(monthStart(`${key}-01`), -1));
  }
  return addLocalDays(key, -7);
}

export function compareWithPrevious(
  periods: WeightPeriod[],
  key: string,
): WeightPeriodComparison {
  const period = periods.find((candidate) => candidate.key === key);
  if (!period) {
    throw new Error(`Unknown period key: ${key}`);
  }

  const previous =
    periods.find((candidate) => candidate.key === previousPeriodKey(key)) ??
    null;
  const averageDifferenceGrams =
    period.averageGrams !== null &&
    previous !== null &&
    previous.averageGrams !== null
      ? period.averageGrams - previous.averageGrams
      : null;

  return { period, previous, averageDifferenceGrams };
}
