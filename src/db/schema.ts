export const SCHEMA_V1: string[] = [
  `CREATE TABLE cycles (
  id TEXT PRIMARY KEY NOT NULL,
  name TEXT NOT NULL,
  start_date TEXT NOT NULL,
  duration_days INTEGER NOT NULL CHECK (duration_days IN (30, 60, 90)),
  end_date TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('active', 'completed', 'ended_early')),
  created_at TEXT NOT NULL
)`,
  `CREATE TABLE cycle_goals (
  id TEXT PRIMARY KEY NOT NULL,
  cycle_id TEXT NOT NULL REFERENCES cycles(id),
  name TEXT NOT NULL,
  cadence TEXT NOT NULL CHECK (cadence IN ('daily', 'weekly')),
  weekly_target_count INTEGER NOT NULL CHECK (weekly_target_count > 0),
  expected_duration_minutes INTEGER,
  created_at TEXT NOT NULL
)`,
  `CREATE TABLE goal_revisions (
  id TEXT PRIMARY KEY NOT NULL,
  cycle_goal_id TEXT NOT NULL REFERENCES cycle_goals(id),
  effective_date TEXT NOT NULL,
  name TEXT NOT NULL,
  cadence TEXT NOT NULL CHECK (cadence IN ('daily', 'weekly')),
  weekly_target_count INTEGER NOT NULL CHECK (weekly_target_count > 0),
  expected_duration_minutes INTEGER,
  created_at TEXT NOT NULL
)`,
  `CREATE TABLE session_logs (
  id TEXT PRIMARY KEY NOT NULL,
  cycle_goal_id TEXT NOT NULL REFERENCES cycle_goals(id),
  local_date TEXT NOT NULL,
  duration_minutes INTEGER CHECK (duration_minutes IS NULL OR duration_minutes > 0),
  created_at TEXT NOT NULL
)`,
];

export const SCHEMA_V2: string[] = [
  `CREATE TABLE reminder_settings (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  enabled INTEGER NOT NULL,
  hour INTEGER NOT NULL CHECK (hour >= 0 AND hour <= 23),
  minute INTEGER NOT NULL CHECK (minute >= 0 AND minute <= 59),
  notification_identifier TEXT
  )`,
];

export const SCHEMA_V3: string[] = [
  `CREATE TABLE session_logs_v3 (
  id TEXT PRIMARY KEY NOT NULL,
  cycle_goal_id TEXT NOT NULL REFERENCES cycle_goals(id),
  local_date TEXT NOT NULL,
  started_at TEXT NOT NULL,
  duration_minutes INTEGER CHECK (duration_minutes IS NULL OR duration_minutes > 0),
  created_at TEXT NOT NULL
)`,
  `INSERT INTO session_logs_v3 (
  id, cycle_goal_id, local_date, started_at, duration_minutes, created_at
)
SELECT
  id, cycle_goal_id, local_date, created_at, duration_minutes, created_at
FROM session_logs`,
  `DROP TABLE session_logs`,
  `ALTER TABLE session_logs_v3 RENAME TO session_logs`,
];

export const SCHEMA_V4: string[] = [
  `CREATE TABLE session_log_revisions (
  sequence INTEGER PRIMARY KEY AUTOINCREMENT,
  source_session_id TEXT NOT NULL REFERENCES session_logs(id),
  cycle_goal_id TEXT NOT NULL REFERENCES cycle_goals(id),
  local_date TEXT NOT NULL,
  started_at TEXT NOT NULL,
  duration_minutes INTEGER CHECK (duration_minutes IS NULL OR duration_minutes > 0),
  tombstone INTEGER NOT NULL CHECK (tombstone IN (0, 1)),
  created_at TEXT NOT NULL
)`,
  `CREATE INDEX session_log_revisions_source_sequence
ON session_log_revisions(source_session_id, sequence DESC)`,
];

export const SCHEMA_V5: string[] = [
  `ALTER TABLE cycle_goals
ADD COLUMN active_from_date TEXT NOT NULL DEFAULT ''`,
  `ALTER TABLE cycle_goals
ADD COLUMN inactive_from_date TEXT
CHECK (inactive_from_date IS NULL OR inactive_from_date > active_from_date)`,
  `UPDATE cycle_goals
SET active_from_date = (
  SELECT cycles.start_date
  FROM cycles
  WHERE cycles.id = cycle_goals.cycle_id
)`,
  `CREATE INDEX cycle_goals_cycle_membership
ON cycle_goals(cycle_id, active_from_date, inactive_from_date)`,
];
