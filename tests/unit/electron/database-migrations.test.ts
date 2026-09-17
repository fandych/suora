import { describe, expect, it } from "vitest"

import { readMigrationFiles } from "drizzle-orm/migrator"
import { DatabaseSync } from "node:sqlite"

import { resolve } from "node:path"

import { applyMigrations } from "@/electron/infrastructure/db-core"

function createUpgradeableLegacyDatabase() {
  const database = new DatabaseSync(":memory:")
  database.exec(`
    CREATE TABLE __app_migrations (id INTEGER PRIMARY KEY NOT NULL);
    INSERT INTO __app_migrations (id) VALUES (11);

    CREATE TABLE agent_versions (id TEXT PRIMARY KEY NOT NULL, agent_id TEXT NOT NULL);
    CREATE TABLE agents (id TEXT PRIMARY KEY NOT NULL, title TEXT NOT NULL, kind TEXT NOT NULL, summary TEXT DEFAULT '' NOT NULL, updated_at INTEGER NOT NULL);
    CREATE TABLE app_meta (key TEXT PRIMARY KEY NOT NULL, value TEXT NOT NULL);
    CREATE TABLE channels (id TEXT PRIMARY KEY NOT NULL, title TEXT NOT NULL, platform TEXT NOT NULL, updated_at INTEGER NOT NULL);
    CREATE TABLE chat_messages (id TEXT PRIMARY KEY NOT NULL, chat_id TEXT NOT NULL, role TEXT NOT NULL, content TEXT NOT NULL, created_at INTEGER NOT NULL);
    CREATE TABLE chats (id TEXT PRIMARY KEY NOT NULL, title TEXT NOT NULL, chatbot_id TEXT NOT NULL, summary TEXT DEFAULT '' NOT NULL, updated_at INTEGER NOT NULL);
    CREATE TABLE document_versions (id TEXT PRIMARY KEY NOT NULL, document_id TEXT NOT NULL, structure_json TEXT NOT NULL, graph_json TEXT NOT NULL, settings_json TEXT NOT NULL, created_at INTEGER NOT NULL);
    CREATE TABLE documents (id TEXT PRIMARY KEY NOT NULL, title TEXT NOT NULL, summary TEXT DEFAULT '' NOT NULL, updated_at INTEGER NOT NULL);
    CREATE TABLE integration_executions (id TEXT PRIMARY KEY NOT NULL, integration_id TEXT NOT NULL, version_id TEXT NOT NULL, status TEXT NOT NULL, input_json TEXT NOT NULL, output_json TEXT NOT NULL, created_at INTEGER NOT NULL);
    CREATE TABLE integration_versions (id TEXT PRIMARY KEY NOT NULL, integration_id TEXT NOT NULL, major INTEGER NOT NULL, minor INTEGER NOT NULL, is_release INTEGER DEFAULT false NOT NULL, config_json TEXT NOT NULL, created_at INTEGER NOT NULL);
    CREATE TABLE integrations (id TEXT PRIMARY KEY NOT NULL, title TEXT NOT NULL, kind TEXT NOT NULL, endpoint TEXT DEFAULT '' NOT NULL, updated_at INTEGER NOT NULL);
    CREATE TABLE providers (id TEXT PRIMARY KEY NOT NULL, title TEXT NOT NULL, provider_type TEXT NOT NULL, base_url TEXT NOT NULL, api_key TEXT NOT NULL, models_json TEXT NOT NULL, enabled INTEGER DEFAULT true NOT NULL, updated_at INTEGER NOT NULL);
    CREATE TABLE schedulers (id TEXT PRIMARY KEY NOT NULL, title TEXT NOT NULL, description TEXT DEFAULT '' NOT NULL, enabled INTEGER DEFAULT true NOT NULL, schedule TEXT NOT NULL, time_zone TEXT NOT NULL, target_type TEXT NOT NULL, target_id TEXT NOT NULL, target_name TEXT NOT NULL, missed_run_policy TEXT NOT NULL, retry_limit INTEGER NOT NULL, retry_backoff_seconds INTEGER NOT NULL, input_payload_json TEXT NOT NULL, updated_at INTEGER NOT NULL);
    CREATE TABLE skill_versions (id TEXT PRIMARY KEY NOT NULL, skill_id TEXT NOT NULL, major INTEGER NOT NULL, minor INTEGER NOT NULL, is_release INTEGER DEFAULT false NOT NULL, files_json TEXT NOT NULL, created_at INTEGER NOT NULL);
    CREATE TABLE skills (id TEXT PRIMARY KEY NOT NULL, title TEXT NOT NULL, source TEXT DEFAULT 'custom' NOT NULL, summary TEXT DEFAULT '' NOT NULL, updated_at INTEGER NOT NULL);
    CREATE TABLE workflow_invocations (id TEXT PRIMARY KEY NOT NULL, workflow_id TEXT NOT NULL, version_id TEXT NOT NULL, status TEXT NOT NULL, trigger TEXT NOT NULL, input_json TEXT, output_json TEXT, trace_json TEXT, created_at INTEGER NOT NULL);
    CREATE TABLE workflow_versions (id TEXT PRIMARY KEY NOT NULL, workflow_id TEXT NOT NULL, major INTEGER NOT NULL, minor INTEGER NOT NULL, is_release INTEGER DEFAULT false NOT NULL, definition_json TEXT NOT NULL, created_at INTEGER NOT NULL);
    CREATE TABLE workflows (id TEXT PRIMARY KEY NOT NULL, title TEXT NOT NULL, summary TEXT DEFAULT '' NOT NULL, updated_at INTEGER NOT NULL);

    INSERT INTO documents (id, title, summary, updated_at) VALUES ('doc-1', 'Doc', '', 1);
    INSERT INTO integrations (id, title, kind, endpoint, updated_at) VALUES ('integration-1', 'HTTP', 'http', '', 1);
    INSERT INTO providers (id, title, provider_type, base_url, api_key, models_json, enabled, updated_at) VALUES ('provider-1', 'Bailian', 'bailian', 'https://dashscope.aliyuncs.com/compatible-mode/v1', '', '[]', 1, 1);
    INSERT INTO chats (id, title, chatbot_id, summary, updated_at) VALUES ('chat-1', 'Chat', 'agent-1', '', 1);
    INSERT INTO workflows (id, title, summary, updated_at) VALUES ('workflow-1', 'Workflow', '', 1);
    INSERT INTO skills (id, title, source, summary, updated_at) VALUES ('skill-1', 'Skill', 'custom', '', 1);
    INSERT INTO skill_versions (id, skill_id, major, minor, is_release, files_json, created_at) VALUES ('skill-version-1', 'skill-1', 1, 0, 1, '[{"path":"README.md","content":"# skill"}]', 1);
  `)
  return database
}

