// Filesystem-backed storage adapter — persists Zustand state into workspace JSON files.
//
// The primary store is split across {workspace}/settings.json, models.json, and feature folders.
// Legacy workspace JSON files are read only as a one-time migration fallback:
//   {workspace}/models.json
//   {workspace}/settings.json
//   {workspace}/channels/config.json
//
// Skills remain file/registry-based and are intentionally excluded from the
// filesystem persisted store.
//
// An in-memory cache provides synchronous reads (required by tools.ts
// and other modules that avoid async circular dependencies).
//
// On first load the adapter auto-migrates from the legacy ~/.suora/data/ format.

import {
  prepareModelsDataForSave,
  prepareSensitiveDataForSave,
  restoreModelsDataAfterLoad,
  restoreSensitiveDataAfterLoad,
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

const SKILL_STATE_KEYS = new Set(['skills', 'skillVersions'])

/** Track last-written payloads to skip redundant disk writes */
const lastWritten = new Map<string, string>()
let pendingSplitStoreValue: string | null = null
let activeSplitStoreFlush: Promise<void> | null = null
let splitStoreDebounceTimer: ReturnType<typeof setTimeout> | null = null
let lastSplitStoreError: unknown = null

const SPLIT_STORE_DEBOUNCE_MS = 250

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

// ─── Save into workspace filesystem ─────────────────────────────────

function splitAndSave(fullValue: string, electron: ElectronBridge): void {
  pendingSplitStoreValue = fullValue
  if (activeSplitStoreFlush) return

  activeSplitStoreFlush = (async () => {
    try {
      while (pendingSplitStoreValue !== null) {
        const nextValue = pendingSplitStoreValue
        pendingSplitStoreValue = null
        await persistFilesystemStore(nextValue, electron)
      }
    } finally {
      activeSplitStoreFlush = null
      if (pendingSplitStoreValue !== null) {
        splitAndSave(pendingSplitStoreValue, electron)
      }
    }
  })()
}

function getPersistedVersion(fullValue: string): number {
  try {
    const parsed = JSON.parse(fullValue) as { version?: unknown }
    return typeof parsed.version === 'number' && Number.isFinite(parsed.version) ? Math.trunc(parsed.version) : 0
  } catch {
    return 0
  }
}

async function prepareFilesystemStoreValue(fullValue: string, electron: ElectronBridge): Promise<string> {
  const parsed = JSON.parse(fullValue) as { state?: Record<string, unknown>; version?: number }
  const state = parsed.state
  if (!state) return fullValue

  const nextState: Record<string, unknown> = { ...state }
  for (const key of SKILL_STATE_KEYS) delete nextState[key]

  const modelsProtected = await prepareModelsDataForSave(electron, nextState)
  const fullyProtected = await prepareSensitiveDataForSave(electron, modelsProtected)

  return JSON.stringify({ ...parsed, state: fullyProtected })
}

async function restoreFilesystemStoreValue(fullValue: string, electron: ElectronBridge): Promise<string> {
  const parsed = JSON.parse(fullValue) as { state?: Record<string, unknown>; version?: number }
  const state = parsed.state
  if (!state) return fullValue

  let restoredState = await restoreSensitiveDataAfterLoad(electron, state)
  restoredState = await restoreModelsDataAfterLoad(electron, restoredState)
  for (const key of SKILL_STATE_KEYS) delete restoredState[key]

  const ws = await resolveWorkspacePath(electron)
  if (!restoredState.workspacePath) restoredState.workspacePath = ws

  return JSON.stringify({ ...parsed, state: restoredState })
}

async function persistFilesystemStore(fullValue: string, electron: ElectronBridge): Promise<void> {
  try {
    lastSplitStoreError = null
    const protectedValue = await prepareFilesystemStoreValue(fullValue, electron)
    const cacheKey = `filesystem:${SPLIT_STORE_NAME}`
    if (lastWritten.get(cacheKey) === protectedValue) return

    const result = await electron.invoke('db:savePersistedStore', SPLIT_STORE_NAME, protectedValue, getPersistedVersion(protectedValue))
    if (result && typeof result === 'object' && 'error' in result && (result as { error?: unknown }).error) {
      throw new Error(String((result as { error: unknown }).error))
    }
    lastWritten.set(cacheKey, protectedValue)
  } catch (err) {
    lastSplitStoreError = err
    logger.error('[fileStorage] persistFilesystemStore failed — state kept in memory only', {
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

  if (lastSplitStoreError) {
    const error = lastSplitStoreError
    lastSplitStoreError = null
    throw error instanceof Error ? error : new Error(String(error))
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
    const restoredParsed = fp.endsWith('models.json')
      ? parsed
      : await restoreSensitiveDataAfterLoad(electron, parsed)
    Object.assign(merged, restoredParsed)
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

async function loadFromFilesystem(electron: ElectronBridge, name: string): Promise<string | null> {
  try {
    const result = (await electron.invoke('db:loadPersistedStore', name)) as { success?: boolean; data?: unknown; error?: unknown }
    if (result?.error) {
      logger.error('[fileStorage] Failed to load filesystem app state', { key: name, error: result.error })
      return null
    }
    if (typeof result?.data !== 'string' || result.data.length === 0) return null
    lastWritten.set(`filesystem:${name}`, result.data)
    return await restoreFilesystemStoreValue(result.data, electron)
  } catch (error) {
    logger.error('[fileStorage] Failed to load filesystem app state', { key: name, error })
    return null
  }
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
 * Saves store state into filesystem app state and falls back to older JSON formats
 * only for one-time migration.
 */
export const fileStateStorage = {
  getItem: async (name: string): Promise<string | null> => {
    const cached = cache.get(name)
    if (cached !== undefined) return cached

    const electron = getElectron()

    if (name === SPLIT_STORE_NAME && electron) {
      // 1. Try filesystem app state
      const filesystemData = await loadFromFilesystem(electron, name)
      if (filesystemData) {
        cache.set(name, filesystemData)
        flushDeferredWarnings()
        return filesystemData
      }

      // 2. Migrate from legacy workspace files
      const wsData = await loadFromWorkspace(electron)
      if (wsData) {
        const restored = await restoreFilesystemStoreValue(await prepareFilesystemStoreValue(wsData, electron), electron)
        cache.set(name, restored)
        flushDeferredWarnings()
        splitAndSave(restored, electron)
        return restored
      }

      // 3. Migrate from legacy ~/.suora/data/ split format
      const legacyData = await loadLegacySplitStore(electron)
      if (legacyData) {
        const restored = await restoreFilesystemStoreValue(await prepareFilesystemStoreValue(legacyData, electron), electron)
        cache.set(name, restored)
        splitAndSave(restored, electron)
        return restored
      }

      // 4. Migrate from legacy single file
      try {
        const legacy = (await electron.invoke('store:load', name)) as string | null
        if (legacy !== null) {
          const restored = await restoreFilesystemStoreValue(await prepareFilesystemStoreValue(legacy, electron), electron)
          cache.set(name, restored)
          splitAndSave(restored, electron)
          return restored
        }
      } catch { /* fall through */ }
    } else if (electron) {
      try {
        const result = (await electron.invoke('db:loadPersistedStore', name)) as { data?: unknown; error?: unknown }
        const data = typeof result?.data === 'string' ? result.data : (await electron.invoke('store:load', name)) as string | null
        if (data !== null) {
          cache.set(name, data)
          return data
        }
      } catch { /* fall through */ }
    }

    // 5. Migrate from localStorage (very legacy)
    try {
      const legacy = localStorage.getItem(name)
      if (legacy !== null) {
        cache.set(name, legacy)
        if (electron && name === SPLIT_STORE_NAME) {
          splitAndSave(legacy, electron)
        } else if (electron) {
          void electron.invoke('db:savePersistedStore', name, legacy, getPersistedVersion(legacy)).catch(() => {})
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
    const electron = getElectron()
    if (!electron) return
    if (name === SPLIT_STORE_NAME) {
      if (splitStoreDebounceTimer) {
        clearTimeout(splitStoreDebounceTimer)
        splitStoreDebounceTimer = null
      }
      pendingSplitStoreValue = null
      void electron.invoke('db:deletePersistedStore', SPLIT_STORE_NAME).catch(() => {})
      return
    }
    electron.invoke('db:deletePersistedStore', name).catch(() => {})
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
    electron.invoke('db:savePersistedStore', name, value, getPersistedVersion(value)).catch(() => {})
  }
}

/**
 * Remove a value from cache and disk.
 */
export function removeCached(name: string): void {
  cache.delete(name)
  const electron = getElectron()
  if (electron) {
    electron.invoke('db:deletePersistedStore', name).catch(() => {})
  }
}
