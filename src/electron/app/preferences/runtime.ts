import { applyMigrations, openDatabase } from "@/electron/infrastructure/db-core"
import { protectCredential, revealCredentialState } from "@/electron/infrastructure/credential-vault"
import { setAppMetaValue } from "@/electron/app/system/system-repository"
import { resolvePreferenceSettings, type PreferenceSettings } from "@/electron/app/preferences/settings"

export function getPreferenceSettingsValue() {
  const database = openDatabase()
  applyMigrations(database)
  const row = database.prepare("SELECT value FROM app_meta WHERE key = 'preference_settings'").get() as
    { value?: string } | undefined
  if (!row?.value) return null
  try {
    const settings = JSON.parse(row.value) as Record<string, unknown>
    if (typeof settings.mailServerPassword === "string") {
      const credential = revealCredentialState(settings.mailServerPassword)
      settings.mailServerPassword = credential.value
      if (credential.legacyPlaintext && credential.value) {
        void setAppMetaValue(
          "preference_settings",
          JSON.stringify({ ...settings, mailServerPassword: protectCredential(credential.value) }),
        )
      }
    }
    return JSON.stringify(settings)
  } catch {
    return row.value
  }
}

export function getPreferenceSettingsSnapshot(): PreferenceSettings {
  return resolvePreferenceSettings(getPreferenceSettingsValue())
}
