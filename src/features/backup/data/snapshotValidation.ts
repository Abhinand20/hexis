import type { SQLiteDatabase } from "expo-sqlite";

import { runMigrations, SUPPORTED_SCHEMA_VERSION } from "../../../db/migrations";
import { LIVE_TABLES } from "./tables";

const LOCAL_DATE_GLOB = "[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]";

export type SnapshotPreview = {
  createdAt: string | null;
  appVersion: string | null;
  schemaVersion: number;
  cycleCount: number;
  sessionCount: number;
  correctionCount: number;
  hasActiveCycle: boolean;
};

export type SnapshotProblem =
  | { kind: "not_a_database" }
  | { kind: "unsupported_schema_version"; found: number; supported: number }
  | { kind: "missing_table"; table: string }
  | { kind: "integrity"; detail: string }
  | { kind: "foreign_key"; detail: string }
  | { kind: "invariant"; detail: string }
  | { kind: "too_large"; sizeBytes: number };

export async function validateSnapshot(
  stagingDb: SQLiteDatabase,
): Promise<{ preview: SnapshotPreview; problems: SnapshotProblem[] }> {
  const problems: SnapshotProblem[] = [];

  if (!(await looksLikeSqlite(stagingDb))) {
    return {
      preview: emptyPreview(0),
      problems: [{ kind: "not_a_database" }],
    };
  }

  const schemaVersion = await readUserVersion(stagingDb);
  if (schemaVersion > SUPPORTED_SCHEMA_VERSION) {
    return {
      preview: emptyPreview(schemaVersion),
      problems: [
        {
          kind: "unsupported_schema_version",
          found: schemaVersion,
          supported: SUPPORTED_SCHEMA_VERSION,
        },
      ],
    };
  }

  if (schemaVersion < SUPPORTED_SCHEMA_VERSION) {
    await runMigrations(stagingDb);
  }

  const tables = await listUserTables(stagingDb);
  for (const table of LIVE_TABLES) {
    if (!tables.has(table)) {
      problems.push({ kind: "missing_table", table });
    }
  }

  const integrity = await stagingDb.getFirstAsync<{ integrity_check: string }>(
    "PRAGMA integrity_check",
  );
  if (integrity?.integrity_check !== "ok") {
    problems.push({
      kind: "integrity",
      detail: integrity?.integrity_check ?? "integrity_check produced no row",
    });
  }

  const foreignKeyRows = await stagingDb.getAllAsync<{
    table: string;
    rowid: number;
    parent: string;
    fkid: number;
  }>("PRAGMA foreign_key_check");
  if (foreignKeyRows.length > 0) {
    const first = foreignKeyRows[0];
    problems.push({
      kind: "foreign_key",
      detail: `${first.table} row ${first.rowid} references missing ${first.parent}`,
    });
  }

  await collectInvariantProblems(stagingDb, problems, tables);
  await collectReferentialProblems(stagingDb, problems, tables);

  const preview = await readPreview(stagingDb);
  return { preview, problems };
}

export function describeSnapshotProblem(problem: SnapshotProblem): string {
  switch (problem.kind) {
    case "not_a_database":
      return "This file is not a Hexis backup.";
    case "unsupported_schema_version":
      return `This backup was made with a newer Hexis (schema ${problem.found}). This version supports schema ${problem.supported}.`;
    case "missing_table":
      return `This backup is missing the ${problem.table} table.`;
    case "integrity":
      return `SQLite rejected this file (${problem.detail}).`;
    case "foreign_key":
      return `This backup has a broken reference: ${problem.detail}.`;
    case "invariant":
      return problem.detail;
    case "too_large":
      return `This file is ${(problem.sizeBytes / (1024 * 1024)).toFixed(1)} MB. Hexis rejects backups larger than 50 MB.`;
  }
}

async function looksLikeSqlite(db: SQLiteDatabase): Promise<boolean> {
  try {
    const row = await db.getFirstAsync<{ count: number }>(
      "SELECT COUNT(*) AS count FROM sqlite_master",
    );
    return (row?.count ?? 0) > 0;
  } catch {
    return false;
  }
}

async function readUserVersion(db: SQLiteDatabase): Promise<number> {
  const row = await db.getFirstAsync<{ user_version: number }>(
    "PRAGMA user_version",
  );
  return row?.user_version ?? 0;
}

async function listUserTables(db: SQLiteDatabase): Promise<Set<string>> {
  const rows = await db.getAllAsync<{ name: string }>(
    "SELECT name FROM sqlite_master WHERE type = 'table'",
  );
  return new Set(rows.map((row) => row.name));
}

