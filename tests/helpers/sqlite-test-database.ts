import { DatabaseSync } from "node:sqlite"
import { applyMigrations } from "@electron/others/infrastructure/db-core"
import { createDrizzleDatabase } from "@electron/database/drizzle/client"

export function createSqliteTestDatabase() {
  const sqlite = new DatabaseSync(":memory:")
  applyMigrations(sqlite)
  return { sqlite, db: createDrizzleDatabase(sqlite), close: () => sqlite.close() }
}
