import { applyMigrations, openDatabase } from "@electron/others/infrastructure/db-core"
import { ensureWorkspace } from "@electron/others/infrastructure/workspace-service"

export async function getWorkflowDatabase() {
  await ensureWorkspace()
  const database = openDatabase()
  applyMigrations(database)
  return database
}
