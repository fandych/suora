import { drizzle, type AsyncRemoteCallback } from "drizzle-orm/sqlite-proxy"
import { applyMigrations, openDatabase } from "@/electron/infrastructure/db-core"
import type { QueryMethod, SqliteDatabase } from "@/types/electron"
import { schema } from "@/drizzle/schema"

function createCallback(database: SqliteDatabase): AsyncRemoteCallback {
  return async (sql, params, method) => {
    const normalizedSql = sql.replace(/\bfrom\b/gi, "FROM").replace(/FROM\s+"([^"]+)"/g, "FROM $1")
    const statement = database.prepare(normalizedSql)
    const normalizedParams = params.map((value) => (value === undefined ? null : value))

    if (method === "run") {
      statement.run(...normalizedParams)
      return { rows: [] }
    }

    if (method === "get") {
      statement.setReturnArrays?.(false)
      const row = statement.get(...normalizedParams)
      return { rows: row ? [row] : [] }
    }

    statement.setReturnArrays?.(method === "values")
    const rows = statement.all(...normalizedParams)
    return {
      rows: rows.map((row: unknown) => (Array.isArray(row) ? row : Object.values(row as Record<string, unknown>))),
    }
  }
}

export function createDrizzleDatabase(database: SqliteDatabase) {
  return drizzle(createCallback(database), { schema })
}

export function getDrizzleDatabase() {
  const database = openDatabase()
  applyMigrations(database)
  return createDrizzleDatabase(database)
}

export type DrizzleDatabase = ReturnType<typeof getDrizzleDatabase>
export type DrizzleQueryMethod = QueryMethod
