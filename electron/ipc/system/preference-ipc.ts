import { ipcMain } from "electron"
import { applyMigrations, openDatabase } from "@electron/infrastructure/db-core"
import { ensureWorkspace } from "@electron/infrastructure/workspace-service"

export function registerPreferenceIpc() {
  ipcMain.handle("preferences:get", async () => { const database = await getDatabase(); const row = database.prepare(`SELECT value FROM app_meta WHERE key = 'preference_settings'`).get() as { value?: string } | undefined; return row?.value ?? null })
  ipcMain.handle("preferences:save", async (_event, value: string) => { const database = await getDatabase(); database.prepare(`INSERT INTO app_meta (key, value) VALUES ('preference_settings', ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value`).run(value); return value })
}

async function getDatabase() { await ensureWorkspace(); const database = openDatabase(); applyMigrations(database); return database }
