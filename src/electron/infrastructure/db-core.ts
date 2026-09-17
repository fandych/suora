import { Buffer } from "node:buffer"
import { DatabaseSync, type SQLInputValue } from "node:sqlite"
import { existsSync } from "node:fs"
import { resolve } from "node:path"

import { readMigrationFiles } from "drizzle-orm/migrator"
import { appState } from "@/electron/infrastructure/app-state"
import { getDatabasePath } from "@/electron/infrastructure/workspace-paths"
import { validateQueryPayload } from "@/electron/infrastructure/db-query-policy"
import type { QueryPayload, SqliteDatabase } from "@/types/electron"

export { validateQueryPayload } from "@/electron/infrastructure/db-query-policy"

const LEGACY_UPGRADEABLE_TABLES = [
  "agent_versions",
  "agents",
  "app_meta",
  "channels",
  "chat_messages",
  "chats",
  "document_versions",
  "documents",
  "integration_executions",
  "integration_versions",
  "integrations",
  "providers",
  "schedulers",
  "skills",
  "workflow_invocations",
  "workflow_versions",
  "workflows",
]

function hasTable(database: SqliteDatabase, tableName: string) {
  return Boolean(database.prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name = ?").get(tableName))
}

function getTableColumns(database: SqliteDatabase, tableName: string) {
  if (!hasTable(database, tableName)) {
    return new Set<string>()
  }

  return new Set(
    (database.prepare(`PRAGMA table_info(${tableName})`).all() as Array<{ name: string }>).map((column) => column.name),
  )
}

function isLegacySchemaUpgradeable(database: SqliteDatabase) {
  const tableNames = new Set(
    (database.prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%'").all() as Array<{
      name: string
    }>).map((table) => table.name),
  )

  return LEGACY_UPGRADEABLE_TABLES.every((tableName) => tableNames.has(tableName))
}

function ensureColumn(database: SqliteDatabase, tableName: string, columnName: string, statement: string) {
  if (!hasTable(database, tableName)) {
    return
  }

  const columns = getTableColumns(database, tableName)
  if (!columns.has(columnName)) {
    database.exec(statement)
  }
}

function repairCurrentSchema(database: SqliteDatabase) {
  database.exec(`
    CREATE TABLE IF NOT EXISTS scheduler_runs (
      id TEXT PRIMARY KEY NOT NULL,
      scheduler_id TEXT NOT NULL,
      status TEXT NOT NULL,
      input_json TEXT NOT NULL,
      output_json TEXT NOT NULL,
      started_at INTEGER NOT NULL,
      finished_at INTEGER
    );
  `)

  ensureColumn(database, "chats", "source_type", "ALTER TABLE chats ADD COLUMN source_type TEXT DEFAULT 'manual' NOT NULL")
  ensureColumn(database, "chats", "source_ref", "ALTER TABLE chats ADD COLUMN source_ref TEXT")
  ensureColumn(database, "documents", "enabled", "ALTER TABLE documents ADD COLUMN enabled INTEGER DEFAULT true NOT NULL")
  ensureColumn(
    database,
    "integrations",
    "enabled",
    "ALTER TABLE integrations ADD COLUMN enabled INTEGER DEFAULT true NOT NULL",
  )
  ensureColumn(database, "providers", "description", "ALTER TABLE providers ADD COLUMN description TEXT DEFAULT '' NOT NULL")
  ensureColumn(database, "workflows", "enabled", "ALTER TABLE workflows ADD COLUMN enabled INTEGER DEFAULT true NOT NULL")

  if (hasTable(database, "skills")) {
    const skillColumns = getTableColumns(database, "skills")
    if (!skillColumns.has("files_json")) {
      database.exec("ALTER TABLE skills ADD COLUMN files_json TEXT NOT NULL DEFAULT '[]'")
      if (hasTable(database, "skill_versions")) {
        database.exec(`
          UPDATE skills
          SET files_json = COALESCE(
            (
              SELECT files_json
              FROM skill_versions
              WHERE skill_versions.skill_id = skills.id
              ORDER BY major DESC, minor DESC, created_at DESC
              LIMIT 1
            ),
            '[]'
          )
        `)
      }
    }
  }
}

