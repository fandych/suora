import { applyMigrations, openDatabase } from "@electron/infrastructure/db-core"
import { resolvePreferenceSettings, type PreferenceSettings } from "@shared/domain/preference-settings"
import { revealCredential } from "@electron/infrastructure/credential-vault"

export function getPreferenceSettingsValue() {
  const database = openDatabase()
  applyMigrations(database)
  const row = database.prepare("SELECT value FROM app_meta WHERE key = 'preference_settings'").get() as { value?: string } | undefined
  if (!row?.value) return null
  try {
    const settings = JSON.parse(row.value) as Record<string, unknown>
    if (typeof settings.mailServerPassword === "string") {
      settings.mailServerPassword = revealCredential(settings.mailServerPassword)
    }
    return JSON.stringify(settings)
  } catch {
    return row.value
  }
}

export function getPreferenceSettingsSnapshot(): PreferenceSettings {
  return resolvePreferenceSettings(getPreferenceSettingsValue())
}