async function collectInvariantProblems(
  db: SQLiteDatabase,
  problems: SnapshotProblem[],
  tables: Set<string>,
): Promise<void> {
  if (tables.has("cycles")) {
    const active = await count(
      db,
      "SELECT COUNT(*) AS count FROM cycles WHERE status = 'active'",
    );
    if (active > 1) {
      problems.push({
        kind: "invariant",
        detail: "A backup can contain at most one active cycle.",
      });
    }

    const badStatus = await count(
      db,
      `SELECT COUNT(*) AS count FROM cycles
       WHERE status NOT IN ('active', 'completed', 'ended_early')`,
    );
    if (badStatus > 0) {
      problems.push({
        kind: "invariant",
        detail: "A cycle has a status Hexis does not recognize.",
      });
    }

    const badDuration = await count(
      db,
      "SELECT COUNT(*) AS count FROM cycles WHERE duration_days NOT IN (30, 60, 90)",
    );
    if (badDuration > 0) {
      problems.push({
        kind: "invariant",
        detail: "A cycle uses a duration other than 30, 60 or 90 days.",
      });
    }

    const badRange = await count(
      db,
      "SELECT COUNT(*) AS count FROM cycles WHERE end_date < start_date",
    );
    if (badRange > 0) {
      problems.push({
        kind: "invariant",
        detail: "A cycle ends before it starts.",
      });
    }

    await rejectBadDates(
      db,
      problems,
      "cycles",
      ["start_date", "end_date"],
    );
  }

  if (tables.has("cycle_goals")) {
    const emptyMembership = await count(
      db,
      "SELECT COUNT(*) AS count FROM cycle_goals WHERE active_from_date = ''",
    );
    if (emptyMembership > 0) {
      problems.push({
        kind: "invariant",
        detail:
          "A practice has an empty active-from date. Hexis no longer accepts that legacy value.",
      });
    }

    await rejectBadDates(db, problems, "cycle_goals", ["active_from_date"]);

    const badInactive = await count(
      db,
      `SELECT COUNT(*) AS count FROM cycle_goals
       WHERE inactive_from_date IS NOT NULL
         AND (inactive_from_date NOT GLOB '${LOCAL_DATE_GLOB}'
              OR inactive_from_date <= active_from_date)`,
    );
    if (badInactive > 0) {
      problems.push({
        kind: "invariant",
        detail:
          "A practice leaves the cycle on a date that is not after it joined.",
      });
    }

    const badTargets = await count(
      db,
      "SELECT COUNT(*) AS count FROM cycle_goals WHERE weekly_target_count <= 0",
    );
    if (badTargets > 0) {
      problems.push({
        kind: "invariant",
        detail: "A practice has a weekly target that is not a positive number.",
      });
    }
  }

  if (tables.has("goal_revisions")) {
    await rejectBadDates(db, problems, "goal_revisions", ["effective_date"]);
    const badTargets = await count(
      db,
      "SELECT COUNT(*) AS count FROM goal_revisions WHERE weekly_target_count <= 0",
    );
    if (badTargets > 0) {
      problems.push({
        kind: "invariant",
        detail: "A practice revision has a weekly target that is not a positive number.",
      });
    }
  }

  if (tables.has("session_logs")) {
    await rejectBadDates(db, problems, "session_logs", ["local_date"]);
    const badDuration = await count(
      db,
      `SELECT COUNT(*) AS count FROM session_logs
       WHERE duration_minutes IS NOT NULL AND duration_minutes <= 0`,
    );
    if (badDuration > 0) {
      problems.push({
        kind: "invariant",
        detail: "A session duration must be empty or a positive number of minutes.",
      });
    }
  }

  if (tables.has("session_log_revisions")) {
    await rejectBadDates(db, problems, "session_log_revisions", ["local_date"]);
    const badDuration = await count(
      db,
      `SELECT COUNT(*) AS count FROM session_log_revisions
       WHERE duration_minutes IS NOT NULL AND duration_minutes <= 0`,
    );
    if (badDuration > 0) {
      problems.push({
        kind: "invariant",
        detail: "A correction duration must be empty or a positive number of minutes.",
      });
    }
    const badTombstone = await count(
      db,
      "SELECT COUNT(*) AS count FROM session_log_revisions WHERE tombstone NOT IN (0, 1)",
    );
    if (badTombstone > 0) {
      problems.push({
        kind: "invariant",
        detail: "A correction tombstone must be 0 or 1.",
      });
    }
  }

  if (tables.has("reminder_settings")) {
    const reminderCount = await count(
      db,
      "SELECT COUNT(*) AS count FROM reminder_settings",
    );
    if (reminderCount > 1) {
      problems.push({
        kind: "invariant",
        detail: "Reminder settings must be a single row.",
      });
    }
    const badRow = await count(
      db,
      `SELECT COUNT(*) AS count FROM reminder_settings
       WHERE id != 1 OR hour < 0 OR hour > 23 OR minute < 0 OR minute > 59`,
    );
    if (badRow > 0) {
      problems.push({
        kind: "invariant",
        detail: "Reminder settings are out of range.",
      });
    }
  }
}

