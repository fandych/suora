import { applyPreferenceSettingsToDocument, createDefaultPreferenceSettings, getPreferenceSettings, savePreferenceSettings, validateSystemMailSettings } from "@/data/repositories/preference-repository"
import { checkForUpdates, getSystemDiagnostics, getSystemInfo, getUpdaterState } from "@/data/repositories/system-status-repository"
export type { PreferenceEnvironmentVariable, PreferenceSettings } from "@/data/repositories/preference-repository"
export type { SystemDiagnosticsSnapshot, SystemInfoSnapshot, UpdateCheckResult, UpdaterStateSnapshot } from "@/data/repositories/system-status-repository"

export const preferenceApplicationService = {
  applyToDocument: applyPreferenceSettingsToDocument,
  createDefault: createDefaultPreferenceSettings,
  get: getPreferenceSettings,
  save: savePreferenceSettings,
  validateMail: validateSystemMailSettings,
  checkForUpdates,
  getDiagnostics: getSystemDiagnostics,
  getSystemInfo,
  getUpdaterState,
}
