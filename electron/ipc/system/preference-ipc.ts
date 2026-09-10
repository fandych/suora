import { ipcMain } from "electron"
import { applyMigrations, openDatabase } from "@electron/infrastructure/db-core"
import { ensureWorkspace } from "@electron/infrastructure/workspace-service"
import { protectCredential, revealCredential } from "@electron/infrastructure/credential-vault"

function revealPreferenceValue(value: string | null | undefined) {
  if (!value) return value ?? null
  try {
    const settings = JSON.parse(value) as Record<string, unknown>
    if (typeof settings.mailServerPassword === "string") {
      settings.mailServerPassword = revealCredential(settings.mailServerPassword)
    }
    return JSON.stringify(settings)
  } catch {
    return value
  }
}

function protectPreferenceValue(value: string) {
  const settings = JSON.parse(value) as Record<string, unknown>
  if (typeof settings.mailServerPassword === "string") {
    settings.mailServerPassword = protectCredential(settings.mailServerPassword)
  }
  return JSON.stringify(settings)
}

export function registerPreferenceIpc() {
  ipcMain.handle("preferences:get", async () => { const database = await getDatabase(); const row = database.prepare(`SELECT value FROM app_meta WHERE key = 'preference_settings'`).get() as { value?: string } | undefined; return revealPreferenceValue(row?.value) })
  ipcMain.handle("preferences:save", async (_event, value: string) => { const database = await getDatabase(); const protectedValue = protectPreferenceValue(value); database.prepare(`INSERT INTO app_meta (key, value) VALUES ('preference_settings', ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value`).run(protectedValue); return value })
}

async function getDatabase() { await ensureWorkspace(); const database = openDatabase(); applyMigrations(database); return database }
