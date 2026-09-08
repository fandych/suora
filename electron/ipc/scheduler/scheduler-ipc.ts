import crypto from "node:crypto"
import { ipcMain } from "electron"
import { applyMigrations, openDatabase } from "@electron/database/db-core"
import { ensureWorkspace } from "@electron/others/workspace"

const selectScheduler = `SELECT id, title, description, enabled, schedule, time_zone as timeZone, target_type as targetType, target_id as targetId, target_name as targetName, missed_run_policy as missedRunPolicy, retry_limit as retryLimit, retry_backoff_seconds as retryBackoffSeconds, input_payload_json as inputPayloadJson, updated_at as updatedAt FROM schedulers`

export function registerSchedulerIpc() {
  ipcMain.handle("schedulers:list", async () => { const database = await getDatabase(); return database.prepare(`${selectScheduler} ORDER BY updated_at DESC`).all() })
  ipcMain.handle("schedulers:get", async (_event, id: string) => { const database = await getDatabase(); return database.prepare(`${selectScheduler} WHERE id = ?`).get(id) ?? null })
  ipcMain.handle("schedulers:create", async () => {
    const database = await getDatabase(); const id = crypto.randomUUID(); const now = Date.now()
    database.prepare(`INSERT INTO schedulers (id, title, description, enabled, schedule, time_zone, target_type, target_id, target_name, missed_run_policy, retry_limit, retry_backoff_seconds, input_payload_json, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(id, "New scheduler", "", 1, "0 9 * * *", "Asia/Shanghai", "workflow", "", "", "skip", 0, 300, "{}", now)
    return database.prepare(`${selectScheduler} WHERE id = ?`).get(id)
  })
  ipcMain.handle("schedulers:save", async (_event, payload: { id: string; title: string; description: string; enabled: boolean; schedule: string; timeZone: string; targetType: string; targetId: string; targetName: string; missedRunPolicy: string; retryLimit: number; retryBackoffSeconds: number; inputPayloadJson: string }) => {
    const database = await getDatabase(); database.prepare(`UPDATE schedulers SET title = ?, description = ?, enabled = ?, schedule = ?, time_zone = ?, target_type = ?, target_id = ?, target_name = ?, missed_run_policy = ?, retry_limit = ?, retry_backoff_seconds = ?, input_payload_json = ?, updated_at = ? WHERE id = ?`).run(payload.title, payload.description, payload.enabled ? 1 : 0, payload.schedule, payload.timeZone, payload.targetType, payload.targetId, payload.targetName, payload.missedRunPolicy, payload.retryLimit, payload.retryBackoffSeconds, payload.inputPayloadJson, Date.now(), payload.id)
    return database.prepare(`${selectScheduler} WHERE id = ?`).get(payload.id)
  })
  ipcMain.handle("schedulers:setEnabled", async (_event, payload: { id: string; enabled: boolean }) => { const database = await getDatabase(); database.prepare("UPDATE schedulers SET enabled = ?, updated_at = ? WHERE id = ?").run(payload.enabled ? 1 : 0, Date.now(), payload.id); return database.prepare(`${selectScheduler} WHERE id = ?`).get(payload.id) ?? null })
  ipcMain.handle("schedulers:listRuns", async (_event, id: string) => { const database = await getDatabase(); return database.prepare(`SELECT id, status, input_json as input, output_json as output, started_at as startedAt, finished_at as finishedAt FROM scheduler_runs WHERE scheduler_id = ? ORDER BY started_at DESC`).all(id) })
  ipcMain.handle("schedulers:delete", async (_event, id: string) => { const database = await getDatabase(); database.prepare("DELETE FROM scheduler_runs WHERE scheduler_id = ?").run(id); const result = database.prepare("DELETE FROM schedulers WHERE id = ?").run(id); return { ok: Number(result.changes) > 0 } })
}

async function getDatabase() { await ensureWorkspace(); const database = openDatabase(); applyMigrations(database); return database }
