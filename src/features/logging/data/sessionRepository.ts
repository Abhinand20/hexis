import type { SQLiteDatabase } from "expo-sqlite";
import type { SessionLog } from "../../cycles/domain/types";
import { generateId } from "../../../db/id";

export type CreateSessionLogInput = {
  cycleGoalId: string;
  localDate: string;
  durationMinutes: number | null;
};

export interface SessionRepository {
  create(input: CreateSessionLogInput): Promise<SessionLog>;
  listForCycle(cycleId: string): Promise<SessionLog[]>;
}

type SessionLogRow = {
  id: string;
  cycle_goal_id: string;
  local_date: string;
  duration_minutes: number | null;
  created_at: string;
};

function mapSessionLog(row: SessionLogRow): SessionLog {
  return {
    id: row.id,
    cycleGoalId: row.cycle_goal_id,
    localDate: row.local_date,
    durationMinutes: row.duration_minutes,
    createdAt: row.created_at,
  };
}

export function createSessionRepository(db: SQLiteDatabase): SessionRepository {
  return {
    async create(input) {
      const session: SessionLog = {
        id: generateId("log"),
        cycleGoalId: input.cycleGoalId,
        localDate: input.localDate,
        durationMinutes: input.durationMinutes,
        createdAt: new Date().toISOString(),
      };

      await db.runAsync(
        `INSERT INTO session_logs (
          id, cycle_goal_id, local_date, duration_minutes, created_at
        ) VALUES (?, ?, ?, ?, ?)`,
        [
          session.id,
          session.cycleGoalId,
          session.localDate,
          session.durationMinutes,
          session.createdAt,
        ],
      );

      return session;
    },

    async listForCycle(cycleId) {
      const rows = await db.getAllAsync<SessionLogRow>(
        `SELECT session_logs.*
         FROM session_logs
         INNER JOIN cycle_goals ON session_logs.cycle_goal_id = cycle_goals.id
         WHERE cycle_goals.cycle_id = ?`,
        [cycleId],
      );
      return rows.map(mapSessionLog);
    },
  };
}
