import type { SQLiteDatabase } from "expo-sqlite";
import type {
  CycleGoal,
  GoalCadence,
  GoalRevision,
} from "../../cycles/domain/types";
import { generateId } from "../../../db/id";
import { todayLocalDate } from "../../cycles/domain/date";

export type CreateGoalRevisionInput = {
  cycleGoalId: string;
  effectiveDate: string;
  name: string;
  cadence: GoalCadence;
  weeklyTargetCount: number;
  expectedDurationMinutes: number | null;
};

export type CreateGoalMembershipInput = {
  cycleId: string;
  name: string;
  cadence: GoalCadence;
  weeklyTargetCount: number;
  expectedDurationMinutes: number | null;
};

export interface GoalRepository {
  listForCycle(cycleId: string): Promise<CycleGoal[]>;
  listActiveForCycle(cycleId: string, localDate: string): Promise<CycleGoal[]>;
  createForActiveCycle(
    input: CreateGoalMembershipInput,
    effectiveDate: string,
  ): Promise<CycleGoal>;
  stopTracking(goalId: string, effectiveDate: string): Promise<CycleGoal>;
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
  active_from_date: string;
  inactive_from_date: string | null;
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
    activeFromDate: row.active_from_date,
    inactiveFromDate: row.inactive_from_date,
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

function validateGoalInput(input: CreateGoalMembershipInput): void {
  if (input.name.trim().length === 0) {
    throw new Error("Practice name is required");
  }
  if (
    !Number.isInteger(input.weeklyTargetCount) ||
    input.weeklyTargetCount <= 0
  ) {
    throw new Error("weeklyTargetCount must be a positive integer");
  }
  if (
    input.expectedDurationMinutes !== null &&
    (!Number.isInteger(input.expectedDurationMinutes) ||
      input.expectedDurationMinutes <= 0)
  ) {
    throw new Error(
      "expectedDurationMinutes must be a positive integer or null",
    );
  }
}

export function createGoalRepository(db: SQLiteDatabase): GoalRepository {
  return {
    async listForCycle(cycleId) {
      const rows = await db.getAllAsync<CycleGoalRow>(
        `SELECT * FROM cycle_goals
         WHERE cycle_id = ?
         ORDER BY created_at ASC, id ASC`,
        [cycleId],
      );
      return rows.map(mapCycleGoal);
    },

    async listActiveForCycle(cycleId, localDate) {
      const rows = await db.getAllAsync<CycleGoalRow>(
        `SELECT * FROM cycle_goals
         WHERE cycle_id = ?
           AND active_from_date <= ?
           AND (inactive_from_date IS NULL OR inactive_from_date > ?)
         ORDER BY created_at ASC, id ASC`,
        [cycleId, localDate, localDate],
      );
      return rows.map(mapCycleGoal);
    },

    async createForActiveCycle(input, effectiveDate) {
      validateGoalInput(input);
      if (effectiveDate !== todayLocalDate()) {
        throw new Error("Practice membership changes must take effect today");
      }
      const cycle = await db.getFirstAsync<{
        start_date: string;
        end_date: string;
        status: string;
      }>(
        `SELECT start_date, end_date, status
         FROM cycles WHERE id = ?`,
        [input.cycleId],
      );
      if (!cycle) {
        throw new Error(`Cycle not found: ${input.cycleId}`);
      }
      if (cycle.status !== "active") {
        throw new Error("Practices can only be added to an active cycle");
      }
      if (effectiveDate < cycle.start_date || effectiveDate > cycle.end_date) {
        throw new Error("Effective date must fall within the active cycle");
      }

      const createdAt = new Date().toISOString();
      const goal: CycleGoal = {
        id: generateId("goal"),
        cycleId: input.cycleId,
        name: input.name.trim(),
        cadence: input.cadence,
        weeklyTargetCount: input.weeklyTargetCount,
        expectedDurationMinutes: input.expectedDurationMinutes,
        activeFromDate: effectiveDate,
        inactiveFromDate: null,
        createdAt,
      };

      await db.runAsync(
        `INSERT INTO cycle_goals (
          id, cycle_id, name, cadence, weekly_target_count,
          expected_duration_minutes, active_from_date,
          inactive_from_date, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          goal.id,
          goal.cycleId,
          goal.name,
          goal.cadence,
          goal.weeklyTargetCount,
          goal.expectedDurationMinutes,
          goal.activeFromDate,
          goal.inactiveFromDate,
          goal.createdAt,
        ],
      );
      return goal;
    },

    async stopTracking(goalId, effectiveDate) {
      if (effectiveDate !== todayLocalDate()) {
        throw new Error("Practice membership changes must take effect today");
      }
      let stopped: CycleGoal | null = null;

      await db.withTransactionAsync(async () => {
        const row = await db.getFirstAsync<
          CycleGoalRow & {
            cycle_start_date: string;
            cycle_end_date: string;
            cycle_status: string;
          }
        >(
          `SELECT cycle_goals.*,
                  cycles.start_date AS cycle_start_date,
                  cycles.end_date AS cycle_end_date,
                  cycles.status AS cycle_status
           FROM cycle_goals
           INNER JOIN cycles ON cycles.id = cycle_goals.cycle_id
           WHERE cycle_goals.id = ?`,
          [goalId],
        );
        if (!row) {
          throw new Error(`Cycle goal not found: ${goalId}`);
        }
        if (row.cycle_status !== "active") {
          throw new Error("Practices can only be stopped in an active cycle");
        }
        if (
          effectiveDate < row.cycle_start_date ||
          effectiveDate > row.cycle_end_date
        ) {
          throw new Error("Effective date must fall within the active cycle");
        }
        if (
          effectiveDate <= row.active_from_date ||
          (row.inactive_from_date !== null &&
            effectiveDate >= row.inactive_from_date)
        ) {
          throw new Error("Practice is not active on the effective date");
        }

        const count = await db.getFirstAsync<{ count: number }>(
          `SELECT COUNT(*) AS count
           FROM cycle_goals
           WHERE cycle_id = ?
             AND active_from_date <= ?
             AND (inactive_from_date IS NULL OR inactive_from_date > ?)`,
          [row.cycle_id, effectiveDate, effectiveDate],
        );
        if ((count?.count ?? 0) <= 1) {
          throw new Error("An active cycle must keep at least one practice");
        }

        await db.runAsync(
          `UPDATE cycle_goals
           SET inactive_from_date = ?
           WHERE id = ?`,
          [effectiveDate, goalId],
        );
        stopped = {
          ...mapCycleGoal(row),
          inactiveFromDate: effectiveDate,
        };
      });

      if (!stopped) {
        throw new Error(`Unable to stop practice: ${goalId}`);
      }
      return stopped;
    },

    async createRevision(input) {
      const cycle = await db.getFirstAsync<{
        start_date: string;
        end_date: string;
        active_from_date: string;
        inactive_from_date: string | null;
      }>(
        `SELECT cycles.start_date AS start_date,
                cycles.end_date AS end_date,
                cycle_goals.active_from_date AS active_from_date,
                cycle_goals.inactive_from_date AS inactive_from_date
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
      if (
        input.effectiveDate < cycle.active_from_date ||
        (cycle.inactive_from_date !== null &&
          input.effectiveDate >= cycle.inactive_from_date)
      ) {
        throw new Error(
          "Effective date must fall within the practice membership",
        );
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
         ORDER BY effective_date ASC, created_at ASC, id ASC`,
        [cycleGoalId],
      );
      return rows.map(mapGoalRevision);
    },
  };
}
