import { ipcMain } from "electron"
import { z } from "zod"
import { cleanupSeedResources, getSeedVersion, pingDrizzle, setSeedVersion } from "@electron/database/drizzle/seed-repository"

const seedSchema = z.object({ version: z.string().trim().min(1).max(128), legacyAgentIds: z.array(z.string().max(256)).max(100), legacySkillIds: z.array(z.string().max(256)).max(100), legacyWorkflowIds: z.array(z.string().max(256)).max(100), legacyIntegrationIds: z.array(z.string().max(256)).max(100) })
export function registerDomainDatabaseIpc() {
  ipcMain.handle("database:ping", () => pingDrizzle())
  ipcMain.handle("database:ensureSeeded", async (_event, value: unknown) => { const input = seedSchema.parse(value); if (await getSeedVersion() === input.version) return { seeded: true }; await cleanupSeedResources(input); await setSeedVersion(input.version); return { seeded: false } })
}
