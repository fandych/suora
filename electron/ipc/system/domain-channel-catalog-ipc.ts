import { ipcMain } from "electron"
import { z } from "zod"
import { applyMigrations, openDatabase } from "@electron/infrastructure/db-core"
import { ensureWorkspace } from "@electron/infrastructure/workspace-service"

const syncSchema = z.object({
  renamed: z.array(z.object({ id: z.string().min(1).max(256), title: z.string().max(512) })).max(100),
  channels: z.array(z.object({ id: z.string().min(1).max(256), title: z.string().max(512), platform: z.string().max(128), enabled: z.boolean(), status: z.string().max(64), connectionMode: z.string().max(64), webhookPath: z.string().max(4096), webhookSecret: z.string().max(4096), autoReply: z.boolean(), replyAgentId: z.string().max(256), createdAt: z.number(), configJson: z.string().max(16 * 1024 * 1024), runtimeJson: z.string().max(16 * 1024 * 1024), updatedAt: z.number() })).max(100),
})

export function registerDomainChannelCatalogIpc() {
  ipcMain.handle("database:syncChannelCatalog", async (_event, value: unknown) => {
    const input = syncSchema.parse(value)
    await ensureWorkspace()
    const database = openDatabase()
    applyMigrations(database)
    database.exec("BEGIN")
    try {
      for (const entry of input.renamed) {
        database.prepare("UPDATE channels SET title = ?, config_json = json_set(config_json, '$.title', ?), updated_at = ? WHERE id = ?").run(entry.title, entry.title, Date.now(), entry.id)
      }
      for (const entry of input.channels) {
        database.prepare(`INSERT INTO channels (id, title, platform, enabled, status, connection_mode, webhook_path, webhook_secret, auto_reply, reply_agent_id, created_at, last_message_at, message_count, config_json, runtime_json, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, 0, ?, ?, ?) ON CONFLICT(id) DO NOTHING`).run(entry.id, entry.title, entry.platform, entry.enabled ? 1 : 0, entry.status, entry.connectionMode, entry.webhookPath, entry.webhookSecret, entry.autoReply ? 1 : 0, entry.replyAgentId, entry.createdAt, entry.configJson, entry.runtimeJson, entry.updatedAt)
      }
      database.exec("COMMIT")
    } catch (error) {
      database.exec("ROLLBACK")
      throw error
    }
    return { ok: true }
  })
}
