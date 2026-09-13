import type { CycleDurationDays } from "./types";

function parseLocalDate(date: string): Date {
  const [year, month, day] = date.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day));
}

function formatLocalDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export function addLocalDays(date: string, count: number): string {
  const d = parseLocalDate(date);
  d.setUTCDate(d.getUTCDate() + count);
  return formatLocalDate(d);
}

export function cycleEndDate(startDate: string, durationDays: CycleDurationDays): string {
  return addLocalDays(startDate, durationDays - 1);
}

export function weekStart(date: string): string {
  const d = parseLocalDate(date);
  const daysSinceMonday = (d.getUTCDay() + 6) % 7;
  return addLocalDays(date, -daysSinceMonday);
}

export function monthKey(date: string): string {
  return date.slice(0, 7);
}

export function monthStart(date: string): string {
  return `${monthKey(date)}-01`;
}

export function monthEnd(date: string): string {
  const [year, month] = date.split("-").map(Number);
  const nextMonth = month === 12 ? 1 : month + 1;
  const nextYear = month === 12 ? year + 1 : year;
  const nextStart = `${String(nextYear).padStart(4, "0")}-${String(nextMonth).padStart(2, "0")}-01`;
  return addLocalDays(nextStart, -1);
}

/**
 * Formats a JS `Date` as a local `YYYY-MM-DD` string using its local
 * year/month/day components (never UTC), matching how every other local-date
 * string in the app is produced.
 */
export function todayLocalDate(referenceDate: Date = new Date()): string {
  const year = referenceDate.getFullYear();
  const month = String(referenceDate.getMonth() + 1).padStart(2, "0");
  const day = String(referenceDate.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

/**
 * Converts an ISO instant to the local calendar date that contains it on this
 * device. Session timestamps and their reporting date must always travel
 * through this boundary together.
 */
export function localDateForInstant(instant: string): string {
  const date = new Date(instant);
  if (Number.isNaN(date.getTime())) {
    throw new Error("startedAt must be a valid ISO timestamp");
  }

  return todayLocalDate(date);
}
