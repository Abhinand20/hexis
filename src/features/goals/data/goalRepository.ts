import type { SQLiteDatabase } from "expo-sqlite";
import type {
  CycleGoal,
  GoalCadence,
  GoalRevision,
} from "../../cycles/domain/types";
import { generateId } from "../../../db/id";

export type CreateGoalRevisionInput = {
  cycleGoalId: string;
  effectiveDate: string;
  name: string;
  cadence: GoalCadence;
  weeklyTargetCount: number;
  expectedDurationMinutes: number | null;
};

export interface GoalRepository {
  listForCycle(cycleId: string): Promise<CycleGoal[]>;
  createRevision(input: CreateGoalRevisionInput): Promise<GoalRevision>;
  listRevisions(cycleGoalId: string): Promise<GoalRevision[]>;
}

type CycleGoalRow = {
  id: string;
  cycle_id: string;
  name: string;
  cadence: string;
  weekly_target_count: number;
  expected_duration_minutes: number | null;
  created_at: string;
};

type GoalRevisionRow = {
  id: string;
  cycle_goal_id: string;
  effective_date: string;
  name: string;
  cadence: string;
  weekly_target_count: number;
  expected_duration_minutes: number | null;
  created_at: string;
};

function mapCycleGoal(row: CycleGoalRow): CycleGoal {
  return {
    id: row.id,
    cycleId: row.cycle_id,
    name: row.name,
    cadence: row.cadence as GoalCadence,
    weeklyTargetCount: row.weekly_target_count,
    expectedDurationMinutes: row.expected_duration_minutes,
    createdAt: row.created_at,
  };
}

function mapGoalRevision(row: GoalRevisionRow): GoalRevision {
  return {
    id: row.id,
    cycleGoalId: row.cycle_goal_id,
    effectiveDate: row.effective_date,
    name: row.name,
    cadence: row.cadence as GoalCadence,
    weeklyTargetCount: row.weekly_target_count,
    expectedDurationMinutes: row.expected_duration_minutes,
  };
}

export function createGoalRepository(db: SQLiteDatabase): GoalRepository {
  return {
    async listForCycle(cycleId) {
      const rows = await db.getAllAsync<CycleGoalRow>(
        "SELECT * FROM cycle_goals WHERE cycle_id = ?",
        [cycleId],
      );
      return rows.map(mapCycleGoal);
    },

    async createRevision(input) {
      const cycle = await db.getFirstAsync<{
        start_date: string;
        end_date: string;
      }>(
        `SELECT cycles.start_date AS start_date, cycles.end_date AS end_date
         FROM cycle_goals
         INNER JOIN cycles ON cycle_goals.cycle_id = cycles.id
         WHERE cycle_goals.id = ?`,
        [input.cycleGoalId],
      );

      if (!cycle) {
        throw new Error(`Cycle goal not found: ${input.cycleGoalId}`);
      }

      if (
        input.effectiveDate < cycle.start_date ||
        input.effectiveDate > cycle.end_date
      ) {
        throw new Error("Effective date must fall within the cycle");
      }

      const revision: GoalRevision = {
        id: generateId("revision"),
        cycleGoalId: input.cycleGoalId,
        effectiveDate: input.effectiveDate,
        name: input.name,
        cadence: input.cadence,
        weeklyTargetCount: input.weeklyTargetCount,
        expectedDurationMinutes: input.expectedDurationMinutes,
      };
      const createdAt = new Date().toISOString();

      await db.runAsync(
        `INSERT INTO goal_revisions (
          id, cycle_goal_id, effective_date, name, cadence,
          weekly_target_count, expected_duration_minutes, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          revision.id,
          revision.cycleGoalId,
          revision.effectiveDate,
          revision.name,
          revision.cadence,
          revision.weeklyTargetCount,
          revision.expectedDurationMinutes,
          createdAt,
        ],
      );

      return revision;
    },

    async listRevisions(cycleGoalId) {
      const rows = await db.getAllAsync<GoalRevisionRow>(
        `SELECT * FROM goal_revisions
         WHERE cycle_goal_id = ?
         ORDER BY effective_date ASC`,
        [cycleGoalId],
      );
      return rows.map(mapGoalRevision);
    },
  };
}