describe("database migrations", () => {
  it("has a readable Drizzle Kit migration", () => {
    const migrations = readMigrationFiles({ migrationsFolder: resolve(process.cwd(), "src/drizzle/migrations") })
    expect(migrations.length).toBeGreaterThan(0)
    expect(migrations.every((migration) => migration.folderMillis > 0)).toBe(true)
  })

  it("contains the core tables and migration safety rules", () => {
    const migrations = readMigrationFiles({ migrationsFolder: resolve(process.cwd(), "src/drizzle/migrations") })
    const statements = migrations
      .flatMap((migration) => migration.sql)
      .join(" ")
      .toLowerCase()
    for (const table of ["app_meta", "chats", "workflows", "providers", "integrations", "channels", "scheduler_runs"]) {
      expect(statements).toContain(table)
    }
  })

  it("upgrades supported legacy databases by repairing current runtime columns", () => {
    const database = createUpgradeableLegacyDatabase()

    applyMigrations(database)

    expect(database.prepare("SELECT COUNT(*) as count FROM __drizzle_migrations").get()).toEqual({ count: 1 })
    expect(database.prepare("SELECT enabled FROM documents WHERE id = 'doc-1'").get()).toEqual({ enabled: 1 })
    expect(database.prepare("SELECT enabled FROM integrations WHERE id = 'integration-1'").get()).toEqual({ enabled: 1 })
    expect(database.prepare("SELECT description FROM providers WHERE id = 'provider-1'").get()).toEqual({ description: "" })
    expect(database.prepare("SELECT source_type as sourceType, source_ref as sourceRef FROM chats WHERE id = 'chat-1'").get()).toEqual({
      sourceType: "manual",
      sourceRef: null,
    })
    expect(database.prepare("SELECT enabled FROM workflows WHERE id = 'workflow-1'").get()).toEqual({ enabled: 1 })
    expect(database.prepare("SELECT files_json as filesJson FROM skills WHERE id = 'skill-1'").get()).toEqual({
      filesJson: '[{"path":"README.md","content":"# skill"}]',
    })
    expect(database.prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'scheduler_runs'").get()).toEqual({
      name: "scheduler_runs",
    })

    database.close()
  })

  it("still rejects incomplete legacy databases", () => {
    const database = new DatabaseSync(":memory:")
    database.exec(`
      CREATE TABLE __app_migrations (id INTEGER PRIMARY KEY NOT NULL);
      INSERT INTO __app_migrations (id) VALUES (2);
      CREATE TABLE app_meta (key TEXT PRIMARY KEY NOT NULL, value TEXT NOT NULL);
    `)

    expect(() => applyMigrations(database)).toThrow(
      "Legacy database migrations are incomplete. Upgrade it before switching to Drizzle Kit migrations.",
    )

    database.close()
  })
})
