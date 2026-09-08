import crypto from "node:crypto"
import { ipcMain } from "electron"
import { applyMigrations, openDatabase } from "@electron/database/db-core"
import { discoverProviderModels } from "@electron/others/model-discovery"
import { ensureWorkspace } from "@electron/others/workspace"

const selectModel = `SELECT id, title, provider_type as providerType, base_url as baseUrl, api_key as apiKey, models_json as modelsJson, enabled, updated_at as updatedAt FROM providers`
export function registerModelIpc() {
  ipcMain.handle("models:list", async () => { const db = await database(); return db.prepare(`${selectModel} ORDER BY updated_at DESC`).all() })
  ipcMain.handle("models:get", async (_event, id: string) => { const db = await database(); return db.prepare(`${selectModel} WHERE id = ?`).get(id) ?? null })
  ipcMain.handle("models:create", async (_event, payload?: Partial<{ title: string; providerType: string; baseUrl: string; apiKey: string; modelsJson: string; enabled: boolean }>) => { const db = await database(); const id = crypto.randomUUID(); db.prepare(`INSERT INTO providers (id, title, provider_type, base_url, api_key, models_json, enabled, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`).run(id, payload?.title?.trim() || "New provider", payload?.providerType?.trim() || "openai-compatible", payload?.baseUrl?.trim() || "", payload?.apiKey || "", payload?.modelsJson || "[]", payload?.enabled === false ? 0 : 1, Date.now()); return db.prepare(`${selectModel} WHERE id = ?`).get(id) })
  ipcMain.handle("models:save", async (_event, payload: { id: string; title: string; providerType: string; baseUrl: string; apiKey: string; modelsJson: string; enabled: boolean }) => { const db = await database(); db.prepare(`UPDATE providers SET title = ?, provider_type = ?, base_url = ?, api_key = ?, models_json = ?, enabled = ?, updated_at = ? WHERE id = ?`).run(payload.title, payload.providerType, payload.baseUrl, payload.apiKey, payload.modelsJson, payload.enabled ? 1 : 0, Date.now(), payload.id); return db.prepare(`${selectModel} WHERE id = ?`).get(payload.id) })
  ipcMain.handle("models:delete", async (_event, id: string) => { const db = await database(); db.prepare(`DELETE FROM providers WHERE id = ?`).run(id); return { success: true } })
  ipcMain.handle("models:discover", async (_event, payload: { providerType: string; baseUrl: string; apiKey: string }) => { await ensureWorkspace(); return discoverProviderModels(payload) })
}
async function database() { await ensureWorkspace(); const db = openDatabase(); applyMigrations(db); return db }
