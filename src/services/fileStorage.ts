// File-based storage adapter — persists Zustand state into the workspace.
//
// Data is stored as categorised JSON files within the user-configured workspace:
//   {workspace}/models.json        — provider configs, models, API keys
//   {workspace}/settings.json      — all app settings, plugins, analytics, UI state
//   {workspace}/channels/config.json — channel configs, messages, tokens
//
// Agents, skills and sessions are persisted separately by their own file services
// (agentFiles.ts, skillFiles.ts, sessionFiles.ts) and are NOT duplicated here.
//
// An in-memory cache provides synchronous reads (required by tools.ts
// and other modules that avoid async circular dependencies).
//
// On first load the adapter auto-migrates from the legacy ~/.suora/data/ format.

import {
  prepareModelsDataForSave,
  restoreModelsDataAfterLoad,
  type ElectronBridge,
} from '@/services/secureState'
import { toast } from '@/services/toast'
import { logger } from '@/services/logger'

function getElectron(): ElectronBridge | undefined {
  return (window as unknown as { electron?: ElectronBridge }).electron
}

// ─── In-memory cache ────────────────────────────────────────────────

const cache = new Map<string, string>()

// ─── Workspace file mapping ─────────────────────────────────────────

const SPLIT_STORE_NAME = 'suora-store'

/** Keys that belong in models.json (provider/model configuration) */
const MODELS_KEYS = new Set([
  'providerConfigs', 'models', 'selectedModel', 'apiKeys',
])

/** Keys that belong in channels/config.json */
const CHANNELS_KEYS = new Set([
  'channels', 'channelMessages', 'channelTokens', 'channelHealth', 'channelUsers',
])

/**
 * Keys excluded from settings.json because they are persisted/loaded
 * by their own file services (agentFiles, skillFiles, sessionFiles).
 */
const EXCLUDED_KEYS = new Set([
  'agents', 'selectedAgent',
  'skills',
  'sessions',
])

/** Track last-written JSON per file to skip redundant disk writes */
const lastWritten = new Map<string, string>()
let pendingSplitStoreValue: string | null = null
let activeSplitStoreFlush: Promise<void> | null = null
let splitStoreDebounceTimer: ReturnType<typeof setTimeout> | null = null

const SPLIT_STORE_DEBOUNCE_MS = 250

/**
 * Throttle user-visible toast notifications about write failures so that a
 * persistent disk-full condition does not spam the UI with one toast per
 * debounced write attempt.
 */
const writeFailureToastCooldown = new Map<string, number>()
const WRITE_FAILURE_TOAST_COOLDOWN_MS = 30_000

/**
 * Deferred warnings that could not be shown immediately (e.g. during early
 * initialisation before the toast host is mounted).  Flushed once from
 * fileStateStorage.getItem after the first successful load.
 */
const deferredWarnings: Array<{ title: string; detail: string }> = []
let deferredFlushed = false

function flushDeferredWarnings(): void {
  if (deferredFlushed) return
  deferredFlushed = true
  // Give the UI a moment to mount the ToastHost component.
  setTimeout(() => {
    for (const { title, detail } of deferredWarnings) {
      try { toast.warning(title, detail) } catch { /* still unavailable */ }
    }
    deferredWarnings.length = 0
  }, 2000)
}

function notifyWriteFailure(filePath: string, error: unknown): void {
  const now = Date.now()
  const last = writeFailureToastCooldown.get(filePath) ?? 0
  if (now - last < WRITE_FAILURE_TOAST_COOLDOWN_MS) return
  writeFailureToastCooldown.set(filePath, now)

  const detail = error instanceof Error ? error.message : String(error)
  toast.error(
    'Failed to save to disk',
    `${filePath.split(/[\\/]/).slice(-2).join('/')} — ${detail}`,
  )
}

async function writeIfChanged(electron: ElectronBridge, filePath: string, json: string): Promise<void> {
  if (lastWritten.get(filePath) === json) return

  let lastError: unknown = null
  const backoffMs = [0, 500, 2_000]
  for (const delay of backoffMs) {
    if (delay) await new Promise((resolve) => setTimeout(resolve, delay))
    try {
      const result = await electron.invoke('fs:writeFile', filePath, json)
      // Some handlers return `{ error }` on failure rather than throwing.
      if (result && typeof result === 'object' && 'error' in result && (result as { error?: unknown }).error) {
        lastError = (result as { error: unknown }).error
        continue
      }
      lastWritten.set(filePath, json)
      return
    } catch (err) {
      lastError = err
    }
  }

  if (lastError !== null) {
    console.error('[fileStorage] write failed after retries', { filePath, error: lastError })
    notifyWriteFailure(filePath, lastError)
  }
}

