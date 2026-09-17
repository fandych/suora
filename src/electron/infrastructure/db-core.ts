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

  if (database.prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name = '__app_migrations'").get()) {
    const legacyState = database.prepare("SELECT COUNT(*) as count, MAX(id) as id FROM __app_migrations").get() as {
      count: number
      id?: number
    }
    if (legacyState.count > 0 && legacyState.id !== 14) {
      throw new Error("Legacy database migrations are incomplete. Upgrade it before switching to Drizzle Kit migrations.")
    }
    if (legacyState.id === 14) {
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

  // Databases upgraded from the legacy migration table may already be marked
  // as fully migrated even though the provider description column was never
  // created. Repair that specific historical state before Drizzle queries it.
  const providersTable = database
    .prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'providers'")
    .get()
  if (providersTable) {
    const providerColumns = database.prepare("PRAGMA table_info(providers)").all() as Array<{ name: string }>
    if (!providerColumns.some((column) => column.name === "description")) {
      database.exec("ALTER TABLE providers ADD COLUMN description TEXT DEFAULT '' NOT NULL")
    }
  }

  // Early refactor builds could record the Skill migration without applying its
  // schema change. Keep existing workspaces readable by repairing that state
  // before Drizzle selects the direct files_json column.
  const skillsTable = database
    .prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'skills'")
    .get()
  if (skillsTable) {
    const skillColumns = database.prepare("PRAGMA table_info(skills)").all() as Array<{ name: string }>
    if (!skillColumns.some((column) => column.name === "files_json")) {
      database.exec("ALTER TABLE skills ADD COLUMN files_json TEXT NOT NULL DEFAULT '[]'")
      const skillVersionsTable = database
        .prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'skill_versions'")
        .get()
      if (skillVersionsTable) {
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
