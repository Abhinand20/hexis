export const LIVE_TABLES = [
  "cycles",
  "cycle_goals",
  "goal_revisions",
  "session_logs",
  "session_log_revisions",
  "reminder_settings",
  "daily_weights",
  "weight_preferences",
] as const;

export type LiveTable = (typeof LIVE_TABLES)[number];

export const DELETE_ORDER: LiveTable[] = [
  "session_log_revisions",
  "session_logs",
  "goal_revisions",
  "cycle_goals",
  "cycles",
  "reminder_settings",
  "daily_weights",
  "weight_preferences",
];

export const INSERT_ORDER: LiveTable[] = [
  "cycles",
  "cycle_goals",
  "goal_revisions",
  "session_logs",
  "session_log_revisions",
  "reminder_settings",
  "daily_weights",
  "weight_preferences",
];

/**
 * Explicit column lists. `cycle_goals` gained membership columns via ALTER TABLE
 * in V5, so physical order on an upgraded database differs from a fresh
 * CREATE TABLE at the same schema version. `SELECT *` across those two shapes
 * is a latent restore bug.
 */
export const TABLE_COLUMNS: Record<LiveTable, readonly string[]> = {
  cycles: [
    "id",
    "name",
    "start_date",
    "duration_days",
    "end_date",
    "status",
    "created_at",
  ],
  cycle_goals: [
    "id",
    "cycle_id",
    "name",
    "cadence",
    "weekly_target_count",
    "expected_duration_minutes",
    "created_at",
    "active_from_date",
    "inactive_from_date",
  ],
  goal_revisions: [
    "id",
    "cycle_goal_id",
    "effective_date",
    "name",
    "cadence",
    "weekly_target_count",
    "expected_duration_minutes",
    "created_at",
  ],
  session_logs: [
    "id",
    "cycle_goal_id",
    "local_date",
    "started_at",
    "duration_minutes",
    "created_at",
  ],
  session_log_revisions: [
    "sequence",
    "source_session_id",
    "cycle_goal_id",
    "local_date",
    "started_at",
    "duration_minutes",
    "tombstone",
    "created_at",
  ],
  reminder_settings: [
    "id",
    "enabled",
    "hour",
    "minute",
    "notification_identifier",
  ],
  daily_weights: [
    "id",
    "local_date",
    "weight_grams",
    "created_at",
    "updated_at",
  ],
  weight_preferences: ["id", "unit"],
};

export function insertSelectSql(table: LiveTable): string {
  const columns = TABLE_COLUMNS[table].join(", ");
  return `INSERT INTO main.${table} (${columns}) SELECT ${columns} FROM src.${table}`;
}