// ─── Resolve workspace path ─────────────────────────────────────────

let _resolvedWorkspacePath = ''

async function resolveWorkspacePath(electron: ElectronBridge): Promise<string> {
  if (_resolvedWorkspacePath) return _resolvedWorkspacePath
  try {
    const boot = (await electron.invoke('workspace:getBootConfig')) as { workspacePath?: string }
    if (boot?.workspacePath) {
      _resolvedWorkspacePath = boot.workspacePath
      return _resolvedWorkspacePath
    }
  } catch { /* fall through */ }
  const defaultPath = (await electron.invoke('system:getDefaultWorkspacePath')) as string
  _resolvedWorkspacePath = defaultPath
  return _resolvedWorkspacePath
}

/** Allow external code to update the cached workspace path */
export function updateCachedWorkspacePath(ws: string): void {
  _resolvedWorkspacePath = ws
}

// ─── Split & save into workspace files ──────────────────────────────

function splitAndSave(fullValue: string, electron: ElectronBridge): void {
  pendingSplitStoreValue = fullValue
  if (activeSplitStoreFlush) return

  activeSplitStoreFlush = (async () => {
    try {
      while (pendingSplitStoreValue !== null) {
        const nextValue = pendingSplitStoreValue
        pendingSplitStoreValue = null
        await persistSplitStore(nextValue, electron)
      }
    } finally {
      activeSplitStoreFlush = null
      if (pendingSplitStoreValue !== null) {
        splitAndSave(pendingSplitStoreValue, electron)
      }
    }
  })()
}

async function persistSplitStore(fullValue: string, electron: ElectronBridge): Promise<void> {
  try {
    const parsed = JSON.parse(fullValue) as { state?: Record<string, unknown>; version?: number }
    const state = parsed.state
    if (!state) return

    const ws = (state.workspacePath as string) || _resolvedWorkspacePath
    if (!ws) return

    if (ws !== _resolvedWorkspacePath) _resolvedWorkspacePath = ws

    // models.json
    const models: Record<string, unknown> = {}
    for (const key of MODELS_KEYS) {
      if (key in state) models[key] = state[key]
    }
    const secureModels = await prepareModelsDataForSave(electron, models)
    const modelsWrite = writeIfChanged(electron, `${ws}/models.json`, JSON.stringify(secureModels, null, 2))

    // channels/config.json
    const channels: Record<string, unknown> = {}
    for (const key of CHANNELS_KEYS) {
      if (key in state) channels[key] = state[key]
    }
    const channelsWrite = writeIfChanged(electron, `${ws}/channels/config.json`, JSON.stringify(channels, null, 2))

    // settings.json — everything not in models, channels, or excluded
    const settings: Record<string, unknown> = {}
    for (const [key, value] of Object.entries(state)) {
      if (MODELS_KEYS.has(key) || CHANNELS_KEYS.has(key) || EXCLUDED_KEYS.has(key)) continue
      settings[key] = value
    }
    settings._storeVersion = parsed.version ?? 0
    const settingsWrite = writeIfChanged(electron, `${ws}/settings.json`, JSON.stringify(settings, null, 2))

    await Promise.all([modelsWrite, channelsWrite, settingsWrite])
  } catch (err) {
    logger.error('[fileStorage] persistSplitStore failed — state kept in memory only', {
      error: err instanceof Error ? err.message : String(err),
    })
  }
}

function scheduleSplitStoreSave(fullValue: string, electron: ElectronBridge): void {
  pendingSplitStoreValue = fullValue
  if (splitStoreDebounceTimer) clearTimeout(splitStoreDebounceTimer)

  splitStoreDebounceTimer = setTimeout(() => {
    splitStoreDebounceTimer = null
    if (pendingSplitStoreValue !== null) {
      splitAndSave(pendingSplitStoreValue, electron)
    }
  }, SPLIT_STORE_DEBOUNCE_MS)
}

