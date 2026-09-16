import { DatabaseSync } from "node:sqlite"
import { applyMigrations } from "@/electron/infrastructure/db-core"
import { createDrizzleDatabase } from "@/drizzle/db"

export function createSqliteTestDatabase() {
  const sqlite = new DatabaseSync(":memory:")
  applyMigrations(sqlite)
  return { sqlite, db: createDrizzleDatabase(sqlite), close: () => sqlite.close() }
}
