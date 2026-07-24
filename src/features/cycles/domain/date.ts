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