export async function flushPendingSplitStoreWrites(): Promise<void> {
  const electron = getElectron()
  if (!electron) return

  if (splitStoreDebounceTimer) {
    clearTimeout(splitStoreDebounceTimer)
    splitStoreDebounceTimer = null
    if (pendingSplitStoreValue !== null) {
      splitAndSave(pendingSplitStoreValue, electron)
    }
  }

  if (activeSplitStoreFlush) {
    await activeSplitStoreFlush
  }
}

// ─── Load from workspace files ──────────────────────────────────────

/**
 * Detect whether a raw fs:readFile result indicates "file not found".
 * The main-process handler returns `{ error: string }` on failure; we treat
 * ENOENT-like messages as missing (benign), everything else as real errors.
 */
function isFileNotFoundError(err: unknown): boolean {
  if (!err) return false
  const msg = typeof err === 'object' && err !== null && 'error' in err
    ? String((err as { error: unknown }).error ?? '')
    : err instanceof Error ? err.message : String(err)
  return /ENOENT|no such file|not found|cannot find/i.test(msg)
}

/**
 * Back up a corrupted JSON file so the user does not silently lose state.
 * Best-effort — if the copy fails (e.g. disk full), we log and move on.
 */
async function backupCorruptFile(electron: ElectronBridge, filePath: string, raw: string): Promise<void> {
  try {
    const stamp = new Date().toISOString().replace(/[:.]/g, '-')
    const backupPath = `${filePath}.corrupt-${stamp}.bak`
    await electron.invoke('fs:writeFile', backupPath, raw)
    logger.warn('[fileStorage] Corrupted state file backed up', { filePath, backupPath })
    try {
      toast.warning(
        'Corrupted state file detected',
        `${filePath.split(/[\\/]/).slice(-2).join('/')} could not be parsed. A backup has been saved to .corrupt-*.bak.`,
      )
    } catch {
      // Toast host not mounted yet — queue for later display.
      deferredWarnings.push({
        title: 'Corrupted state file detected',
        detail: `${filePath.split(/[\\/]/).slice(-2).join('/')} could not be parsed. A backup has been saved to .corrupt-*.bak.`,
      })
    }
  } catch (backupErr) {
    logger.error('[fileStorage] Failed to back up corrupted file', { filePath, error: backupErr })
  }
}

async function loadFromWorkspace(electron: ElectronBridge): Promise<string | null> {
  const ws = await resolveWorkspacePath(electron)
  if (!ws) return null

  const filePaths = [
    `${ws}/models.json`,
    `${ws}/settings.json`,
    `${ws}/channels/config.json`,
  ]

  const merged: Record<string, unknown> = {}
  let found = false
  let version = 0

  for (const fp of filePaths) {
    let raw: string | { error: string } | null = null
    try {
      raw = (await electron.invoke('fs:readFile', fp)) as string | { error: string }
    } catch (err) {
      if (!isFileNotFoundError(err)) {
        logger.error('[fileStorage] Failed to read state file', { filePath: fp, error: err })
      }
      continue
    }

    if (typeof raw !== 'string') {
      // Handler returned `{ error }` — only log non-ENOENT cases
      if (!isFileNotFoundError(raw)) {
        logger.error('[fileStorage] Failed to read state file', { filePath: fp, error: raw })
      }
      continue
    }

    let parsed: Record<string, unknown>
    try {
      parsed = JSON.parse(raw) as Record<string, unknown>
    } catch (parseErr) {
      logger.error('[fileStorage] JSON parse failed — skipping and backing up', {
        filePath: fp,
        error: parseErr instanceof Error ? parseErr.message : String(parseErr),
      })
      await backupCorruptFile(electron, fp, raw)
      continue
    }

    found = true
    lastWritten.set(fp, raw)
    if ('_storeVersion' in parsed) {
      version = (parsed._storeVersion as number) || 0
      delete parsed._storeVersion
    }
    Object.assign(merged, parsed)
  }

  if (!found) return null

  const restoredMerged = await restoreModelsDataAfterLoad(electron, merged)
  const hasProviderConfigs = Array.isArray(restoredMerged.providerConfigs) && restoredMerged.providerConfigs.length > 0
  if (!hasProviderConfigs && Array.isArray(restoredMerged.providers)) {
    restoredMerged.providerConfigs = restoredMerged.providers
  }
  delete restoredMerged.providers
  if (!restoredMerged.workspacePath) restoredMerged.workspacePath = ws
  return JSON.stringify({ state: restoredMerged, version })
}

