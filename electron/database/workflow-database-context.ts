import { applyMigrations, openDatabase } from "@electron/infrastructure/db-core"
import { ensureWorkspace } from "@electron/infrastructure/workspace-service"

export async function getWorkflowDatabase() {
  await ensureWorkspace()
  const database = openDatabase()
  applyMigrations(database)
  return database
}
