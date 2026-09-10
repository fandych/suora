import crypto from "node:crypto"
import { ipcMain } from "electron"
import { applyMigrations, openDatabase } from "@electron/infrastructure/db-core"
import { protectCredential, revealCredential } from "@electron/infrastructure/credential-vault"
import { discoverProviderModels } from "@electron/services/model-discovery"
import { ensureWorkspace } from "@electron/infrastructure/workspace-service"
import { entityIdSchema, parseIpcInput, providerCreateSchema, providerDiscoverySchema, providerSaveSchema } from "@electron/ipc/system/ipc-input-schemas"

const selectModel = `SELECT id, title, provider_type as providerType, base_url as baseUrl, api_key as apiKey, models_json as modelsJson, enabled, updated_at as updatedAt FROM providers`
function readModel(row: Record<string, unknown> | null | undefined) {
  if (!row) return null
  return { ...row, apiKey: revealCredential(row.apiKey) }
}
export function registerModelIpc() {
  ipcMain.handle("models:list", async () => { const db = await database(); return db.prepare(`${selectModel} ORDER BY updated_at DESC`).all().map((row) => readModel(row as Record<string, unknown>)) })
  ipcMain.handle("models:get", async (_event, id: unknown) => { const providerId = parseIpcInput(entityIdSchema, id); const db = await database(); return readModel(db.prepare(`${selectModel} WHERE id = ?`).get(providerId) as Record<string, unknown> | undefined) })
  ipcMain.handle("models:create", async (_event, value?: unknown) => { const payload = parseIpcInput(providerCreateSchema, value ?? {}); const db = await database(); const id = crypto.randomUUID(); db.prepare(`INSERT INTO providers (id, title, provider_type, base_url, api_key, models_json, enabled, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`).run(id, payload.title || "New provider", payload.providerType || "openai-compatible", payload.baseUrl || "", protectCredential(payload.apiKey || ""), payload.modelsJson || "[]", payload.enabled === false ? 0 : 1, Date.now()); return readModel(db.prepare(`${selectModel} WHERE id = ?`).get(id) as Record<string, unknown> | undefined) })
  ipcMain.handle("models:save", async (_event, value: unknown) => { const payload = parseIpcInput(providerSaveSchema, value); const db = await database(); db.prepare(`UPDATE providers SET title = ?, provider_type = ?, base_url = ?, api_key = ?, models_json = ?, enabled = ?, updated_at = ? WHERE id = ?`).run(payload.title, payload.providerType, payload.baseUrl, protectCredential(payload.apiKey), payload.modelsJson, payload.enabled ? 1 : 0, Date.now(), payload.id); return readModel(db.prepare(`${selectModel} WHERE id = ?`).get(payload.id) as Record<string, unknown> | undefined) })
  ipcMain.handle("models:delete", async (_event, id: unknown) => { const providerId = parseIpcInput(entityIdSchema, id); const db = await database(); db.prepare(`DELETE FROM providers WHERE id = ?`).run(providerId); return { success: true } })
  ipcMain.handle("models:discover", async (_event, value: unknown) => { const payload = parseIpcInput(providerDiscoverySchema, value); await ensureWorkspace(); return discoverProviderModels(payload) })
}
async function database() { await ensureWorkspace(); const db = openDatabase(); applyMigrations(db); return db }
