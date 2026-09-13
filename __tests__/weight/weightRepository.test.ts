import type { SQLiteDatabase } from "expo-sqlite";

import { openDatabase } from "../../src/db/client";
import { createWeightRepository } from "../../src/features/weight/data/weightRepository";
import {
  formatWeight,
  gramsToUnit,
  isPlausibleWeight,
  PLAUSIBLE_MAX_GRAMS,
  PLAUSIBLE_MIN_GRAMS,
  unitToGrams,
} from "../../src/features/weight/domain/units";

describe("weight units", () => {
  it("rounds display values to whole grams and back to one decimal", () => {
    expect(unitToGrams(69.5, "kg")).toBe(69500);
    expect(gramsToUnit(69500, "kg")).toBe(69.5);
    expect(formatWeight(69500, "kg")).toBe("69.5 kg");

    expect(unitToGrams(154.3, "lb")).toBe(69989);
    expect(gramsToUnit(69989, "lb")).toBe(154.3);
    expect(formatWeight(69989, "lb")).toBe("154.3 lb");
  });

  it("treats the accepted range as inclusive 20–500 kg equivalent", () => {
    expect(isPlausibleWeight(PLAUSIBLE_MIN_GRAMS)).toBe(true);
    expect(isPlausibleWeight(PLAUSIBLE_MAX_GRAMS)).toBe(true);
    expect(isPlausibleWeight(PLAUSIBLE_MIN_GRAMS - 1)).toBe(false);
    expect(isPlausibleWeight(PLAUSIBLE_MAX_GRAMS + 1)).toBe(false);
    expect(isPlausibleWeight(70000.5)).toBe(false);
  });
});

describe("weight repository", () => {
  let db: SQLiteDatabase;

  beforeEach(async () => {
    jest.useFakeTimers().setSystemTime(new Date(2026, 8, 12, 12));
    db = await openDatabase(":memory:");
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it("updates the same date in place and keeps the original id and created_at", async () => {
    const repository = createWeightRepository(db);
    const createdAt = new Date(2026, 8, 12, 8).toISOString();
    jest.setSystemTime(new Date(2026, 8, 12, 8));

    const first = await repository.save({
      localDate: "2026-09-12",
      weightGrams: 70000,
    });
    expect(first).toMatchObject({
      localDate: "2026-09-12",
      weightGrams: 70000,
      createdAt,
      updatedAt: createdAt,
    });

    jest.setSystemTime(new Date(2026, 8, 12, 18));
    const updatedAt = new Date(2026, 8, 12, 18).toISOString();
    const second = await repository.save({
      localDate: "2026-09-12",
      weightGrams: 70500,
    });

    expect(second).toEqual({
      id: first.id,
      localDate: "2026-09-12",
      weightGrams: 70500,
      createdAt,
      updatedAt,
    });
    expect(second.updatedAt > second.createdAt).toBe(true);
    expect(
      await db.getFirstAsync<{ count: number }>(
        "SELECT COUNT(*) AS count FROM daily_weights",
      ),
    ).toEqual({ count: 1 });
    expect(
      await db.getFirstAsync(
        `SELECT id, local_date, weight_grams, created_at, updated_at
         FROM daily_weights WHERE local_date = ?`,
        ["2026-09-12"],
      ),
    ).toEqual({
      id: first.id,
      local_date: "2026-09-12",
      weight_grams: 70500,
      created_at: createdAt,
      updated_at: updatedAt,
    });
  });

  it("deletes only the requested date", async () => {
    const repository = createWeightRepository(db);
    await repository.save({ localDate: "2026-09-10", weightGrams: 70000 });
    await repository.save({ localDate: "2026-09-11", weightGrams: 70200 });
    await repository.save({ localDate: "2026-09-12", weightGrams: 70400 });

    await repository.deleteByDate("2026-09-11");

    expect(await repository.getByDate("2026-09-11")).toBeNull();
    expect(await repository.getByDate("2026-09-10")).toMatchObject({
      localDate: "2026-09-10",
      weightGrams: 70000,
    });
    expect(await repository.getByDate("2026-09-12")).toMatchObject({
      localDate: "2026-09-12",
      weightGrams: 70400,
    });
  });

  it("lists an inclusive date range in ascending order", async () => {
    const repository = createWeightRepository(db);
    await repository.save({ localDate: "2026-09-08", weightGrams: 69000 });
    await repository.save({ localDate: "2026-09-10", weightGrams: 70000 });
    await repository.save({ localDate: "2026-09-12", weightGrams: 71000 });
    await repository.save({ localDate: "2026-09-09", weightGrams: 69500 });

    const range = await repository.listRange("2026-09-09", "2026-09-12");

    expect(range.map((entry) => entry.localDate)).toEqual([
      "2026-09-09",
      "2026-09-10",
      "2026-09-12",
    ]);
    expect(range.map((entry) => entry.weightGrams)).toEqual([
      69500, 70000, 71000,
    ]);
  });

  it("lists recent entries newest first and respects the limit", async () => {
    const repository = createWeightRepository(db);
    await repository.save({ localDate: "2026-09-08", weightGrams: 69000 });
    await repository.save({ localDate: "2026-09-10", weightGrams: 70000 });
    await repository.save({ localDate: "2026-09-12", weightGrams: 71000 });
    await repository.save({ localDate: "2026-09-09", weightGrams: 69500 });

    const recent = await repository.listRecent(3);

    expect(recent.map((entry) => entry.localDate)).toEqual([
      "2026-09-12",
      "2026-09-10",
      "2026-09-09",
    ]);
  });

  it("returns kilograms when no preference row exists and round-trips setUnit", async () => {
    const repository = createWeightRepository(db);

    expect(
      await db.getFirstAsync<{ count: number }>(
        "SELECT COUNT(*) AS count FROM weight_preferences",
      ),
    ).toEqual({ count: 0 });
    expect(await repository.getUnit()).toBe("kg");

    await repository.setUnit("lb");
    expect(await repository.getUnit()).toBe("lb");
    expect(
      await db.getFirstAsync("SELECT id, unit FROM weight_preferences"),
    ).toEqual({ id: 1, unit: "lb" });

    await repository.setUnit("kg");
    expect(await repository.getUnit()).toBe("kg");
    expect(
      await db.getFirstAsync<{ count: number }>(
        "SELECT COUNT(*) AS count FROM weight_preferences",
      ),
    ).toEqual({ count: 1 });
  });

  it("rejects a future date before writing", async () => {
    const repository = createWeightRepository(db);

    await expect(
      repository.save({ localDate: "2026-09-13", weightGrams: 70000 }),
    ).rejects.toThrow(/future/i);

    expect(
      await db.getFirstAsync("SELECT id FROM daily_weights"),
    ).toBeNull();
  });

  it("rejects an implausible weight before writing", async () => {
    const repository = createWeightRepository(db);

    await expect(
      repository.save({ localDate: "2026-09-12", weightGrams: 19_999 }),
    ).rejects.toThrow(/20 kg/i);
    await expect(
      repository.save({ localDate: "2026-09-12", weightGrams: 500_001 }),
    ).rejects.toThrow(/500 kg/i);

    expect(
      await db.getFirstAsync("SELECT id FROM daily_weights"),
    ).toBeNull();
  });
});
