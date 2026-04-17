// Workspace settings persistence via Electron IPC
// Reads provider configs from {workspace}/models.json and
// external directories from {workspace}/settings.json.
// Also migrates legacy provider storage from settings.json/providers.
import type { ProviderConfig, WorkspaceSettings } from '@/types'
import {
  prepareModelsDataForSave,
  restoreModelsDataAfterLoad,
  type ElectronBridge,
} from '@/services/secureState'

function getElectron(): ElectronBridge | undefined {
  return (window as unknown as { electron?: ElectronBridge }).electron
}

const DEFAULT_SETTINGS: WorkspaceSettings = {
  providers: [],
}

function readProviderConfigs(parsed: Record<string, unknown>): ProviderConfig[] {
  if (Array.isArray(parsed.providerConfigs)) return parsed.providerConfigs as ProviderConfig[]
  if (Array.isArray(parsed.providers)) return parsed.providers as ProviderConfig[]
  return []
}

function stripLegacyProviderKeys(parsed: Record<string, unknown>): Record<string, unknown> {
  const next = { ...parsed }
  delete next.providers
  delete next.providerConfigs
  return next
}

async function loadLegacyProviderConfigs(electron: ElectronBridge): Promise<ProviderConfig[]> {
  try {
    const raw = await electron.invoke('store:load', 'providers')
    if (typeof raw !== 'string') return []
    const parsed = await restoreModelsDataAfterLoad(
      electron,
      JSON.parse(raw) as Record<string, unknown>,
    )
    return readProviderConfigs(parsed)
  } catch {
    return []
  }
}

export async function loadWorkspaceSettings(workspacePath: string): Promise<WorkspaceSettings> {
  const electron = getElectron()
  if (!electron || !workspacePath) return DEFAULT_SETTINGS

  const result: WorkspaceSettings = { ...DEFAULT_SETTINGS }
  const modelsPath = `${workspacePath}/models.json`
  const settingsPath = `${workspacePath}/settings.json`
  let modelsData: Record<string, unknown> = {}
  let settingsData: Record<string, unknown> = {}
  let migratedLegacyProviders = false
  let shouldRewriteSettingsData = false

  // Read provider configs from models.json
  try {
    const raw = await electron.invoke('fs:readFile', modelsPath)
    if (typeof raw === 'string') {
      modelsData = await restoreModelsDataAfterLoad(
        electron,
        JSON.parse(raw) as Record<string, unknown>,
      )
      result.providers = readProviderConfigs(modelsData)
    }
  } catch { /* file may not exist yet */ }

  // Read external directories from settings.json.
  // Older versions also stored providers here, so fall back and migrate if needed.
  try {
    const raw = await electron.invoke('fs:readFile', settingsPath)
    if (typeof raw === 'string') {
      settingsData = JSON.parse(raw) as Record<string, unknown>
      if (Array.isArray(settingsData.externalDirectories)) result.externalDirectories = settingsData.externalDirectories

      if (result.providers.length === 0) {
        const legacyProviders = readProviderConfigs(settingsData)
        if (legacyProviders.length > 0) {
          result.providers = legacyProviders
          migratedLegacyProviders = true
          shouldRewriteSettingsData = true
        }
      }
    }
  } catch { /* file may not exist yet */ }

  if (result.providers.length === 0) {
    const legacyProviders = await loadLegacyProviderConfigs(electron)
    if (legacyProviders.length > 0) {
      result.providers = legacyProviders
      migratedLegacyProviders = true
    }
  }

  if (migratedLegacyProviders && result.providers.length > 0) {
    const nextModelsData = await prepareModelsDataForSave(electron, {
      ...modelsData,
      providerConfigs: result.providers,
    })
    await electron.invoke('fs:writeFile', modelsPath, JSON.stringify(nextModelsData, null, 2)).catch(() => {})

    if (shouldRewriteSettingsData) {
      const cleanedSettingsData = stripLegacyProviderKeys(settingsData)
      await electron.invoke('fs:writeFile', settingsPath, JSON.stringify(cleanedSettingsData, null, 2)).catch(() => {})
    }
  }

  return result
}

export async function saveWorkspaceSettings(
  workspacePath: string,
  settings: WorkspaceSettings,
): Promise<boolean> {
  const electron = getElectron()
  if (!electron || !workspacePath) return false

  try {
    await electron.invoke('system:ensureDirectory', workspacePath)
    const modelsPath = `${workspacePath}/models.json`
    const settingsPath = `${workspacePath}/settings.json`

    // Save providers into models.json (merge with existing)
    let modelsData: Record<string, unknown> = {}
    try {
      const raw = await electron.invoke('fs:readFile', modelsPath)
      if (typeof raw === 'string') {
        modelsData = await restoreModelsDataAfterLoad(
          electron,
          JSON.parse(raw) as Record<string, unknown>,
        )
      }
    } catch { /* file may not exist */ }
    const nextModelsData = await prepareModelsDataForSave(electron, {
      ...modelsData,
      providerConfigs: settings.providers,
    })
    await electron.invoke('fs:writeFile', modelsPath, JSON.stringify(nextModelsData, null, 2))

    // Save externalDirectories into settings.json (merge with existing)
    if (settings.externalDirectories) {
      let settingsData: Record<string, unknown> = {}
      try {
        const raw = await electron.invoke('fs:readFile', settingsPath)
        if (typeof raw === 'string') settingsData = JSON.parse(raw)
      } catch { /* file may not exist */ }
      const nextSettingsData = {
        ...stripLegacyProviderKeys(settingsData),
        externalDirectories: settings.externalDirectories,
      }
      await electron.invoke('fs:writeFile', settingsPath, JSON.stringify(nextSettingsData, null, 2))
    }

    return true
  } catch {
    return false
  }
}
