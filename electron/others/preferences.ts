import { applyMigrations, openDatabase } from "@electron/database/db-core"
import { resolvePreferenceSettings, type PreferenceSettings } from "@/data/domain/preference-settings"

export function getPreferenceSettingsValue() {
  const database = openDatabase()
  applyMigrations(database)
  const row = database.prepare("SELECT value FROM app_meta WHERE key = 'preference_settings'").get() as { value?: string } | undefined
  return row?.value ?? null
}

export function getPreferenceSettingsSnapshot(): PreferenceSettings {
  return resolvePreferenceSettings(getPreferenceSettingsValue())
}