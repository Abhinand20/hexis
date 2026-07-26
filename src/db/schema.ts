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