export function openDatabase() {
  if (appState.sqlite) {
    return appState.sqlite
  }

  appState.sqlite = new DatabaseSync(getDatabasePath())
  appState.sqlite.exec("PRAGMA journal_mode = WAL")
  appState.sqlite.exec("PRAGMA foreign_keys = ON")

  return appState.sqlite
}

export function applyMigrations(database: SqliteDatabase) {
  database.exec(`
    CREATE TABLE IF NOT EXISTS __drizzle_migrations (
      id INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
      hash TEXT NOT NULL,
      created_at NUMERIC
    );
  `)

  const migrationsFolder = [
    resolve(__dirname, "src/drizzle/migrations"),
    resolve(process.cwd(), "src/drizzle/migrations"),
    resolve(__dirname, "../../drizzle/migrations"),
  ].find((folder) => existsSync(folder))
  if (!migrationsFolder) {
    throw new Error("Drizzle migrations folder was not found.")
  }
  const migrations = readMigrationFiles({ migrationsFolder })

  if (hasTable(database, "__app_migrations")) {
    const legacyState = database.prepare("SELECT COUNT(*) as count, MAX(id) as id FROM __app_migrations").get() as {
      count: number
      id?: number
    }
    const drizzleState = database.prepare("SELECT COUNT(*) as count FROM __drizzle_migrations").get() as { count: number }

    if (legacyState.count > 0 && drizzleState.count === 0) {
      if (!isLegacySchemaUpgradeable(database)) {
        throw new Error("Legacy database migrations are incomplete. Upgrade it before switching to Drizzle Kit migrations.")
      }

      const migration = migrations[migrations.length - 1]
      database
        .prepare("INSERT OR IGNORE INTO __drizzle_migrations (hash, created_at) VALUES (?, ?)")
        .run(migration.hash, migration.folderMillis)
    }
  }

  const lastMigration = database
    .prepare("SELECT created_at as createdAt FROM __drizzle_migrations ORDER BY created_at DESC LIMIT 1")
    .get() as { createdAt?: number } | undefined
  const pending = migrations.filter((migration) => !lastMigration || Number(lastMigration.createdAt) < migration.folderMillis)

  for (const migration of pending) {
    database.exec("BEGIN")
    try {
      for (const statement of migration.sql) {
        database.exec(statement)
      }
      database
        .prepare("INSERT INTO __drizzle_migrations (hash, created_at) VALUES (?, ?)")
        .run(migration.hash, migration.folderMillis)
      database.exec("COMMIT")
    } catch (error) {
      database.exec("ROLLBACK")
      throw error
    }
  }

  repairCurrentSchema(database)
}

function mapRows(rows: unknown[]) {
  return rows.map((row) => {
    if (!row || typeof row !== "object") {
      return row
    }

    return Object.fromEntries(
      Object.entries(row as Record<string, unknown>).map(([key, value]) => [
        key,
        value instanceof Uint8Array ? Buffer.from(value).toString("utf8") : value,
      ]),
    )
  })
}

function prepareStatement(database: SqliteDatabase, sql: string) {
  const statement = database.prepare(sql)
  statement.setReturnArrays(true)
  statement.setReadBigInts(false)
  return statement
}

function normalizeSqlParams(params: unknown[]): SQLInputValue[] {
  return params.map((value) => {
    if (value === undefined) {
      return null
    }

    if (value == null || typeof value === "string" || typeof value === "number" || typeof value === "bigint") {
      return value
    }

    if (ArrayBuffer.isView(value)) {
      return value as SQLInputValue
    }

    return JSON.stringify(value)
  })
}

export function executeQuery(payload: QueryPayload) {
  validateQueryPayload(payload)
  const database = openDatabase()
  applyMigrations(database)

  const statement = prepareStatement(database, payload.sql)
  const params = normalizeSqlParams(payload.params)

  switch (payload.method) {
    case "run": {
      statement.run(...params)
      return { rows: [] }
    }
    case "get": {
      statement.setReturnArrays(false)
      const row = statement.get(...params)
      return { rows: row ? [row] : [] }
    }
    case "values": {
      statement.setReturnArrays(true)
      return { rows: statement.all(...params) }
    }
    case "all":
    default: {
      statement.setReturnArrays(false)
      return { rows: mapRows(statement.all(...params)) }
    }
  }
}

export function closeDatabase() {
  appState.sqlite?.close()
  appState.sqlite = null
}
