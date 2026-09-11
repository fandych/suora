import { ipcMain } from "electron"
import { z } from "zod"
import { assertIntegrationEnabledWithDrizzle, createIntegrationWithDrizzle, deleteIntegrationWithDrizzle, getIntegrationWithDrizzle, listIntegrationsWithDrizzle, recordIntegrationExecutionWithDrizzle, saveIntegrationWithDrizzle, setIntegrationEnabledWithDrizzle } from "@electron/database/drizzle/integration-repository"
import { executeIntegration } from "@electron/integrations/integration-executor"
import { fetchApiDocumentation } from "@electron/ipc/http/http-request"
import type { IntegrationExecutePayload } from "@electron/types"
import { ensureWorkspace } from "@electron/infrastructure/workspace-service"

const integrationExecuteSchema = z.object({ integrationId: z.string().trim().min(1).max(256).optional(), kind: z.enum(["http", "scripts", "mcp"]), config: z.record(z.string(), z.unknown()), inputJson: z.string().max(2 * 1024 * 1024).optional() })
export function registerIntegrationIpc() {
  ipcMain.handle("integrations:fetchApiDoc", async (_event, url: string) => { await ensureWorkspace(); return fetchApiDocumentation(url) })
  ipcMain.handle("integration:execute", async (_event, payload: IntegrationExecutePayload) => { const parsed = integrationExecuteSchema.safeParse(payload); if (!parsed.success) throw new Error("Invalid integration execution payload."); if (parsed.data.integrationId) await assertIntegrationEnabledWithDrizzle(parsed.data.integrationId); return executeIntegration(parsed.data) })
  ipcMain.handle("integrations:list", () => listIntegrationsWithDrizzle())
  ipcMain.handle("integrations:get", (_event, id: string) => getIntegrationWithDrizzle(id))
  ipcMain.handle("integrations:create", (_event, payload?: Partial<{ kind: string; title: string; endpoint: string; configJson: string }>) => createIntegrationWithDrizzle(payload))
  ipcMain.handle("integrations:save", (_event, payload: { id: string; title: string; kind: string; endpoint: string; configJson: string; enabled?: boolean; selectedVersionId?: string; publish?: boolean }) => saveIntegrationWithDrizzle(payload))
  ipcMain.handle("integrations:setEnabled", (_event, payload: { id: string; enabled: boolean }) => setIntegrationEnabledWithDrizzle(payload.id, payload.enabled))
  ipcMain.handle("integrations:delete", (_event, id: string) => deleteIntegrationWithDrizzle(id))
  ipcMain.handle("integrations:recordExecution", (_event, payload: { id: string; versionId: string; status: string; input: string; output: string }) => recordIntegrationExecutionWithDrizzle(payload))
}
