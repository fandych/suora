import { Buffer } from "node:buffer"
import { DatabaseSync, type SQLInputValue } from "node:sqlite"

import { runtimeMigrations } from "@/data/db/migrations"
import { appState } from "@electron/others/app-state"
import { getDatabasePath } from "@electron/others/paths"
import type { QueryPayload, SqliteDatabase } from "@electron/types"

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
    CREATE TABLE IF NOT EXISTS __app_migrations (
      id INTEGER PRIMARY KEY NOT NULL
    );

    CREATE TABLE IF NOT EXISTS app_meta (
      key TEXT PRIMARY KEY NOT NULL,
      value TEXT NOT NULL
    );
  `)

  const appliedIds = new Set<number>(
    database.prepare("SELECT id FROM __app_migrations ORDER BY id ASC").all().map((row) => Number((row as { id: number }).id))
  )

  for (const migration of runtimeMigrations) {
    if (appliedIds.has(migration.id)) {
      continue
    }

    try {
      database.exec("BEGIN")

      for (const statement of migration.statements) {
        try {
          database.exec(statement)
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error)
          if (!migration.ignoreErrorsMatching?.some((pattern) => pattern.test(message))) {
            throw error
          }
        }
      }

      database.prepare("INSERT INTO __app_migrations (id) VALUES (?)").run(migration.id)
      database.exec("COMMIT")
    } catch (error) {
      database.exec("ROLLBACK")
      throw error
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
      ])
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

    if (
      value == null ||
      typeof value === "string" ||
      typeof value === "number" ||
      typeof value === "bigint"
    ) {
      return value
    }

    if (ArrayBuffer.isView(value)) {
      return value as SQLInputValue
    }

    return JSON.stringify(value)
  })
}

export function executeQuery(payload: QueryPayload) {
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
