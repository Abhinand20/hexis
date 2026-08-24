import type { SQLiteDatabase } from "expo-sqlite";
import type { SessionLog } from "../../cycles/domain/types";
import { localDateForInstant } from "../../cycles/domain/date";
import { generateId } from "../../../db/id";

export type CreateSessionLogInput = {
  cycleGoalId: string;
  /** Omit for a live log. Historical entry supplies the chosen ISO instant. */
  startedAt?: string;
  durationMinutes: number | null;
};

export interface SessionRepository {
  create(input: CreateSessionLogInput): Promise<SessionLog>;
  deleteById(id: string): Promise<void>;
  listForCycle(cycleId: string): Promise<SessionLog[]>;
}

type SessionLogRow = {
  id: string;
  cycle_goal_id: string;
  local_date: string;
  started_at: string;
  duration_minutes: number | null;
  created_at: string;
};

function mapSessionLog(row: SessionLogRow): SessionLog {
  return {
    id: row.id,
    cycleGoalId: row.cycle_goal_id,
    localDate: row.local_date,
    startedAt: row.started_at,
    durationMinutes: row.duration_minutes,
    createdAt: row.created_at,
  };
}

export function createSessionRepository(db: SQLiteDatabase): SessionRepository {
  return {
    async create(input) {
      const createdAt = new Date().toISOString();
      const startedAt = input.startedAt ?? createdAt;
      const session: SessionLog = {
        id: generateId("log"),
        cycleGoalId: input.cycleGoalId,
        localDate: localDateForInstant(startedAt),
        startedAt,
        durationMinutes: input.durationMinutes,
        createdAt,
      };

      await db.runAsync(
        `INSERT INTO session_logs (
          id, cycle_goal_id, local_date, started_at, duration_minutes, created_at
        ) VALUES (?, ?, ?, ?, ?, ?)`,
        [
          session.id,
          session.cycleGoalId,
          session.localDate,
          session.startedAt,
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

    async deleteById(id) {
      await db.runAsync("DELETE FROM session_logs WHERE id = ?", [id]);
    },
  };
}
