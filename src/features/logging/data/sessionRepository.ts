import type { SQLiteDatabase } from "expo-sqlite";
import { generateId } from "../../../db/id";
import {
  localDateForInstant,
  todayLocalDate,
} from "../../cycles/domain/date";
import type {
  SessionLog,
  SessionLogAuditHistory,
  SessionLogRevision,
} from "../../cycles/domain/types";

export type CreateSessionLogInput = {
  cycleGoalId: string;
  /** Omit for a live log. Historical entry supplies the chosen ISO instant. */
  startedAt?: string;
  durationMinutes: number | null;
};

export type CorrectSessionLogInput = {
  cycleGoalId: string;
  startedAt: string;
  durationMinutes: number | null;
};

export interface SessionRepository {
  create(input: CreateSessionLogInput): Promise<SessionLog>;
  correct(
    sourceSessionId: string,
    input: CorrectSessionLogInput,
  ): Promise<SessionLog>;
  deleteById(sourceSessionId: string): Promise<void>;
  listForCycle(cycleId: string): Promise<SessionLog[]>;
  listForDay(cycleId: string, localDate: string): Promise<SessionLog[]>;
  getAuditHistory(
    sourceSessionId: string,
  ): Promise<SessionLogAuditHistory | null>;
}

type SessionLogRow = {
  id: string;
  cycle_goal_id: string;
  local_date: string;
  started_at: string;
  duration_minutes: number | null;
  created_at: string;
};

type SessionLogRevisionRow = {
  sequence: number;
  source_session_id: string;
  cycle_goal_id: string;
  local_date: string;
  started_at: string;
  duration_minutes: number | null;
  tombstone: number;
  created_at: string;
};

