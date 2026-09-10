import { ipcMain } from "electron"
import { applyMigrations, openDatabase } from "@electron/infrastructure/db-core"
import { ensureWorkspace } from "@electron/infrastructure/workspace-service"
import { z } from "zod"

const seedSchema = z.object({
  version: z.string().trim().min(1).max(128),
  legacyAgentIds: z.array(z.string().max(256)).max(100),
  legacySkillIds: z.array(z.string().max(256)).max(100),
  legacyWorkflowIds: z.array(z.string().max(256)).max(100),
  legacyIntegrationIds: z.array(z.string().max(256)).max(100),
})

export function registerDomainDatabaseIpc() {
  ipcMain.handle("database:ping", async () => {
    await ensureWorkspace()
    const database = openDatabase()
    applyMigrations(database)
    return database.prepare("SELECT 1 AS value").get()
  })
  ipcMain.handle("database:ensureSeeded", async (_event, value: unknown) => {
    const input = seedSchema.parse(value)
    await ensureWorkspace()
    const database = openDatabase()
    applyMigrations(database)
    const seeded = database.prepare("SELECT value FROM app_meta WHERE key = 'seed_version'").get() as { value?: string } | undefined
    if (seeded?.value === input.version) return { seeded: true }
    database.exec("BEGIN")
    try {
      for (const id of input.legacyIntegrationIds) {
        database.prepare("DELETE FROM integration_executions WHERE integration_id = ?").run(id)
        database.prepare("DELETE FROM integration_versions WHERE integration_id = ?").run(id)
        database.prepare("DELETE FROM integrations WHERE id = ?").run(id)
      }
      for (const id of input.legacyWorkflowIds) {
        database.prepare("DELETE FROM workflow_invocations WHERE workflow_id = ?").run(id)
        database.prepare("DELETE FROM workflow_versions WHERE workflow_id = ?").run(id)
        database.prepare("DELETE FROM workflows WHERE id = ?").run(id)
      }
      for (const id of input.legacySkillIds) {
        database.prepare("DELETE FROM skill_versions WHERE skill_id = ?").run(id)
        database.prepare("DELETE FROM skills WHERE id = ?").run(id)
      }
      for (const id of input.legacyAgentIds) {
        database.prepare("DELETE FROM agent_versions WHERE agent_id = ?").run(id)
        database.prepare("DELETE FROM agents WHERE id = ?").run(id)
      }
      database.prepare("INSERT INTO app_meta (key, value) VALUES ('seed_version', ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value").run(input.version)
      database.exec("COMMIT")
      return { seeded: false }
    } catch (error) {
      database.exec("ROLLBACK")
      throw error
    }
  })
}
