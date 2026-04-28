export const DB_SCHEMA_VERSION = 2

export interface DbMigration {
  version: number
  statements: string[]
}

export const DB_MIGRATIONS: DbMigration[] = [
  {
    version: 1,
    statements: [
      `CREATE TABLE IF NOT EXISTS app_meta (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL,
        updated_at INTEGER NOT NULL
      )`,
      `CREATE TABLE IF NOT EXISTS settings (
        key TEXT PRIMARY KEY,
        value_json TEXT NOT NULL,
        updated_at INTEGER NOT NULL
      )`,
      `CREATE TABLE IF NOT EXISTS provider_configs (
        id TEXT PRIMARY KEY,
        value_json TEXT NOT NULL,
        updated_at INTEGER NOT NULL
      )`,
      `CREATE TABLE IF NOT EXISTS models (
        id TEXT PRIMARY KEY,
        provider_id TEXT,
        value_json TEXT NOT NULL,
        enabled INTEGER NOT NULL DEFAULT 1,
        updated_at INTEGER NOT NULL
      )`,
      `CREATE TABLE IF NOT EXISTS sessions (
        id TEXT PRIMARY KEY,
        title TEXT NOT NULL,
        agent_id TEXT,
        model_id TEXT,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL
      )`,
      `CREATE TABLE IF NOT EXISTS messages (
        id TEXT PRIMARY KEY,
        session_id TEXT NOT NULL,
        role TEXT NOT NULL,
        content TEXT NOT NULL,
        value_json TEXT NOT NULL,
        timestamp INTEGER NOT NULL,
        FOREIGN KEY (session_id) REFERENCES sessions(id) ON DELETE CASCADE
      )`,
      `CREATE INDEX IF NOT EXISTS idx_messages_session_timestamp ON messages(session_id, timestamp)`,
      `CREATE TABLE IF NOT EXISTS agents (
        id TEXT PRIMARY KEY,
        value_json TEXT NOT NULL,
        enabled INTEGER NOT NULL DEFAULT 1,
        updated_at INTEGER NOT NULL
      )`,
      `CREATE TABLE IF NOT EXISTS skills (
        id TEXT PRIMARY KEY,
        name TEXT,
        source TEXT,
        value_json TEXT NOT NULL,
        content TEXT,
        enabled INTEGER NOT NULL DEFAULT 1,
        updated_at INTEGER NOT NULL
      )`,
      `CREATE TABLE IF NOT EXISTS channels (
        id TEXT PRIMARY KEY,
        platform TEXT,
        value_json TEXT NOT NULL,
        enabled INTEGER NOT NULL DEFAULT 1,
        updated_at INTEGER NOT NULL
      )`,
      `CREATE TABLE IF NOT EXISTS channel_messages (
        id TEXT PRIMARY KEY,
        channel_id TEXT,
        value_json TEXT NOT NULL,
        timestamp INTEGER NOT NULL,
        updated_at INTEGER NOT NULL
      )`,
      `CREATE INDEX IF NOT EXISTS idx_channel_messages_channel_timestamp ON channel_messages(channel_id, timestamp)`,
      `CREATE TABLE IF NOT EXISTS mcp_servers (
        id TEXT PRIMARY KEY,
        value_json TEXT NOT NULL,
        enabled INTEGER NOT NULL DEFAULT 1,
        updated_at INTEGER NOT NULL
      )`,
      `CREATE TABLE IF NOT EXISTS timers (
        id TEXT PRIMARY KEY,
        value_json TEXT NOT NULL,
        enabled INTEGER NOT NULL DEFAULT 1,
        next_run INTEGER,
        updated_at INTEGER NOT NULL
      )`,
      `CREATE INDEX IF NOT EXISTS idx_timers_next_run ON timers(next_run)`,
      `CREATE TABLE IF NOT EXISTS pipelines (
        id TEXT PRIMARY KEY,
        value_json TEXT NOT NULL,
        updated_at INTEGER NOT NULL
      )`,
      `CREATE TABLE IF NOT EXISTS pipeline_executions (
        id TEXT PRIMARY KEY,
        pipeline_id TEXT,
        value_json TEXT NOT NULL,
        started_at INTEGER,
        updated_at INTEGER NOT NULL
      )`,
      `CREATE INDEX IF NOT EXISTS idx_pipeline_executions_pipeline_started ON pipeline_executions(pipeline_id, started_at)`,
      `CREATE TABLE IF NOT EXISTS memories (
        id TEXT PRIMARY KEY,
        owner_type TEXT,
        owner_id TEXT,
        scope TEXT,
        value_json TEXT NOT NULL,
        created_at INTEGER,
        updated_at INTEGER NOT NULL
      )`,
      `CREATE INDEX IF NOT EXISTS idx_memories_owner ON memories(owner_type, owner_id, scope, created_at)`,
    ],
  },
  {
    version: 2,
    statements: [
      `CREATE TABLE IF NOT EXISTS app_state (
        key TEXT PRIMARY KEY,
        value_json TEXT NOT NULL,
        version INTEGER NOT NULL DEFAULT 0,
        updated_at INTEGER NOT NULL
      )`,
      `CREATE INDEX IF NOT EXISTS idx_app_state_updated_at ON app_state(updated_at)`,
      `CREATE TABLE IF NOT EXISTS timer_executions (
        id TEXT PRIMARY KEY,
        timer_id TEXT,
        value_json TEXT NOT NULL,
        fired_at INTEGER,
        updated_at INTEGER NOT NULL
      )`,
      `CREATE INDEX IF NOT EXISTS idx_timer_executions_timer_fired ON timer_executions(timer_id, fired_at)`,
    ],
  },
]