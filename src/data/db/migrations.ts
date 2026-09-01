export const runtimeMigrations = [
  {
    id: 1,
    statements: [
      `
      CREATE TABLE IF NOT EXISTS app_meta (
        key TEXT PRIMARY KEY NOT NULL,
        value TEXT NOT NULL
      )
      `,
      `
      CREATE TABLE IF NOT EXISTS chats (
        id TEXT PRIMARY KEY NOT NULL,
        title TEXT NOT NULL,
        chatbot_id TEXT NOT NULL,
        summary TEXT NOT NULL DEFAULT '',
        updated_at INTEGER NOT NULL
      )
      `,
      `
      CREATE TABLE IF NOT EXISTS chat_messages (
        id TEXT PRIMARY KEY NOT NULL,
        chat_id TEXT NOT NULL,
        role TEXT NOT NULL,
        content TEXT NOT NULL,
        created_at INTEGER NOT NULL
      )
      `,
      `
      CREATE TABLE IF NOT EXISTS workflows (
        id TEXT PRIMARY KEY NOT NULL,
        title TEXT NOT NULL,
        summary TEXT NOT NULL DEFAULT '',
        updated_at INTEGER NOT NULL
      )
      `,
      `
      CREATE TABLE IF NOT EXISTS workflow_versions (
        id TEXT PRIMARY KEY NOT NULL,
        workflow_id TEXT NOT NULL,
        major INTEGER NOT NULL,
        minor INTEGER NOT NULL,
        is_release INTEGER NOT NULL DEFAULT 0,
        definition_json TEXT NOT NULL,
        created_at INTEGER NOT NULL
      )
      `,
      `
      CREATE TABLE IF NOT EXISTS skills (
        id TEXT PRIMARY KEY NOT NULL,
        title TEXT NOT NULL,
        summary TEXT NOT NULL DEFAULT '',
        updated_at INTEGER NOT NULL
      )
      `,
      `
      CREATE TABLE IF NOT EXISTS skill_versions (
        id TEXT PRIMARY KEY NOT NULL,
        skill_id TEXT NOT NULL,
        major INTEGER NOT NULL,
        minor INTEGER NOT NULL,
        is_release INTEGER NOT NULL DEFAULT 0,
        files_json TEXT NOT NULL,
        created_at INTEGER NOT NULL
      )
      `,
      `
      CREATE TABLE IF NOT EXISTS documents (
        id TEXT PRIMARY KEY NOT NULL,
        title TEXT NOT NULL,
        summary TEXT NOT NULL DEFAULT '',
        updated_at INTEGER NOT NULL
      )
      `,
      `
      CREATE TABLE IF NOT EXISTS document_versions (
        id TEXT PRIMARY KEY NOT NULL,
        document_id TEXT NOT NULL,
        major INTEGER NOT NULL,
        minor INTEGER NOT NULL,
        is_release INTEGER NOT NULL DEFAULT 0,
        structure_json TEXT NOT NULL,
        graph_json TEXT NOT NULL,
        settings_json TEXT NOT NULL,
        created_at INTEGER NOT NULL
      )
      `,
    ],
  },
  {
    id: 2,
    statements: [
      `
      CREATE TABLE IF NOT EXISTS agents (
        id TEXT PRIMARY KEY NOT NULL,
        title TEXT NOT NULL,
        kind TEXT NOT NULL,
        summary TEXT NOT NULL DEFAULT '',
        updated_at INTEGER NOT NULL
      )
      `,
      `
      CREATE TABLE IF NOT EXISTS providers (
        id TEXT PRIMARY KEY NOT NULL,
        title TEXT NOT NULL,
        provider_type TEXT NOT NULL,
        updated_at INTEGER NOT NULL
      )
      `,
      `
      CREATE TABLE IF NOT EXISTS integrations (
        id TEXT PRIMARY KEY NOT NULL,
        title TEXT NOT NULL,
        kind TEXT NOT NULL,
        endpoint TEXT NOT NULL DEFAULT '',
        updated_at INTEGER NOT NULL
      )
      `,
      `
      CREATE TABLE IF NOT EXISTS schedulers (
        id TEXT PRIMARY KEY NOT NULL,
        title TEXT NOT NULL,
        description TEXT NOT NULL DEFAULT '',
        enabled INTEGER NOT NULL DEFAULT 1,
        schedule TEXT NOT NULL DEFAULT '',
        time_zone TEXT NOT NULL DEFAULT 'Asia/Shanghai',
        target_type TEXT NOT NULL DEFAULT 'workflow',
        target_id TEXT NOT NULL DEFAULT '',
        target_name TEXT NOT NULL DEFAULT '',
        missed_run_policy TEXT NOT NULL DEFAULT 'skip',
        retry_limit INTEGER NOT NULL DEFAULT 0,
        retry_backoff_seconds INTEGER NOT NULL DEFAULT 300,
        input_payload_json TEXT NOT NULL DEFAULT '{}',
        updated_at INTEGER NOT NULL
      )
      `,
      `
      CREATE TABLE IF NOT EXISTS channels (
        id TEXT PRIMARY KEY NOT NULL,
        title TEXT NOT NULL,
        platform TEXT NOT NULL,
        updated_at INTEGER NOT NULL
      )
      `,
      `
      ALTER TABLE skills ADD COLUMN source TEXT NOT NULL DEFAULT 'custom'
      `,
    ],
  },
  {
    id: 3,
    statements: [
      `
      CREATE TABLE IF NOT EXISTS workflow_invocations (
        id TEXT PRIMARY KEY NOT NULL,
        workflow_id TEXT NOT NULL,
        version_id TEXT NOT NULL,
        status TEXT NOT NULL,
        trigger TEXT NOT NULL,
        input_json TEXT NOT NULL,
        output_json TEXT NOT NULL,
        created_at INTEGER NOT NULL
      )
      `,
      `
      CREATE TABLE IF NOT EXISTS integration_versions (
        id TEXT PRIMARY KEY NOT NULL,
        integration_id TEXT NOT NULL,
        major INTEGER NOT NULL,
        minor INTEGER NOT NULL,
        is_release INTEGER NOT NULL DEFAULT 0,
        config_json TEXT NOT NULL,
        created_at INTEGER NOT NULL
      )
      `,
    ],
  },
  {
    id: 4,
    statements: [
      `
      ALTER TABLE workflow_invocations ADD COLUMN trace_json TEXT NOT NULL DEFAULT '[]'
      `,
      `
      CREATE TABLE IF NOT EXISTS integration_executions (
        id TEXT PRIMARY KEY NOT NULL,
        integration_id TEXT NOT NULL,
        version_id TEXT NOT NULL,
        status TEXT NOT NULL,
        input_json TEXT NOT NULL,
        output_json TEXT NOT NULL,
        created_at INTEGER NOT NULL
      )
      `,
    ],
  },
  {
    id: 5,
    statements: [
      `ALTER TABLE providers ADD COLUMN base_url TEXT NOT NULL DEFAULT ''`,
      `ALTER TABLE providers ADD COLUMN api_key TEXT NOT NULL DEFAULT ''`,
      `ALTER TABLE providers ADD COLUMN models_json TEXT NOT NULL DEFAULT '[]'`,
      `ALTER TABLE providers ADD COLUMN enabled INTEGER NOT NULL DEFAULT 1`,
    ],
  },
  {
    id: 6,
    statements: [
      `
      CREATE TABLE IF NOT EXISTS agent_versions (
        id TEXT PRIMARY KEY NOT NULL,
        agent_id TEXT NOT NULL,
        major INTEGER NOT NULL,
        minor INTEGER NOT NULL,
        is_release INTEGER NOT NULL DEFAULT 0,
        config_json TEXT NOT NULL,
        created_at INTEGER NOT NULL
      )
      `,
    ],
  },
  {
    id: 7,
    statements: [
      `ALTER TABLE schedulers ADD COLUMN description TEXT NOT NULL DEFAULT ''`,
      `ALTER TABLE schedulers ADD COLUMN enabled INTEGER NOT NULL DEFAULT 1`,
      `ALTER TABLE schedulers ADD COLUMN time_zone TEXT NOT NULL DEFAULT 'Asia/Shanghai'`,
      `ALTER TABLE schedulers ADD COLUMN target_type TEXT NOT NULL DEFAULT 'workflow'`,
      `ALTER TABLE schedulers ADD COLUMN target_id TEXT NOT NULL DEFAULT ''`,
      `ALTER TABLE schedulers ADD COLUMN target_name TEXT NOT NULL DEFAULT ''`,
      `ALTER TABLE schedulers ADD COLUMN missed_run_policy TEXT NOT NULL DEFAULT 'skip'`,
      `ALTER TABLE schedulers ADD COLUMN retry_limit INTEGER NOT NULL DEFAULT 0`,
      `ALTER TABLE schedulers ADD COLUMN retry_backoff_seconds INTEGER NOT NULL DEFAULT 300`,
      `ALTER TABLE schedulers ADD COLUMN input_payload_json TEXT NOT NULL DEFAULT '{}'`,
    ],
    ignoreErrorsMatching: [
      /duplicate column name: description/i,
      /duplicate column name: enabled/i,
      /duplicate column name: time_zone/i,
      /duplicate column name: target_type/i,
      /duplicate column name: target_id/i,
      /duplicate column name: target_name/i,
      /duplicate column name: missed_run_policy/i,
      /duplicate column name: retry_limit/i,
      /duplicate column name: retry_backoff_seconds/i,
      /duplicate column name: input_payload_json/i,
    ],
  },
  {
    id: 8,
    statements: [
      `ALTER TABLE schedulers ADD COLUMN description TEXT NOT NULL DEFAULT ''`,
      `ALTER TABLE schedulers ADD COLUMN enabled INTEGER NOT NULL DEFAULT 1`,
      `ALTER TABLE schedulers ADD COLUMN time_zone TEXT NOT NULL DEFAULT 'Asia/Shanghai'`,
      `ALTER TABLE schedulers ADD COLUMN target_type TEXT NOT NULL DEFAULT 'workflow'`,
      `ALTER TABLE schedulers ADD COLUMN target_id TEXT NOT NULL DEFAULT ''`,
      `ALTER TABLE schedulers ADD COLUMN target_name TEXT NOT NULL DEFAULT ''`,
      `ALTER TABLE schedulers ADD COLUMN missed_run_policy TEXT NOT NULL DEFAULT 'skip'`,
      `ALTER TABLE schedulers ADD COLUMN retry_limit INTEGER NOT NULL DEFAULT 0`,
      `ALTER TABLE schedulers ADD COLUMN retry_backoff_seconds INTEGER NOT NULL DEFAULT 300`,
      `ALTER TABLE schedulers ADD COLUMN input_payload_json TEXT NOT NULL DEFAULT '{}'`,
    ],
    ignoreErrorsMatching: [
      /duplicate column name: description/i,
      /duplicate column name: enabled/i,
      /duplicate column name: time_zone/i,
      /duplicate column name: target_type/i,
      /duplicate column name: target_id/i,
      /duplicate column name: target_name/i,
      /duplicate column name: missed_run_policy/i,
      /duplicate column name: retry_limit/i,
      /duplicate column name: retry_backoff_seconds/i,
      /duplicate column name: input_payload_json/i,
    ],
  },
]