type SourceCycleRow = {
  cycle_id: string;
  start_date: string;
  end_date: string;
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

function mapSessionLogRevision(
  row: SessionLogRevisionRow,
): SessionLogRevision {
  return {
    sequence: row.sequence,
    sourceSessionId: row.source_session_id,
    cycleGoalId: row.cycle_goal_id,
    localDate: row.local_date,
    startedAt: row.started_at,
    durationMinutes: row.duration_minutes,
    tombstone: row.tombstone === 1,
    createdAt: row.created_at,
  };
}

function validateDuration(durationMinutes: number | null): void {
  if (
    durationMinutes !== null &&
    (!Number.isInteger(durationMinutes) || durationMinutes <= 0)
  ) {
    throw new Error("durationMinutes must be a positive integer or null");
  }
}

function localDateForSessionInstant(startedAt: string): string {
  if (
    !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/.test(
      startedAt,
    )
  ) {
    throw new Error("startedAt must be a valid ISO timestamp with a timezone");
  }
  return localDateForInstant(startedAt);
}

function effectiveSessionSql(extraWhere: string): string {
  return `SELECT
      session_logs.id AS id,
      COALESCE(latest.cycle_goal_id, session_logs.cycle_goal_id) AS cycle_goal_id,
      COALESCE(latest.local_date, session_logs.local_date) AS local_date,
      COALESCE(latest.started_at, session_logs.started_at) AS started_at,
      CASE
        WHEN latest.sequence IS NULL THEN session_logs.duration_minutes
        ELSE latest.duration_minutes
      END AS duration_minutes,
      session_logs.created_at AS created_at
    FROM session_logs
    INNER JOIN cycle_goals AS source_goal
      ON session_logs.cycle_goal_id = source_goal.id
    LEFT JOIN session_log_revisions AS latest
      ON latest.sequence = (
        SELECT MAX(candidate.sequence)
        FROM session_log_revisions AS candidate
        WHERE candidate.source_session_id = session_logs.id
      )
    WHERE COALESCE(latest.tombstone, 0) = 0
      AND (${extraWhere})`;
}

async function sourceCycleForSession(
  db: SQLiteDatabase,
  sourceSessionId: string,
): Promise<SourceCycleRow | null> {
  return db.getFirstAsync<SourceCycleRow>(
    `SELECT cycles.id AS cycle_id,
            cycles.start_date AS start_date,
            cycles.end_date AS end_date
     FROM session_logs
     INNER JOIN cycle_goals
       ON session_logs.cycle_goal_id = cycle_goals.id
     INNER JOIN cycles ON cycle_goals.cycle_id = cycles.id
     WHERE session_logs.id = ?`,
    [sourceSessionId],
  );
}

async function cycleForGoal(
  db: SQLiteDatabase,
  cycleGoalId: string,
): Promise<SourceCycleRow | null> {
  return db.getFirstAsync<SourceCycleRow>(
    `SELECT cycles.id AS cycle_id,
            cycles.start_date AS start_date,
            cycles.end_date AS end_date
     FROM cycle_goals
     INNER JOIN cycles ON cycle_goals.cycle_id = cycles.id
     WHERE cycle_goals.id = ?`,
    [cycleGoalId],
  );
}

function validateSessionDate(
  startedAt: string,
  cycle: SourceCycleRow,
): string {
  const localDate = localDateForSessionInstant(startedAt);
  if (localDate < cycle.start_date || localDate > cycle.end_date) {
    throw new Error("Session date must fall within the source cycle");
  }
  if (localDate > todayLocalDate()) {
    throw new Error("Session date cannot be in the future");
  }
  return localDate;
}

async function insertRevision(
  db: SQLiteDatabase,
  sourceSessionId: string,
  snapshot: Omit<SessionLogRevision, "sequence" | "sourceSessionId">,
): Promise<SessionLogRevision> {
  const result = await db.runAsync(
    `INSERT INTO session_log_revisions (
      source_session_id, cycle_goal_id, local_date, started_at,
      duration_minutes, tombstone, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [
      sourceSessionId,
      snapshot.cycleGoalId,
      snapshot.localDate,
      snapshot.startedAt,
      snapshot.durationMinutes,
      snapshot.tombstone ? 1 : 0,
      snapshot.createdAt,
    ],
  );

  return {
    sequence: Number(result.lastInsertRowId),
    sourceSessionId,
    ...snapshot,
  };
}

export function createSessionRepository(db: SQLiteDatabase): SessionRepository {
  const repository: SessionRepository = {
    async create(input) {
      validateDuration(input.durationMinutes);
      const createdAt = new Date().toISOString();
      const startedAt = input.startedAt ?? createdAt;
      const cycle = await cycleForGoal(db, input.cycleGoalId);
      if (!cycle) {
        throw new Error(`Cycle goal not found: ${input.cycleGoalId}`);
      }

      const session: SessionLog = {
        id: generateId("log"),
        cycleGoalId: input.cycleGoalId,
        localDate: validateSessionDate(startedAt, cycle),
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

    async correct(sourceSessionId, input) {
      validateDuration(input.durationMinutes);
      let corrected: SessionLog | null = null;

      await db.withTransactionAsync(async () => {
        const sourceCycle = await sourceCycleForSession(db, sourceSessionId);
        if (!sourceCycle) {
          throw new Error(`Session log not found: ${sourceSessionId}`);
        }

        const targetCycle = await cycleForGoal(db, input.cycleGoalId);
        if (!targetCycle) {
          throw new Error(`Cycle goal not found: ${input.cycleGoalId}`);
        }
        if (targetCycle.cycle_id !== sourceCycle.cycle_id) {
          throw new Error("Corrected practice must belong to the source cycle");
        }

        const original = await db.getFirstAsync<SessionLogRow>(
          "SELECT * FROM session_logs WHERE id = ?",
          [sourceSessionId],
        );
        if (!original) {
          throw new Error(`Session log not found: ${sourceSessionId}`);
        }
        const latestRevision =
          await db.getFirstAsync<Pick<SessionLogRevisionRow, "tombstone">>(
            `SELECT tombstone FROM session_log_revisions
             WHERE source_session_id = ?
             ORDER BY sequence DESC
             LIMIT 1`,
            [sourceSessionId],
          );
        if (latestRevision?.tombstone === 1) {
          throw new Error("Cannot correct a deleted session log");
        }

        const localDate = validateSessionDate(input.startedAt, sourceCycle);
        await insertRevision(db, sourceSessionId, {
          cycleGoalId: input.cycleGoalId,
          localDate,
          startedAt: input.startedAt,
          durationMinutes: input.durationMinutes,
          tombstone: false,
          createdAt: new Date().toISOString(),
        });

        corrected = {
          id: sourceSessionId,
          cycleGoalId: input.cycleGoalId,
          localDate,
          startedAt: input.startedAt,
          durationMinutes: input.durationMinutes,
          createdAt: original.created_at,
        };
      });

      if (!corrected) {
        throw new Error(`Unable to correct session log: ${sourceSessionId}`);
      }
      return corrected;
    },

    async listForCycle(cycleId) {
      const rows = await db.getAllAsync<SessionLogRow>(
        `${effectiveSessionSql("source_goal.cycle_id = ?")}
         ORDER BY started_at ASC, id ASC`,
        [cycleId],
      );
      return rows.map(mapSessionLog);
    },

    async listForDay(cycleId, localDate) {
      const rows = await db.getAllAsync<SessionLogRow>(
        `${effectiveSessionSql(
          "source_goal.cycle_id = ? AND COALESCE(latest.local_date, session_logs.local_date) = ?",
        )}
         ORDER BY started_at ASC, id ASC`,
        [cycleId, localDate],
      );
      return rows.map(mapSessionLog);
    },

    async deleteById(sourceSessionId) {
      await db.withTransactionAsync(async () => {
        const effective = await db.getFirstAsync<SessionLogRow>(
          `${effectiveSessionSql("session_logs.id = ?")}`,
          [sourceSessionId],
        );
        if (!effective) {
          const source = await db.getFirstAsync<{ id: string }>(
            "SELECT id FROM session_logs WHERE id = ?",
            [sourceSessionId],
          );
          if (!source) {
            throw new Error(`Session log not found: ${sourceSessionId}`);
          }
          return;
        }

        await insertRevision(db, sourceSessionId, {
          cycleGoalId: effective.cycle_goal_id,
          localDate: effective.local_date,
          startedAt: effective.started_at,
          durationMinutes: effective.duration_minutes,
          tombstone: true,
          createdAt: new Date().toISOString(),
        });
      });
    },

    async getAuditHistory(sourceSessionId) {
      const originalRow = await db.getFirstAsync<SessionLogRow>(
        "SELECT * FROM session_logs WHERE id = ?",
        [sourceSessionId],
      );
      if (!originalRow) {
        return null;
      }

      const revisionRows = await db.getAllAsync<SessionLogRevisionRow>(
        `SELECT * FROM session_log_revisions
         WHERE source_session_id = ?
         ORDER BY sequence ASC`,
        [sourceSessionId],
      );

      return {
        original: mapSessionLog(originalRow),
        revisions: revisionRows.map(mapSessionLogRevision),
      };
    },
  };

  return repository;
}
