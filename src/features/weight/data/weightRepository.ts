import type { SQLiteDatabase } from "expo-sqlite";

import { generateId } from "../../../db/id";
import { todayLocalDate } from "../../cycles/domain/date";
import type { WeightEntry, WeightUnit } from "../domain/types";
import { isPlausibleWeight } from "../domain/units";

export type SaveWeightInput = { localDate: string; weightGrams: number };

export interface WeightRepository {
  save(input: SaveWeightInput): Promise<WeightEntry>;
  deleteByDate(localDate: string): Promise<void>;
  getByDate(localDate: string): Promise<WeightEntry | null>;
  listRange(startDate: string, endDate: string): Promise<WeightEntry[]>;
  listRecent(limit: number): Promise<WeightEntry[]>;
  getUnit(): Promise<WeightUnit>;
  setUnit(unit: WeightUnit): Promise<void>;
}

type WeightRow = {
  id: string;
  local_date: string;
  weight_grams: number;
  created_at: string;
  updated_at: string;
};

function mapWeightEntry(row: WeightRow): WeightEntry {
  return {
    id: row.id,
    localDate: row.local_date,
    weightGrams: row.weight_grams,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function assertSaveInput(input: SaveWeightInput): void {
  if (input.localDate > todayLocalDate()) {
    throw new Error("A weight cannot be recorded for a future date.");
  }
  if (!isPlausibleWeight(input.weightGrams)) {
    throw new Error("Weight must be between 20 kg and 500 kg.");
  }
}

export function createWeightRepository(db: SQLiteDatabase): WeightRepository {
  return {
    async save(input) {
      assertSaveInput(input);

      const now = new Date().toISOString();
      await db.runAsync(
        `INSERT INTO daily_weights (
          id, local_date, weight_grams, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?)
        ON CONFLICT(local_date) DO UPDATE SET
          weight_grams = excluded.weight_grams,
          updated_at = excluded.updated_at`,
        [
          generateId("weight"),
          input.localDate,
          input.weightGrams,
          now,
          now,
        ],
      );

      const row = await db.getFirstAsync<WeightRow>(
        "SELECT * FROM daily_weights WHERE local_date = ?",
        [input.localDate],
      );
      if (!row) {
        throw new Error("Unable to save weight entry");
      }
      return mapWeightEntry(row);
    },

    async deleteByDate(localDate) {
      await db.runAsync("DELETE FROM daily_weights WHERE local_date = ?", [
        localDate,
      ]);
    },

    async getByDate(localDate) {
      const row = await db.getFirstAsync<WeightRow>(
        "SELECT * FROM daily_weights WHERE local_date = ?",
        [localDate],
      );
      return row ? mapWeightEntry(row) : null;
    },

    async listRange(startDate, endDate) {
      const rows = await db.getAllAsync<WeightRow>(
        `SELECT * FROM daily_weights
         WHERE local_date >= ? AND local_date <= ?
         ORDER BY local_date ASC`,
        [startDate, endDate],
      );
      return rows.map(mapWeightEntry);
    },

    async listRecent(limit) {
      const rows = await db.getAllAsync<WeightRow>(
        `SELECT * FROM daily_weights
         ORDER BY local_date DESC
         LIMIT ?`,
        [limit],
      );
      return rows.map(mapWeightEntry);
    },

    async getUnit() {
      const row = await db.getFirstAsync<{ unit: WeightUnit }>(
        "SELECT unit FROM weight_preferences WHERE id = 1",
      );
      return row?.unit ?? "kg";
    },

    async setUnit(unit) {
      await db.runAsync(
        `INSERT INTO weight_preferences (id, unit) VALUES (1, ?)
         ON CONFLICT(id) DO UPDATE SET unit = excluded.unit`,
        [unit],
      );
    },
  };
}
