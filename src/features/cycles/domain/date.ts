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
