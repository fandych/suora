import crypto from "node:crypto"
import { ipcMain } from "electron"
import { applyMigrations, openDatabase } from "@electron/infrastructure/db-core"
import { ensureWorkspace } from "@electron/infrastructure/workspace-service"
import { executeIntegration } from "@electron/integrations/integration-executor"
import { fetchApiDocumentation } from "@electron/ipc/http/http-request"
import type { IntegrationExecutePayload } from "@electron/types"
import { z } from "zod"
import { assertIntegrationEnabled } from "@electron/ipc/domain/integration-ipc-policy"

const selectIntegration = `SELECT id, title, kind, endpoint, enabled, updated_at as updatedAt FROM integrations`
const selectVersions = `SELECT id, major, minor, is_release as isRelease, created_at as createdAt, config_json as configJson FROM integration_versions`

const integrationExecuteSchema = z.object({
  integrationId: z.string().trim().min(1).max(256).optional(),
  kind: z.enum(["http", "scripts", "mcp"]),
  config: z.record(z.string(), z.unknown()),
  inputJson: z.string().max(2 * 1024 * 1024).optional(),
})

export function registerIntegrationIpc() {
  ipcMain.handle("integrations:fetchApiDoc", async (_event, url: string) => { await ensureWorkspace(); return fetchApiDocumentation(url) })
  ipcMain.handle("integration:execute", async (_event, payload: IntegrationExecutePayload) => {
    const parsed = integrationExecuteSchema.safeParse(payload)
    if (!parsed.success) throw new Error("Invalid integration execution payload.")
    const database = await getDatabase()
    if (parsed.data.integrationId) {
      assertIntegrationEnabled(database, parsed.data.integrationId)
    }
    return executeIntegration(parsed.data)
  })
  ipcMain.handle("integrations:list", async () => { const database = await getDatabase(); return database.prepare(`${selectIntegration} ORDER BY updated_at DESC`).all() })
  ipcMain.handle("integrations:get", async (_event, id: string) => getIntegration(id))
  ipcMain.handle("integrations:create", async (_event, payload?: Partial<{ kind: string; title: string; endpoint: string; configJson: string }>) => { const database = await getDatabase(); const id = crypto.randomUUID(); const now = Date.now(); database.prepare(`INSERT INTO integrations (id, title, kind, endpoint, enabled, updated_at) VALUES (?, ?, ?, ?, 1, ?)`).run(id, payload?.title || `New ${payload?.kind || "http"} integration`, payload?.kind || "http", payload?.endpoint || "", now); database.prepare(`INSERT INTO integration_versions (id, integration_id, major, minor, is_release, config_json, created_at) VALUES (?, ?, 1, 0, 0, ?, ?)`).run(crypto.randomUUID(), id, payload?.configJson || "{}", now); return getIntegration(id) })
  ipcMain.handle("integrations:save", async (_event, payload: { id: string; title: string; kind: string; endpoint: string; configJson: string; enabled?: boolean; selectedVersionId?: string; publish?: boolean }) => { const database = await getDatabase(); const now = Date.now(); const latest = database.prepare(`SELECT major, minor, is_release as isRelease FROM integration_versions WHERE integration_id = ? ORDER BY major DESC, minor DESC, created_at DESC LIMIT 1`).get(payload.id) as { major: number; minor: number; isRelease: number } | undefined; const draft = payload.selectedVersionId ? database.prepare(`SELECT id, is_release as isRelease FROM integration_versions WHERE integration_id = ? AND id = ?`).get(payload.id, payload.selectedVersionId) as { id: string; isRelease: number } | undefined : undefined; const selected = draft && !draft.isRelease ? draft : database.prepare(`SELECT id FROM integration_versions WHERE integration_id = ? AND is_release = 0 ORDER BY major DESC, minor DESC, created_at DESC LIMIT 1`).get(payload.id) as { id: string } | undefined; database.prepare(`UPDATE integrations SET title = ?, kind = ?, endpoint = ?, enabled = COALESCE(?, enabled), updated_at = ? WHERE id = ?`).run(payload.title, payload.kind, payload.endpoint, payload.enabled == null ? null : (payload.enabled ? 1 : 0), now, payload.id); if (!payload.publish && selected) database.prepare(`UPDATE integration_versions SET config_json = ?, created_at = ? WHERE id = ?`).run(payload.configJson, now, selected.id); else database.prepare(`INSERT INTO integration_versions (id, integration_id, major, minor, is_release, config_json, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)`).run(crypto.randomUUID(), payload.id, !latest ? 1 : latest.isRelease ? latest.major + 1 : latest.major, !latest || latest.isRelease ? 0 : latest.minor + 1, payload.publish ? 1 : 0, payload.configJson, now); return getIntegration(payload.id) })
  ipcMain.handle("integrations:setEnabled", async (_event, payload: { id: string; enabled: boolean }) => { const database = await getDatabase(); database.prepare("UPDATE integrations SET enabled = ?, updated_at = ? WHERE id = ?").run(payload.enabled ? 1 : 0, Date.now(), payload.id); return database.prepare(`${selectIntegration} WHERE id = ?`).get(payload.id) ?? null })
  ipcMain.handle("integrations:delete", async (_event, id: string) => { const database = await getDatabase(); database.prepare("DELETE FROM integration_executions WHERE integration_id = ?").run(id); database.prepare("DELETE FROM integration_versions WHERE integration_id = ?").run(id); const result = database.prepare("DELETE FROM integrations WHERE id = ?").run(id); return { ok: Number(result.changes) > 0 } })
  ipcMain.handle("integrations:recordExecution", async (_event, payload: { id: string; versionId: string; status: string; input: string; output: string }) => { const database = await getDatabase(); database.prepare(`INSERT INTO integration_executions (id, integration_id, version_id, status, input_json, output_json, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)`).run(crypto.randomUUID(), payload.id, payload.versionId, payload.status, payload.input, payload.output, Date.now()); return database.prepare(`SELECT id, version_id as versionId, status, input_json as input, output_json as output, created_at as createdAt FROM integration_executions WHERE integration_id = ? ORDER BY created_at DESC`).all(payload.id) })
}

async function getIntegration(id: string) { const database = await getDatabase(); return { integration: database.prepare(`${selectIntegration} WHERE id = ?`).get(id) ?? null, versions: database.prepare(`${selectVersions} WHERE integration_id = ? ORDER BY major DESC, minor DESC, created_at DESC`).all(id), executions: database.prepare(`SELECT id, version_id as versionId, status, input_json as input, output_json as output, created_at as createdAt FROM integration_executions WHERE integration_id = ? ORDER BY created_at DESC`).all(id) } }
async function getDatabase() { await ensureWorkspace(); const database = openDatabase(); applyMigrations(database); return database }