// ─── Legacy migration ───────────────────────────────────────────────

const LEGACY_CATEGORY_NAMES = ['settings', 'providers', 'agents', 'skills', 'channels', 'plugins', 'analytics', 'ui-state', 'other']
const LEGACY_META_KEY = 'suora-meta'

async function loadLegacySplitStore(electron: ElectronBridge): Promise<string | null> {
  try {
    const metaRaw = (await electron.invoke('store:load', LEGACY_META_KEY)) as string | null
    if (!metaRaw) return null
    const meta = JSON.parse(metaRaw) as { version?: number }
    const results = await Promise.all(
      LEGACY_CATEGORY_NAMES.map(async (cat) => {
        try {
          const raw = (await electron.invoke('store:load', cat)) as string | null
          if (!raw) return {}
          return JSON.parse(raw) as Record<string, unknown>
        } catch { return {} }
      }),
    )
    const merged: Record<string, unknown> = {}
    for (const slice of results) Object.assign(merged, slice)
    return JSON.stringify({ state: merged, version: meta.version ?? 0 })
  } catch {
    return null
  }
}

// ─── Zustand-compatible StateStorage adapter ────────────────────────

/**
 * Custom storage adapter for Zustand persist middleware.
 * Saves store state into workspace files (models.json, settings.json, channels/config.json).
 * Falls back to legacy ~/.suora/data/ format for migration.
 */
export const fileStateStorage = {
  getItem: async (name: string): Promise<string | null> => {
    const cached = cache.get(name)
    if (cached !== undefined) return cached

    const electron = getElectron()

    if (name === SPLIT_STORE_NAME && electron) {
      // 1. Try workspace files
      const wsData = await loadFromWorkspace(electron)
      if (wsData) {
        cache.set(name, wsData)
        flushDeferredWarnings()
        return wsData
      }

      // 2. Migrate from legacy ~/.suora/data/ split format
      const legacyData = await loadLegacySplitStore(electron)
      if (legacyData) {
        cache.set(name, legacyData)
        splitAndSave(legacyData, electron)
        return legacyData
      }

      // 3. Migrate from legacy single file
      try {
        const legacy = (await electron.invoke('store:load', name)) as string | null
        if (legacy !== null) {
          cache.set(name, legacy)
          splitAndSave(legacy, electron)
          return legacy
        }
      } catch { /* fall through */ }
    } else if (electron) {
      try {
        const data = (await electron.invoke('store:load', name)) as string | null
        if (data !== null) {
          cache.set(name, data)
          return data
        }
      } catch { /* fall through */ }
    }

    // 4. Migrate from localStorage (very legacy)
    try {
      const legacy = localStorage.getItem(name)
      if (legacy !== null) {
        cache.set(name, legacy)
        if (electron && name === SPLIT_STORE_NAME) {
          splitAndSave(legacy, electron)
        }
        localStorage.removeItem(name)
        return legacy
      }
    } catch { /* localStorage may not be available */ }

    return null
  },

  setItem: (name: string, value: string): void => {
    cache.set(name, value)
    const electron = getElectron()
    if (!electron) return
    if (name === SPLIT_STORE_NAME) {
      scheduleSplitStoreSave(value, electron)
    }
  },

  removeItem: (name: string): void => {
    cache.delete(name)
  },
}

// ─── Synchronous cache access (for tools.ts et al.) ────────────────

/**
 * Read a value from the in-memory cache.
 * Returns null if the key hasn't been loaded yet.
 */
export function readCached(name: string): string | null {
  return cache.get(name) ?? null
}

/**
 * Write a value to the in-memory cache AND schedule a background
 * disk write via IPC.  The StorageEvent dispatch (if needed) should
 * be done by the caller so Zustand can pick it up.
 */
export function writeCached(name: string, value: string): void {
  cache.set(name, value)
  const electron = getElectron()
  if (electron) {
    electron.invoke('store:save', name, value).catch(() => {})
  }
}

/**
 * Remove a value from cache and disk.
 */
export function removeCached(name: string): void {
  cache.delete(name)
  const electron = getElectron()
  if (electron) {
    electron.invoke('store:remove', name).catch(() => {})
  }
}
