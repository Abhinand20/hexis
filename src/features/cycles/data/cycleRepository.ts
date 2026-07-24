import type { SQLiteDatabase } from "expo-sqlite";
import { cycleEndDate } from "../domain/date";
import type { Cycle, CycleDurationDays, GoalCadence } from "../domain/types";
import { generateId } from "../../../db/id";

export type CreateCycleGoalInput = {
  name: string;
  cadence: GoalCadence;
  weeklyTargetCount: number;
  expectedDurationMinutes: number | null;
};

export type CreateCycleInput = {
  name: string;
  startDate: string;
  durationDays: CycleDurationDays;
  goals: CreateCycleGoalInput[];
};

export interface CycleRepository {
  createCycle(input: CreateCycleInput): Promise<Cycle>;
  getActiveCycle(): Promise<Cycle | null>;
  endCycleEarly(cycleId: string, localDate: string): Promise<void>;
}

type CycleRow = {
  id: string;
  name: string;
  start_date: string;
  duration_days: number;
  end_date: string;
  status: string;
  created_at: string;
};

function mapCycle(row: CycleRow): Cycle {
  return {
    id: row.id,
    name: row.name,
    startDate: row.start_date,
    durationDays: row.duration_days as CycleDurationDays,
    endDate: row.end_date,
    status: row.status as Cycle["status"],
    createdAt: row.created_at,
  };
}

export function createCycleRepository(db: SQLiteDatabase): CycleRepository {
  return {
    async createCycle(input) {
      const existing = await db.getFirstAsync<{ id: string }>(
        "SELECT id FROM cycles WHERE status = 'active' LIMIT 1",
      );
      if (existing) {
        throw new Error("An active cycle already exists");
      }

      const id = generateId("cycle");
      const endDate = cycleEndDate(input.startDate, input.durationDays);
      const createdAt = new Date().toISOString();
      const cycle: Cycle = {
        id,
        name: input.name,
        startDate: input.startDate,
        durationDays: input.durationDays,
        endDate,
        status: "active",
        createdAt,
      };

      await db.withTransactionAsync(async () => {
        await db.runAsync(
          `INSERT INTO cycles (id, name, start_date, duration_days, end_date, status, created_at)
           VALUES (?, ?, ?, ?, ?, ?, ?)`,
          [
            cycle.id,
            cycle.name,
            cycle.startDate,
            cycle.durationDays,
            cycle.endDate,
            cycle.status,
            cycle.createdAt,
          ],
        );

        for (const goal of input.goals) {
          await db.runAsync(
            `INSERT INTO cycle_goals (
              id, cycle_id, name, cadence, weekly_target_count,
              expected_duration_minutes, created_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?)`,
            [
              generateId("goal"),
              cycle.id,
              goal.name,
              goal.cadence,
              goal.weeklyTargetCount,
              goal.expectedDurationMinutes,
              createdAt,
            ],
          );
        }
      });

      return cycle;
    },

    async getActiveCycle() {
      const row = await db.getFirstAsync<CycleRow>(
        "SELECT * FROM cycles WHERE status = 'active'",
      );
      return row ? mapCycle(row) : null;
    },

    async endCycleEarly(cycleId, localDate) {
      const row = await db.getFirstAsync<CycleRow>(
        "SELECT * FROM cycles WHERE id = ?",
        [cycleId],
      );
      if (!row) {
        throw new Error(`Cycle not found: ${cycleId}`);
      }

      if (localDate < row.end_date) {
        await db.runAsync(
          "UPDATE cycles SET status = 'ended_early', end_date = ? WHERE id = ?",
          [localDate, cycleId],
        );
      } else {
        await db.runAsync(
          "UPDATE cycles SET status = 'ended_early' WHERE id = ?",
          [cycleId],
        );
      }
    },
  };
}