async function collectReferentialProblems(
  db: SQLiteDatabase,
  problems: SnapshotProblem[],
  tables: Set<string>,
): Promise<void> {
  const checks: { sql: string; table: string; parent: string }[] = [];
  if (tables.has("cycle_goals") && tables.has("cycles")) {
    checks.push({
      table: "cycle_goals",
      parent: "cycles",
      sql: `SELECT COUNT(*) AS count FROM cycle_goals
            WHERE cycle_id NOT IN (SELECT id FROM cycles)`,
    });
  }
  if (tables.has("goal_revisions") && tables.has("cycle_goals")) {
    checks.push({
      table: "goal_revisions",
      parent: "cycle_goals",
      sql: `SELECT COUNT(*) AS count FROM goal_revisions
            WHERE cycle_goal_id NOT IN (SELECT id FROM cycle_goals)`,
    });
  }
  if (tables.has("session_logs") && tables.has("cycle_goals")) {
    checks.push({
      table: "session_logs",
      parent: "cycle_goals",
      sql: `SELECT COUNT(*) AS count FROM session_logs
            WHERE cycle_goal_id NOT IN (SELECT id FROM cycle_goals)`,
    });
  }
  if (tables.has("session_log_revisions") && tables.has("session_logs")) {
    checks.push({
      table: "session_log_revisions",
      parent: "session_logs",
      sql: `SELECT COUNT(*) AS count FROM session_log_revisions
            WHERE source_session_id NOT IN (SELECT id FROM session_logs)`,
    });
  }
  if (tables.has("session_log_revisions") && tables.has("cycle_goals")) {
    checks.push({
      table: "session_log_revisions",
      parent: "cycle_goals",
      sql: `SELECT COUNT(*) AS count FROM session_log_revisions
            WHERE cycle_goal_id NOT IN (SELECT id FROM cycle_goals)`,
    });
  }

  for (const check of checks) {
    if ((await count(db, check.sql)) > 0) {
      problems.push({
        kind: "invariant",
        detail: `${check.table} has a row that does not match ${check.parent}.`,
      });
    }
  }
}

async function rejectBadDates(
  db: SQLiteDatabase,
  problems: SnapshotProblem[],
  table: string,
  columns: string[],
): Promise<void> {
  for (const column of columns) {
    const bad = await count(
      db,
      `SELECT COUNT(*) AS count FROM ${table} WHERE ${column} NOT GLOB '${LOCAL_DATE_GLOB}'`,
    );
    if (bad > 0) {
      problems.push({
        kind: "invariant",
        detail: `${table}.${column} contains a value that is not a YYYY-MM-DD date.`,
      });
    }
  }
}

async function readPreview(db: SQLiteDatabase): Promise<SnapshotPreview> {
  const schemaVersion = await readUserVersion(db);
  const metadata = await db
    .getFirstAsync<{
      created_at: string;
      app_version: string;
    }>(
      "SELECT created_at, app_version FROM backup_metadata LIMIT 1",
    )
    .catch(() => null);

  const tables = await listUserTables(db);
  const cycleCount = tables.has("cycles")
    ? await count(db, "SELECT COUNT(*) AS count FROM cycles")
    : 0;
  const sessionCount = tables.has("session_logs")
    ? await count(db, "SELECT COUNT(*) AS count FROM session_logs")
    : 0;
  const correctionCount = tables.has("session_log_revisions")
    ? await count(db, "SELECT COUNT(*) AS count FROM session_log_revisions")
    : 0;
  const activeCount = tables.has("cycles")
    ? await count(
        db,
        "SELECT COUNT(*) AS count FROM cycles WHERE status = 'active'",
      )
    : 0;

  return {
    createdAt: metadata?.created_at ?? null,
    appVersion: metadata?.app_version ?? null,
    schemaVersion,
    cycleCount,
    sessionCount,
    correctionCount,
    hasActiveCycle: activeCount > 0,
  };
}

function emptyPreview(schemaVersion: number): SnapshotPreview {
  return {
    createdAt: null,
    appVersion: null,
    schemaVersion,
    cycleCount: 0,
    sessionCount: 0,
    correctionCount: 0,
    hasActiveCycle: false,
  };
}

async function count(db: SQLiteDatabase, sql: string): Promise<number> {
  const row = await db.getFirstAsync<{ count: number }>(sql);
  return row?.count ?? 0;
}
