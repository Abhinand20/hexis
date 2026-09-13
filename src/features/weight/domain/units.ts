import type { WeightUnit } from "./types";

export const GRAMS_PER_KG = 1000;
export const GRAMS_PER_LB = 453.59237;
export const PLAUSIBLE_MIN_GRAMS = 20_000;
export const PLAUSIBLE_MAX_GRAMS = 500_000;

export function unitToGrams(value: number, unit: WeightUnit): number {
  return Math.round(value * gramsPerUnit(unit));
}

export function gramsToUnit(grams: number, unit: WeightUnit): number {
  return Math.round((grams / gramsPerUnit(unit)) * 10) / 10;
}

export function formatWeight(grams: number, unit: WeightUnit): string {
  return `${gramsToUnit(grams, unit).toFixed(1)} ${unit}`;
}

/**
 * Returns null for anything that is not a plain positive decimal, so a partly
 * typed value never reaches `unitToGrams` and get stored as a rounded guess.
 */
export function parseDisplayWeight(raw: string): number | null {
  const trimmed = raw.trim();
  if (trimmed === "" || !/^\d+(\.\d+)?$/.test(trimmed)) {
    return null;
  }
  const value = Number(trimmed);
  return Number.isFinite(value) ? value : null;
}

export function isPlausibleWeight(grams: number): boolean {
  return (
    Number.isInteger(grams) &&
    grams >= PLAUSIBLE_MIN_GRAMS &&
    grams <= PLAUSIBLE_MAX_GRAMS
  );
}

function gramsPerUnit(unit: WeightUnit): number {
  return unit === "kg" ? GRAMS_PER_KG : GRAMS_PER_LB;
}
