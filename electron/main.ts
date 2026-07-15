import { app, BrowserWindow, ipcMain, shell, clipboard, Notification, desktopCapturer, Tray, Menu, globalShortcut, nativeImage, safeStorage, dialog } from 'electron'
import { fileURLToPath } from 'url'
import { createRequire } from 'module'
import path from 'path'
import os from 'os'
import fs from 'fs/promises'
import { readFileSync, watch, type FSWatcher } from 'fs'
import http, { type ClientRequest, type IncomingMessage } from 'http'
import { execFile } from 'child_process'
import crypto from 'crypto'
import https from 'https'
import net from 'net'
import dns from 'dns'
import { CronExpressionParser } from 'cron-parser'
import electronUpdater from 'electron-updater'
import { MAX_IPC_TEXT_FILE_BYTES, atomicWriteFile, canonicalizePathSync, isWithinRoot, readTextFileRange, readTextFileWithLimit, resolveUserPath } from './fsUtils.js'
import { initLogger, getLogger, closeLogger, type LogLevel } from './logger.js'
import { getChannelService, type ChannelWebhookEvent } from './channelService.js'
import { openSuoraDatabase, type JsonTableName, type SuoraDatabase } from './database.js'
import { acquireWorkspaceLock, releaseWorkspaceLock, releaseWorkspaceLockSync, WorkspaceLockError, type WorkspaceLock } from './workspaceLock.js'
import type { ChannelConfig } from '../src/types/index.js'

const { autoUpdater } = electronUpdater

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const require = createRequire(import.meta.url)
const isDev = !app.isPackaged

function isPrivateIPv4(hostname: string): boolean {
  const parts = hostname.split('.').map((part) => Number(part))
  if (parts.length !== 4 || parts.some((part) => !Number.isInteger(part) || part < 0 || part > 255)) return false
  const [a, b] = parts
  return a === 10 || a === 127 || a === 0 || (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168)
}

function isBlockedIp(ip: string): boolean {
  const family = net.isIP(ip)
  if (family === 4) return isPrivateIPv4(ip)
  if (family === 6) {
    const lower = ip.toLowerCase()
    if (lower === '::1' || lower === '0:0:0:0:0:0:0:1') return true
    if (lower.startsWith('fc') || lower.startsWith('fd') || lower.startsWith('fe80:')) return true
    const v4Mapped = lower.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/)
    if (v4Mapped) return isPrivateIPv4(v4Mapped[1])
  }
  return false
}

/**
 * Custom DNS lookup that rejects resolved private/loopback addresses.
 * Used as the `lookup` option for http(s) requests to prevent DNS-rebinding
 * SSRF where a hostname passes string-level checks but resolves at connect
 * time to 127.0.0.1, 169.254.169.254, etc.
 */
function safeDnsLookup(
  hostname: string,
  options: dns.LookupOptions | number,
  callback: (err: NodeJS.ErrnoException | null, address: string | dns.LookupAddress[], family: number) => void,
): void {
  const opts: dns.LookupOptions = typeof options === 'number' ? { family: options } : (options ?? {})
  const wantAll = opts.all === true
  if (wantAll) {
    dns.lookup(hostname, { ...opts, all: true }, (err, addresses) => {
      if (err) {
        ;(callback as (e: NodeJS.ErrnoException | null, a: dns.LookupAddress[], f: number) => void)(err, addresses, 0)
        return
      }
      for (const entry of addresses) {
        if (isBlockedIp(entry.address)) {
          ;(callback as (e: NodeJS.ErrnoException | null, a: dns.LookupAddress[], f: number) => void)(
            new Error(`Blocked private/local network IP for ${hostname}: ${entry.address}`),
            addresses,
            0,
          )
          return
        }
      }
      ;(callback as (e: NodeJS.ErrnoException | null, a: dns.LookupAddress[], f: number) => void)(null, addresses, 0)
    })
    return
  }
  dns.lookup(hostname, { ...opts, all: false }, (err, address, family) => {
    if (err) {
      ;(callback as (e: NodeJS.ErrnoException | null, a: string, f: number) => void)(err, address, family)
      return
    }
    if (isBlockedIp(address)) {
      ;(callback as (e: NodeJS.ErrnoException | null, a: string, f: number) => void)(
        new Error(`Blocked private/local network IP for ${hostname}: ${address}`),
        address,
        family,
      )
      return
    }
    ;(callback as (e: NodeJS.ErrnoException | null, a: string, f: number) => void)(null, address, family)
  })
}

function isBlockedNetworkHost(hostname: string): boolean {
  const normalized = hostname.toLowerCase().replace(/^\[|\]$/g, '')
  if (normalized === 'localhost' || normalized.endsWith('.localhost')) return true
  if (normalized === '::1' || normalized === '0:0:0:0:0:0:0:1') return true
  if (normalized.startsWith('fc') || normalized.startsWith('fd') || normalized.startsWith('fe80:')) return true
  return net.isIP(normalized) === 4 && isPrivateIPv4(normalized)
}

function validatePublicHttpUrl(rawUrl: string, allowedHosts?: ReadonlySet<string>): URL {
  const parsed = new URL(rawUrl)
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    throw new Error('Only http and https URLs are allowed')
  }
  if (allowedHosts && !allowedHosts.has(parsed.hostname.toLowerCase())) {
    throw new Error(`Host not allowed: ${parsed.hostname}`)
  }
  if (isBlockedNetworkHost(parsed.hostname)) {
    throw new Error(`Blocked private or local network host: ${parsed.hostname}`)
  }
  return parsed
}

/**
 * Like {@link validatePublicHttpUrl}, but additionally resolves the hostname
 * via DNS and rejects responses that would point at a private/loopback IP.
 * This catches DNS-rebinding tricks where a public-looking hostname has a
 * private A record (e.g. attacker.example.com → 127.0.0.1).
 */
async function validatePublicHttpUrlWithDns(rawUrl: string, allowedHosts?: ReadonlySet<string>): Promise<URL> {
  const parsed = validatePublicHttpUrl(rawUrl, allowedHosts)
  // If the hostname is already a literal IP, validatePublicHttpUrl handled it.
  if (net.isIP(parsed.hostname) === 0) {
    const records = await dns.promises.lookup(parsed.hostname, { all: true })
    for (const record of records) {
      if (isBlockedIp(record.address)) {
        throw new Error(`Blocked private/local network IP for ${parsed.hostname}: ${record.address}`)
      }
    }
  }
  return parsed
}

function escapeRegExp(value: string): string {
  return value.replace(/[|\\{}()[\]^$+*?.-]/g, '\\$&')
}

function wildcardPatternToRegex(pattern: string): RegExp {
  let re = ''
  for (const char of pattern) {
    if (char === '*') {
      re += '.*'
    } else if (char === '?') {
      re += '.'
    } else {
      re += escapeRegExp(char)
    }
  }
  return new RegExp(`^${re}$`, 'i')
}

function globToRegex(glob: string): RegExp {
  const placeholder = '\u0000DOUBLESTAR\u0000'
  const escaped = glob
    .replace(/\*\*/g, placeholder)
    .split('*')
    .map((part) => part
      .split('?')
      .map((segment) => escapeRegExp(segment))
      .join('[^/\\\\]'))
    .join('[^/\\\\]*')
    .split(placeholder)
    .join('.*')
  return new RegExp(`^${escaped}$`, 'i')
}

function isWithinDirectory(candidatePath: string, directoryPath: string): boolean {
  return isWithinRoot(path.resolve(candidatePath), path.resolve(directoryPath))
}

let mainWindow: BrowserWindow | null = null
let tray: Tray | null = null

// Initialize logger
const logDir = path.join(app.getPath('home'), '.suora', 'logs')
const logger = initLogger(logDir, isDev ? 'debug' : 'info')

logger.info('Suora starting', { isDev, version: app.getVersion() })

// ─── Workspace Path Tracking ────────────────────────────────────────
// All fs:* operations are restricted to this directory.
// It is initialized from the last boot config so early startup code is not unrestricted.
function getDefaultWorkspacePath(): string {
  return path.resolve(path.join(app.getPath('home'), '.suora'))
}

function getBootConfigPath(): string {
  return path.join(getDefaultWorkspacePath(), 'boot-config.json')
}

function loadInitialWorkspacePath(): string {
  try {
    const raw = readFileSync(getBootConfigPath(), 'utf-8')
    let config: { workspacePath?: string }
    try {
      config = JSON.parse(raw) as { workspacePath?: string }
    } catch {
      return getDefaultWorkspacePath()
    }
    if (typeof config.workspacePath === 'string' && config.workspacePath.trim()) {
      return resolveUserPath(config.workspacePath, app.getPath('home'))
    }
  } catch {
    // Fall back to the default workspace root when boot config is missing or invalid.
  }
  return getDefaultWorkspacePath()
}

let currentWorkspacePath: string = loadInitialWorkspacePath()
let currentWorkspaceCanonicalPath: string = canonicalizePathSync(currentWorkspacePath)
let currentExternalDirectoryPaths: string[] = []
let currentExternalDirectoryCanonicalPaths: string[] = []
let currentToolSandboxMode: 'workspace' | 'relaxed' = 'workspace'
let currentToolAllowedDirectoryPaths: string[] = []
let currentToolAllowedDirectoryCanonicalPaths: string[] = []
let currentToolBlockedCommands: string[] = ['rm -rf', 'del /f /q', 'format', 'shutdown']
let currentWorkspaceLock: WorkspaceLock | null = null
let suoraDatabase: SuoraDatabase | null = null
let suoraDatabaseWorkspacePath: string | null = null
let mainWindowRecoveryInProgress = false
const AI_REQUEST_CLIENT_HEADER = 'x-suora-client'
const AI_REQUEST_CLIENT_VALUE = 'suora-desktop-assistant'

const DB_JSON_TABLES = new Set<JsonTableName>([
  'provider_configs',
  'models',
  'agents',
  'skills',
  'channels',
  'channel_messages',
  'mcp_servers',
  'timers',
  'timer_executions',
  'pipelines',
  'pipeline_executions',
  'memories',
])

function refreshAllowedFsRoots(): void {
  currentWorkspaceCanonicalPath = canonicalizePathSync(currentWorkspacePath)
  currentExternalDirectoryCanonicalPaths = currentExternalDirectoryPaths.map((entry) => canonicalizePathSync(entry))
  currentToolAllowedDirectoryCanonicalPaths = currentToolAllowedDirectoryPaths.map((entry) => canonicalizePathSync(entry))
}

function normalizeSandboxMode(value: unknown): 'workspace' | 'relaxed' {
  return value === 'relaxed' ? 'relaxed' : 'workspace'
}

function isJsonTableName(table: unknown): table is JsonTableName {
  return typeof table === 'string' && DB_JSON_TABLES.has(table as JsonTableName)
}

function isLogLevel(value: unknown): value is LogLevel {
  return value === 'debug' || value === 'info' || value === 'warn' || value === 'error'
}

function normalizeIpcLogMessage(value: unknown): string {
  const text = typeof value === 'string'
    ? value
    : value instanceof Error
      ? value.message
      : String(value)
  return text.length <= 10_000 ? text : `${text.slice(0, 10_000)}…[truncated]`
}

function validateDatabaseKey(key: unknown, label: string): string | null {
  if (typeof key !== 'string' || !key.trim()) return `${label} is required`
  if (key.length > 256) return `${label} is too long`
  return null
}

async function closeSuoraDatabase(): Promise<void> {
  if (!suoraDatabase) return
  const databaseToClose = suoraDatabase
  suoraDatabase = null
  suoraDatabaseWorkspacePath = null
  await databaseToClose.close()
}

function formatWorkspaceLockMessage(error: WorkspaceLockError): string {
  const owner = error.existing?.pid ? `PID ${error.existing.pid}` : 'another running Suora process'
  return `This workspace is already open by ${owner}.\n\nWorkspace:\n${error.workspacePath}\n\nClose the installed app or the dev app that is using this workspace, then start Suora again. This prevents API keys and other encrypted settings from being overwritten by two running copies.`
}

async function acquireInitialWorkspaceLock(): Promise<boolean> {
  try {
    currentWorkspaceLock = await acquireWorkspaceLock(currentWorkspacePath)
    return true
  } catch (error) {
    if (error instanceof WorkspaceLockError) {
      const message = formatWorkspaceLockMessage(error)
      logger.error('Workspace lock acquisition failed', { workspacePath: error.workspacePath, pid: error.existing?.pid })
      dialog.showErrorBox('SUORA workspace already open', message)
      return false
    }
    throw error
  }
}

async function switchWorkspaceLock(nextWorkspacePath: string): Promise<{ success: true } | { error: string; code?: string }> {
  const nextResolvedPath = path.resolve(nextWorkspacePath)
  const sameWorkspace = currentWorkspaceLock && path.resolve(currentWorkspaceLock.workspacePath) === nextResolvedPath
  if (sameWorkspace) return { success: true }

  let nextLock: WorkspaceLock
  try {
    nextLock = await acquireWorkspaceLock(nextResolvedPath)
  } catch (error) {
    if (error instanceof WorkspaceLockError) {
      logger.warn('Workspace switch blocked by active lock', { workspacePath: error.workspacePath, pid: error.existing?.pid })
      return { error: formatWorkspaceLockMessage(error), code: 'WORKSPACE_LOCKED' }
    }
    return { error: error instanceof Error ? error.message : String(error) }
  }

  await releaseWorkspaceLock(currentWorkspaceLock)
  currentWorkspaceLock = nextLock
  return { success: true }
}

async function getSuoraDatabase(): Promise<SuoraDatabase> {
  if (suoraDatabase && suoraDatabaseWorkspacePath === currentWorkspacePath) return suoraDatabase
  await closeSuoraDatabase()
  suoraDatabase = await openSuoraDatabase(currentWorkspacePath)
  suoraDatabaseWorkspacePath = currentWorkspacePath
  return suoraDatabase
}

async function createWindow() {
  const preloadPath = path.join(__dirname, '../preload/preload.cjs')
  const windowState = await loadWindowState()

  mainWindow = new BrowserWindow({
    width: windowState.width,
    height: windowState.height,
    x: windowState.x,
    y: windowState.y,
    minWidth: 1200,
    minHeight: 700,
    autoHideMenuBar: true,
    show: false,
    backgroundColor: '#0b0b10',
    icon: path.join(__dirname, '../../resources/icons/icon-256x256.png'),
    webPreferences: {
      preload: preloadPath,
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true,
      backgroundThrottling: false,
    },
  })

  if (windowState.isMaximized) {
    mainWindow.maximize()
  }

  mainWindow.setMenuBarVisibility(false)

  // Avoid a visible white flash by showing only once the renderer has
  // produced its first frame.
  mainWindow.once('ready-to-show', () => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.show()
    }
  })

  // Security: deny popups and external navigations from the renderer.
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    try {
      const parsed = new URL(url)
      if (parsed.protocol === 'http:' || parsed.protocol === 'https:') {
        shell.openExternal(url)
      }
    } catch {
      // Ignore malformed URLs
    }
    return { action: 'deny' }
  })
  mainWindow.webContents.on('will-navigate', (event, navUrl) => {
    // Allow the dev server URL and the local renderer file. Block everything
    // else (deep links go through `deep-link` IPC, not navigation).
    const devUrl = process.env['ELECTRON_RENDERER_URL']
    if (devUrl && navUrl.startsWith(devUrl)) return
    if (navUrl.startsWith('file://')) return
    event.preventDefault()
  })
  mainWindow.webContents.on('will-attach-webview', (event) => {
    event.preventDefault()
  })

  mainWindow.webContents.on('render-process-gone', (_event, details) => {
    logger.error('Main renderer process gone', { reason: details.reason, exitCode: details.exitCode })
    reloadMainWindowContent(`render-process-gone:${details.reason}`)
  })

  mainWindow.webContents.on('unresponsive', () => {
    logger.warn('Main renderer became unresponsive')
  })

  mainWindow.webContents.on('responsive', () => {
    logger.info('Main renderer became responsive')
  })

  mainWindow.on('restore', () => {
    recoverMainWindowAfterVisibilityChange('restore')
  })

  mainWindow.on('show', () => {
    recoverMainWindowAfterVisibilityChange('show')
  })

  loadMainWindowContent(mainWindow)

  // Save window state on resize/move/close
  mainWindow.on('close', () => {
    if (mainWindow) saveWindowState(mainWindow)
  })

  // Minimize to tray instead of closing on macOS
  mainWindow.on('closed', () => {
    mainWindow = null
  })
}

function loadMainWindowContent(window: BrowserWindow): void {
  if (isDev && process.env['ELECTRON_RENDERER_URL']) {
    void window.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    void window.loadFile(path.join(__dirname, '../renderer/index.html'))
  }
}

function reloadMainWindowContent(reason: string): void {
  const window = mainWindow
  if (!window || window.isDestroyed() || mainWindowRecoveryInProgress) return
  mainWindowRecoveryInProgress = true
  logger.warn('Reloading main window renderer', { reason })
  loadMainWindowContent(window)
  const finishRecovery = () => {
    mainWindowRecoveryInProgress = false
  }
  window.webContents.once('did-finish-load', finishRecovery)
  window.webContents.once('did-fail-load', (_event, errorCode, errorDescription) => {
    logger.error('Main window renderer reload failed', { reason, errorCode, errorDescription })
    finishRecovery()
  })
  setTimeout(finishRecovery, 5000)
}

function recoverMainWindowAfterVisibilityChange(reason: string): void {
  const window = mainWindow
  if (!window || window.isDestroyed()) return
  setTimeout(() => {
    if (!mainWindow || mainWindow.isDestroyed() || mainWindow !== window || window.webContents.isDestroyed()) return
    window.webContents.focus()
    const currentUrl = window.webContents.getURL()
    if (window.webContents.isCrashed() || !currentUrl || currentUrl === 'about:blank') {
      reloadMainWindowContent(reason)
    }
  }, 100)
}

// ─── IPC Handlers: System ──────────────────────────────────────────

ipcMain.handle('system:getDefaultWorkspacePath', () => {
  return getDefaultWorkspacePath()
})

ipcMain.handle('system:homePath', () => {
  return app.getPath('home')
})

ipcMain.handle('system:ensureDirectory', async (_event, dirPath: string) => {
  try {
    const pathErr = enforceFsPathInWorkspace(dirPath)
    if (pathErr) return { error: pathErr }
    await fs.mkdir(dirPath, { recursive: true })
    return { success: true }
  } catch (err: unknown) {
    return { error: err instanceof Error ? err.message : String(err) }
  }
})

// ─── Workspace Initialisation IPC ──────────────────────────────────

ipcMain.handle('workspace:init', async (_event, workspacePath: string) => {
  try {
    if (!workspacePath.trim()) {
      return { error: 'Workspace path is required' }
    }
    const resolved = resolveUserPath(workspacePath, app.getPath('home'))
    await fs.mkdir(resolved, { recursive: true })
    const stat = await fs.stat(resolved)
    if (!stat.isDirectory()) {
      return { error: 'Workspace path must be a directory' }
    }

    const lockResult = await switchWorkspaceLock(resolved)
    if ('error' in lockResult) return lockResult

    const workspaceChanged = currentWorkspacePath !== resolved
    currentWorkspacePath = resolved
    refreshAllowedFsRoots()
    if (workspaceChanged) await closeSuoraDatabase()
    // Persist the last-used workspace path so the app knows where to look on next launch
    const bootConfigPath = getBootConfigPath()
    await atomicWriteFile(bootConfigPath, JSON.stringify({ workspacePath: resolved }))
    logger.info('Workspace initialised', { workspacePath: resolved })
    return { success: true, workspacePath: resolved }
  } catch (err: unknown) {
    return { error: err instanceof Error ? err.message : String(err) }
  }
})

ipcMain.handle('workspace:setExternalDirectories', async (_event, directories: string[]) => {
  try {
    currentExternalDirectoryPaths = Array.isArray(directories)
      ? directories
          .filter((entry): entry is string => typeof entry === 'string' && entry.trim().length > 0)
          .map((entry) => resolveUserPath(entry, app.getPath('home')))
      : []
    refreshAllowedFsRoots()
    return { success: true, count: currentExternalDirectoryPaths.length }
  } catch (err: unknown) {
    return { error: err instanceof Error ? err.message : String(err) }
  }
})

ipcMain.handle('workspace:setToolSecurity', async (_event, settings: unknown) => {
  try {
    const candidate = settings && typeof settings === 'object' ? settings as { sandboxMode?: unknown; allowedDirectories?: unknown; blockedCommands?: unknown } : {}
    currentToolSandboxMode = normalizeSandboxMode(candidate.sandboxMode)
    currentToolAllowedDirectoryPaths = Array.isArray(candidate.allowedDirectories)
      ? candidate.allowedDirectories
          .filter((entry): entry is string => typeof entry === 'string' && entry.trim().length > 0)
          .map((entry) => resolveUserPath(entry, app.getPath('home')))
      : []
    currentToolBlockedCommands = Array.isArray(candidate.blockedCommands)
      ? candidate.blockedCommands.filter((entry): entry is string => typeof entry === 'string' && entry.trim().length > 0)
      : []
    refreshAllowedFsRoots()
    return { success: true, sandboxMode: currentToolSandboxMode, allowedDirectoryCount: currentToolAllowedDirectoryPaths.length }
  } catch (err: unknown) {
    return { error: err instanceof Error ? err.message : String(err) }
  }
})

ipcMain.handle('workspace:getBootConfig', async () => {
  try {
    const bootConfigPath = getBootConfigPath()
    const data = await fs.readFile(bootConfigPath, 'utf-8')
    let config: { workspacePath?: string }
    try {
      config = JSON.parse(data) as { workspacePath?: string }
    } catch {
      return { workspacePath: currentWorkspacePath }
    }
    if (typeof config.workspacePath === 'string' && config.workspacePath.trim()) {
      return { workspacePath: path.resolve(config.workspacePath) }
    }
    return { workspacePath: currentWorkspacePath }
  } catch {
    return { workspacePath: currentWorkspacePath }
  }
})

/**
 * Enforce that a given file-system path is within the current workspace.
 * Returns an error string if the path is outside the workspace, or null if OK.
 * During early boot, the current workspace is restored from boot config or falls back
 * to the default workspace root, so unrestricted access is avoided.
 */
function enforceFsPathInWorkspace(targetPath: string): string | null {
  if (currentToolSandboxMode === 'relaxed') return null
  if (!currentWorkspacePath) {
    logger.warn('Blocked fs operation before workspace initialisation', { targetPath })
    return 'Workspace is not initialized yet'
  }
  const resolved = canonicalizePathSync(resolveUserPath(targetPath, app.getPath('home')))
  if (isWithinRoot(resolved, currentWorkspaceCanonicalPath)) {
    return null
  }
  if (currentExternalDirectoryCanonicalPaths.some((externalRoot) => isWithinRoot(resolved, externalRoot))) {
    return null
  }
  if (currentToolAllowedDirectoryCanonicalPaths.some((allowedRoot) => isWithinRoot(resolved, allowedRoot))) {
    return null
  }
  logger.warn('Blocked fs operation outside workspace', { targetPath: resolved, workspace: currentWorkspaceCanonicalPath })
  return `Path is outside the workspace: ${targetPath}`
}

// ─── IPC Handlers: Workspace JSON Store ────────────────────────────

ipcMain.handle('db:getSnapshot', async () => {
  try {
    const database = await getSuoraDatabase()
    return { success: true, path: database.path, data: await database.getSnapshot() }
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err)
    logger.error('db:getSnapshot failed', { error: message })
    return { error: message }
  }
})

ipcMain.handle('db:saveStateSlice', async (_event, key: unknown, value: unknown) => {
  try {
    const keyError = validateDatabaseKey(key, 'State slice key')
    if (keyError) return { error: keyError }
    const database = await getSuoraDatabase()
    await database.saveStateSlice(key as string, value)
    return { success: true }
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err)
    logger.error('db:saveStateSlice failed', { error: message })
    return { error: message }
  }
})

ipcMain.handle('db:loadPersistedStore', async (_event, key: unknown) => {
  try {
    const keyError = validateDatabaseKey(key, 'Persisted store key')
    if (keyError) return { error: keyError }
    const database = await getSuoraDatabase()
    return { success: true, data: await database.getPersistedStore(key as string) }
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err)
    logger.error('db:loadPersistedStore failed', { error: message })
    return { error: message }
  }
})

ipcMain.handle('db:savePersistedStore', async (_event, key: unknown, value: unknown, version: unknown) => {
  try {
    const keyError = validateDatabaseKey(key, 'Persisted store key')
    if (keyError) return { error: keyError }
    if (typeof value !== 'string' || !value.trim()) return { error: 'Persisted store value is required' }
    // Reject pathologically large payloads so a buggy/compromised renderer
    // can't blow up the workspace database.
    const MAX_PERSISTED_STORE_BYTES = 32 * 1024 * 1024
    if (value.length > MAX_PERSISTED_STORE_BYTES) {
      return { error: `Persisted store value exceeds ${MAX_PERSISTED_STORE_BYTES} bytes (${value.length})` }
    }
    const parsedVersion = typeof version === 'number' && Number.isFinite(version) ? Math.trunc(version) : 0
    const database = await getSuoraDatabase()
    await database.savePersistedStore(key as string, value, parsedVersion)
    return { success: true }
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err)
    logger.error('db:savePersistedStore failed', { error: message })
    return { error: message }
  }
})

ipcMain.handle('db:deletePersistedStore', async (_event, key: unknown) => {
  try {
    const keyError = validateDatabaseKey(key, 'Persisted store key')
    if (keyError) return { error: keyError }
    const database = await getSuoraDatabase()
    await database.deletePersistedStore(key as string)
    return { success: true }
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err)
    logger.error('db:deletePersistedStore failed', { error: message })
    return { error: message }
  }
})

ipcMain.handle('db:listEntities', async (_event, table: unknown) => {
  try {
    if (!isJsonTableName(table)) return { error: 'Unsupported database table' }
    const database = await getSuoraDatabase()
    return { success: true, data: await database.listJsonTable(table) }
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err)
    logger.error('db:listEntities failed', { error: message })
    return { error: message }
  }
})

ipcMain.handle('db:saveEntity', async (_event, table: unknown, id: unknown, value: unknown) => {
  try {
    if (!isJsonTableName(table)) return { error: 'Unsupported database table' }
    const idError = validateDatabaseKey(id, 'Entity id')
    if (idError) return { error: idError }
    const database = await getSuoraDatabase()
    await database.saveJsonEntity(table, id as string, value)
    return { success: true }
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err)
    logger.error('db:saveEntity failed', { error: message })
    return { error: message }
  }
})

ipcMain.handle('db:deleteEntity', async (_event, table: unknown, id: unknown) => {
  try {
    if (!isJsonTableName(table)) return { error: 'Unsupported database table' }
    const idError = validateDatabaseKey(id, 'Entity id')
    if (idError) return { error: idError }
    const database = await getSuoraDatabase()
    await database.deleteJsonEntity(table, id as string)
    return { success: true }
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err)
    logger.error('db:deleteEntity failed', { error: message })
    return { error: message }
  }
})

// ─── IPC Handlers: Safe Storage (API Key Encryption) ───────────────

ipcMain.handle('safe-storage:encrypt', (_event, plaintext: string) => {
  try {
    if (typeof plaintext !== 'string') return { error: 'Plaintext must be a string' }
    if (Buffer.byteLength(plaintext, 'utf-8') > 1024 * 1024) return { error: 'Plaintext is too large to encrypt' }
    if (!safeStorage.isEncryptionAvailable()) {
      return { error: 'Encryption not available on this system' }
    }
    const encrypted = safeStorage.encryptString(plaintext)
    return { data: encrypted.toString('base64') }
  } catch (err: unknown) {
    return { error: err instanceof Error ? err.message : String(err) }
  }
})

ipcMain.handle('safe-storage:decrypt', (_event, encryptedBase64: string) => {
  try {
    if (typeof encryptedBase64 !== 'string') return { error: 'Encrypted payload must be a string' }
    if (Buffer.byteLength(encryptedBase64, 'utf-8') > 2 * 1024 * 1024) return { error: 'Encrypted payload is too large to decrypt' }
    if (!safeStorage.isEncryptionAvailable()) {
      return { error: 'Encryption not available on this system' }
    }
    const buffer = Buffer.from(encryptedBase64, 'base64')
    const decrypted = safeStorage.decryptString(buffer)
    return { data: decrypted }
  } catch (err: unknown) {
    return { error: err instanceof Error ? err.message : String(err) }
  }
})

ipcMain.handle('safe-storage:isAvailable', () => {
  return safeStorage.isEncryptionAvailable()
})

// ─── IPC Handlers: App Settings ────────────────────────────────────

ipcMain.handle('app:setAutoStart', (_event, enabled: boolean) => {
  try {
    app.setLoginItemSettings({
      openAtLogin: enabled,
      openAsHidden: true,
    })
    return { success: true }
  } catch (err: unknown) {
    return { error: err instanceof Error ? err.message : String(err) }
  }
})

ipcMain.handle('app:getAutoStart', () => {
  try {
    const settings = app.getLoginItemSettings()
    return { enabled: settings.openAtLogin }
  } catch {
    return { enabled: false }
  }
})

// ─── IPC Handlers: File System ─────────────────────────────────────

ipcMain.handle('fs:listDir', async (_event, dirPath: string) => {
  try {
    const pathErr = enforceFsPathInWorkspace(dirPath)
    if (pathErr) return { error: pathErr }
    const entries = await fs.readdir(dirPath, { withFileTypes: true })
    return Promise.all(entries.map(async (e) => {
      const entryPath = path.join(dirPath, e.name)
      const stat = e.isFile() ? await fs.stat(entryPath).catch(() => null) : null
      return {
        name: e.name,
        isDirectory: e.isDirectory(),
        path: entryPath,
        ...(stat?.isFile() ? { size: stat.size } : {}),
      }
    }))
  } catch (err: unknown) {
    return { error: err instanceof Error ? err.message : String(err) }
  }
})

ipcMain.handle('fs:readFile', async (_event, filePath: string) => {
  try {
    const pathErr = enforceFsPathInWorkspace(filePath)
    if (pathErr) return { error: pathErr }
    return await readTextFileWithLimit(filePath)
  } catch (err: unknown) {
    return { error: err instanceof Error ? err.message : String(err) }
  }
})

ipcMain.handle('fs:readFileRange', async (_event, filePath: string, startLine?: number, endLine?: number) => {
  try {
    const pathErr = enforceFsPathInWorkspace(filePath)
    if (pathErr) return { error: pathErr }
    if (startLine === undefined && endLine === undefined) {
      return await readTextFileWithLimit(filePath)
    }
    return await readTextFileRange(filePath, startLine, endLine)
  } catch (err: unknown) {
    return { error: err instanceof Error ? err.message : String(err) }
  }
})

ipcMain.handle('fs:writeFile', async (_event, filePath: string, content: string) => {
  try {
    const pathErr = enforceFsPathInWorkspace(filePath)
    if (pathErr) return { error: pathErr }
    await atomicWriteFile(filePath, content)
    return { success: true }
  } catch (err: unknown) {
    return { error: err instanceof Error ? err.message : String(err) }
  }
})

ipcMain.handle('fs:writeBinaryFile', async (_event, filePath: string, base64Content: string) => {
  try {
    const pathErr = enforceFsPathInWorkspace(filePath)
    if (pathErr) return { error: pathErr }
    const buffer = Buffer.from(base64Content, 'base64')
    await atomicWriteFile(filePath, buffer)
    return { success: true }
  } catch (err: unknown) {
    return { error: err instanceof Error ? err.message : String(err) }
  }
})

ipcMain.handle('fs:appendFile', async (_event, filePath: string, content: string) => {
  try {
    const pathErr = enforceFsPathInWorkspace(filePath)
    if (pathErr) return { error: pathErr }
    await fs.mkdir(path.dirname(filePath), { recursive: true })
    await fs.appendFile(filePath, content, 'utf8')
    return { success: true }
  } catch (err: unknown) {
    return { error: err instanceof Error ? err.message : String(err) }
  }
})

ipcMain.handle('fs:deleteFile', async (_event, filePath: string) => {
  try {
    const pathErr = enforceFsPathInWorkspace(filePath)
    if (pathErr) return { error: pathErr }
    await fs.unlink(filePath)
    return { success: true }
  } catch (err: unknown) {
    if ((err as NodeJS.ErrnoException).code === 'ENOENT') return { success: true }
    return { error: err instanceof Error ? err.message : String(err) }
  }
})

ipcMain.handle('fs:deleteDir', async (_event, dirPath: string) => {
  try {
    const pathErr = enforceFsPathInWorkspace(dirPath)
    if (pathErr) return { error: pathErr }
    const target = canonicalizePathSync(resolveUserPath(dirPath, app.getPath('home')))
    if (target === currentWorkspaceCanonicalPath || currentExternalDirectoryCanonicalPaths.includes(target)) {
      return { error: 'Refusing to delete a workspace or external directory root' }
    }
    await fs.rm(dirPath, { recursive: true, force: true })
    return { success: true }
  } catch (err: unknown) {
    return { error: err instanceof Error ? err.message : String(err) }
  }
})

ipcMain.handle('fs:moveFile', async (_event, srcPath: string, destPath: string) => {
  try {
    const srcErr = enforceFsPathInWorkspace(srcPath)
    if (srcErr) return { error: srcErr }
    const destErr = enforceFsPathInWorkspace(destPath)
    if (destErr) return { error: destErr }
    await fs.mkdir(path.dirname(destPath), { recursive: true })
    await fs.rename(srcPath, destPath)
    return { success: true }
  } catch (err: unknown) {
    // Cross-device rename fallback: copy + delete
    if ((err as NodeJS.ErrnoException).code === 'EXDEV') {
      try {
        await fs.copyFile(srcPath, destPath)
        await fs.unlink(srcPath)
        return { success: true }
      } catch (copyErr: unknown) {
        return { error: copyErr instanceof Error ? copyErr.message : String(copyErr) }
      }
    }
    return { error: err instanceof Error ? err.message : String(err) }
  }
})

ipcMain.handle('fs:copyFile', async (_event, srcPath: string, destPath: string) => {
  try {
    const srcErr = enforceFsPathInWorkspace(srcPath)
    if (srcErr) return { error: srcErr }
    const destErr = enforceFsPathInWorkspace(destPath)
    if (destErr) return { error: destErr }
    await fs.mkdir(path.dirname(destPath), { recursive: true })
    await fs.copyFile(srcPath, destPath)
    return { success: true }
  } catch (err: unknown) {
    return { error: err instanceof Error ? err.message : String(err) }
  }
})

ipcMain.handle('fs:stat', async (_event, filePath: string) => {
  try {
    const pathErr = enforceFsPathInWorkspace(filePath)
    if (pathErr) return { error: pathErr }
    const stat = await fs.stat(filePath)
    return {
      size: stat.size,
      isFile: stat.isFile(),
      isDirectory: stat.isDirectory(),
      createdAt: stat.birthtime.toISOString(),
      modifiedAt: stat.mtime.toISOString(),
      accessedAt: stat.atime.toISOString(),
      permissions: stat.mode.toString(8),
    }
  } catch (err: unknown) {
    return { error: err instanceof Error ? err.message : String(err) }
  }
})

// ─── IPC Handlers: Iconify Offline Icons ───────────────────────────

// Resolve the @iconify/json package directory
function getIconifyJsonDir(): string {
  try {
    const pkgPath = require.resolve('@iconify/json/package.json')
    return path.join(path.dirname(pkgPath), 'json')
  } catch {
    // Fallback: try relative to node_modules
    return path.join(__dirname, '../../node_modules/@iconify/json/json')
  }
}

ipcMain.handle('iconify:listCollections', async () => {
  try {
    const collectionsPath = path.join(path.dirname(require.resolve('@iconify/json/package.json')), 'collections.json')
    const raw = await fs.readFile(collectionsPath, 'utf-8')
    let data: Record<string, { name: string; total: number; category?: string }>
    try {
      data = JSON.parse(raw) as Record<string, { name: string; total: number; category?: string }>
    } catch {
      logger.error('Failed to parse icon collections JSON')
      return []
    }
    return Object.entries(data).map(([prefix, meta]) => ({
      prefix,
      name: meta.name,
      total: meta.total,
      category: meta.category,
    }))
  } catch (err: unknown) {
    logger.error('Failed to list icon collections', { error: err instanceof Error ? err.message : String(err) })
    return []
  }
})

ipcMain.handle('iconify:loadCollection', async (_event, prefix: string) => {
  try {
    // Validate prefix to prevent path traversal
    if (!/^[a-z0-9-]+$/.test(prefix)) return null
    const jsonDir = getIconifyJsonDir()
    const filePath = path.join(jsonDir, `${prefix}.json`)
    // Ensure the resolved path is within the expected directory
    const resolvedPath = path.resolve(filePath)
    if (!isWithinDirectory(resolvedPath, jsonDir)) return null
    const raw = await fs.readFile(resolvedPath, 'utf-8')
    try {
      return JSON.parse(raw)
    } catch {
      logger.error('Failed to parse icon collection JSON', { prefix })
      return null
    }
  } catch (err: unknown) {
    logger.error('Failed to load icon collection', { prefix, error: err instanceof Error ? err.message : String(err) })
    return null
  }
})

ipcMain.handle('iconify:getIconNames', async (_event, prefix: string) => {
  try {
    if (!/^[a-z0-9-]+$/.test(prefix)) return []
    const jsonDir = getIconifyJsonDir()
    const filePath = path.join(jsonDir, `${prefix}.json`)
    const resolvedPath = path.resolve(filePath)
    if (!isWithinDirectory(resolvedPath, jsonDir)) return []
    const raw = await fs.readFile(resolvedPath, 'utf-8')
    let data: { icons?: Record<string, unknown> }
    try {
      data = JSON.parse(raw)
    } catch {
      logger.error('Failed to parse icon names JSON', { prefix })
      return []
    }
    return data.icons ? Object.keys(data.icons) : []
  } catch (err: unknown) {
    logger.error('Failed to get icon names', { prefix, error: err instanceof Error ? err.message : String(err) })
    return []
  }
})

type CommandResult = {
  stdout: string
  stderr: string
  error?: string
}

function runGitCommand(cwd: string, args: string[]): Promise<CommandResult> {
  return new Promise((resolve) => {
    execFile(
      'git',
      args,
      {
        cwd,
        timeout: 30_000,
        maxBuffer: 1024 * 1024,
        windowsHide: true,
      },
      (error, stdout, stderr) => {
        resolve({
          stdout: stdout || '',
          stderr: stderr || '',
          error: error ? (stderr.trim() || error.message) : undefined,
        })
      },
    )
  })
}

function normalizeGitPathspec(repoRoot: string, targetPath: string): { pathspec?: string; error?: string } {
  const trimmed = targetPath.trim()
  if (!trimmed) return { error: 'Git path is required' }

  if (!path.isAbsolute(trimmed)) {
    return { pathspec: trimmed }
  }

  const resolvedPath = canonicalizePathSync(resolveUserPath(trimmed, app.getPath('home')))
  if (!isWithinRoot(resolvedPath, repoRoot)) {
    return { error: `Path is outside the repository: ${targetPath}` }
  }

  return {
    pathspec: path.relative(repoRoot, resolvedPath).split(path.sep).join('/') || '.',
  }
}

async function resolveGitRepository(repoPath: string): Promise<{ repoRoot?: string; error?: string }> {
  const resolvedRepoPath = resolveUserPath(repoPath, app.getPath('home'))
  const pathError = enforceFsPathInWorkspace(resolvedRepoPath)
  if (pathError) return { error: pathError }

  const result = await runGitCommand(resolvedRepoPath, ['rev-parse', '--show-toplevel'])
  if (result.error) {
    return { error: result.error }
  }

  const repoRootRaw = result.stdout.trim()
  if (!repoRootRaw) {
    return { error: `Git repository not found: ${repoPath}` }
  }

  const repoRoot = canonicalizePathSync(repoRootRaw)
  const repoRootError = enforceFsPathInWorkspace(repoRoot)
  if (repoRootError) return { error: repoRootError }

  return { repoRoot }
}

// ─── IPC Handlers: Shell ───────────────────────────────────────────

/**
 * Security: shell:exec is hardened against command-injection.
 *
 * The renderer can request execution of a single command-line. The main
 * process:
 *   1. Rejects any shell metacharacters that allow chaining / subshells
 *      / redirections ( | ; & $ ` < > ( ) { } newline ).
 *   2. Tokenises the rest using a simple quote-aware splitter.
 *   3. Requires the first token (binary) to be on a conservative allowlist.
 *   4. Executes with `execFile` (no shell) so arguments are never re-parsed.
 *
 * This replaces the previous `exec(cmd, { shell })` path which was vulnerable
 * to substring-based blocklist bypasses (e.g. `rm -r -f`, `$(...)`, pipes).
 */
const SHELL_EXEC_BINARY_ALLOWLIST: ReadonlySet<string> = new Set([
  // Version control
  'git',
  // Package managers (read-only queries)
  'npm', 'pnpm', 'yarn',
  // Runtimes
  'node', 'python', 'python3', 'pip', 'pip3',
  // Basic inspection
  'echo', 'pwd', 'cat', 'ls', 'dir', 'type', 'where', 'which',
  'whoami', 'hostname', 'date', 'time',
  // Networking (read-only)
  'curl', 'ping',
])

const SHELL_FORBIDDEN_METACHARS = /[|;&`$<>(){}\n\r\\]/

/** Parse a command string into tokens, respecting single and double quotes. */
function tokenizeShellCommand(input: string): string[] | null {
  const tokens: string[] = []
  let current = ''
  let quote: '"' | "'" | null = null

  for (let i = 0; i < input.length; i++) {
    const ch = input[i]
    if (quote) {
      if (ch === quote) {
        quote = null
      } else {
        current += ch
      }
      continue
    }
    if (ch === '"' || ch === "'") {
      quote = ch
      continue
    }
    if (ch === ' ' || ch === '\t') {
      if (current) { tokens.push(current); current = '' }
      continue
    }
    current += ch
  }

  if (quote) return null // unterminated quote
  if (current) tokens.push(current)
  return tokens
}

function getBinaryName(fullPath: string): string {
  // Strip drive / directory and extension to get the bare binary name.
  const bare = path.basename(fullPath).toLowerCase()
  return bare.replace(/\.(exe|cmd|bat|ps1|sh)$/i, '')
}

function findBlockedCommandPattern(command: string, blockedCommands: string[]): string | undefined {
  const normalizedCommand = command.toLowerCase()

  return blockedCommands.find((blockedCommand) => {
    const pattern = blockedCommand.trim().toLowerCase()
    if (!pattern) return false
    if (/^[a-z0-9_.-]+$/i.test(pattern)) {
      const tokenPattern = new RegExp('(?:^|[\\r\\n|;&(){}])\\s*' + escapeRegExp(pattern) + '(?:$|\\s|[/:])', 'i')
      return tokenPattern.test(command)
    }
    return normalizedCommand.includes(pattern)
  })
}

interface ShellExecResult {
  stdout: string
  stderr: string
  error?: string
}

const WINDOWS_UTF8_POWERSHELL_PREAMBLE = [
  '$utf8NoBom = New-Object System.Text.UTF8Encoding $false',
  '$OutputEncoding = $utf8NoBom',
  '[Console]::InputEncoding = $utf8NoBom',
  '[Console]::OutputEncoding = $utf8NoBom',
  'try { chcp 65001 > $null } catch {}',
].join('; ')

function getRelaxedShellCommand(command: string): { bin: string; args: string[] } {
  if (process.platform === 'win32') {
    return {
      bin: 'powershell.exe',
      args: ['-NoLogo', '-NoProfile', '-ExecutionPolicy', 'Bypass', '-Command', `${WINDOWS_UTF8_POWERSHELL_PREAMBLE}; ${command}`],
    }
  }

  return { bin: process.env.SHELL || '/bin/sh', args: ['-lc', command] }
}

function getShellEnv(relaxed: boolean): NodeJS.ProcessEnv {
  if (relaxed) {
    return {
      ...process.env,
      LANG: process.env.LANG ?? 'en_US.UTF-8',
      LC_ALL: process.env.LC_ALL ?? 'en_US.UTF-8',
      ...(process.platform === 'win32'
        ? {
            PYTHONIOENCODING: process.env.PYTHONIOENCODING ?? 'utf-8',
            PYTHONUTF8: process.env.PYTHONUTF8 ?? '1',
          }
        : {}),
    }
  }

  const minimalEnv: NodeJS.ProcessEnv = {
    PATH: process.env.PATH ?? '',
    HOME: process.env.HOME ?? '',
    LANG: process.env.LANG ?? 'en_US.UTF-8',
    LC_ALL: process.env.LC_ALL ?? 'en_US.UTF-8',
  }
  if (process.platform === 'win32') {
    minimalEnv.SYSTEMROOT = process.env.SYSTEMROOT ?? ''
    minimalEnv.USERPROFILE = process.env.USERPROFILE ?? ''
    minimalEnv.TEMP = process.env.TEMP ?? ''
    minimalEnv.TMP = process.env.TMP ?? ''
    minimalEnv.PATHEXT = process.env.PATHEXT ?? ''
    minimalEnv.PYTHONIOENCODING = process.env.PYTHONIOENCODING ?? 'utf-8'
    minimalEnv.PYTHONUTF8 = process.env.PYTHONUTF8 ?? '1'
  }
  return minimalEnv
}

function executeShellCommand(bin: string, args: string[], relaxed = false): Promise<ShellExecResult> {
  return new Promise<ShellExecResult>((resolve) => {
    execFile(
      bin,
      args,
      {
        timeout: 30_000,
        maxBuffer: 1024 * 1024,
        encoding: 'utf8',
        cwd: currentWorkspacePath,
        windowsHide: true,
        env: getShellEnv(relaxed),
      },
      (error, stdout, stderr) => {
        resolve({
          stdout: String(stdout ?? ''),
          stderr: String(stderr ?? ''),
          error: error ? error.message : undefined,
        })
      },
    )
  })
}

ipcMain.handle('shell:exec', async (_event, command: unknown): Promise<ShellExecResult> => {
  if (typeof command !== 'string' || !command.trim()) {
    return { stdout: '', stderr: '', error: 'Command must be a non-empty string' }
  }
  const relaxedShellSandbox = currentToolSandboxMode === 'relaxed'
  const blocked = findBlockedCommandPattern(command, currentToolBlockedCommands)
  if (blocked) {
    logger.warn('shell:exec blocked command pattern', { blocked })
    return { stdout: '', stderr: '', error: `Command blocked by sandbox policy: ${blocked}` }
  }

  if (relaxedShellSandbox) {
    const relaxed = getRelaxedShellCommand(command)
    return executeShellCommand(relaxed.bin, relaxed.args, true)
  }

  // Reject shell metacharacters — no chaining, pipes, subshells, redirections.
  if (SHELL_FORBIDDEN_METACHARS.test(command)) {
    logger.warn('shell:exec blocked metacharacters', { command })
    return {
      stdout: '',
      stderr: '',
      error: 'Shell metacharacters are not allowed (| ; & $ ` < > ( ) { } \\ newline)',
    }
  }

  const tokens = tokenizeShellCommand(command)
  if (!tokens || tokens.length === 0) {
    return { stdout: '', stderr: '', error: 'Failed to parse command (unterminated quote?)' }
  }

  const [bin, ...args] = tokens
  const binName = getBinaryName(bin)

  // Reject path-based binaries (e.g. ../../../bin/rm) — allowlist must match
  // by the BARE binary name and the original token must not contain separators.
  if (bin.includes('/') || bin.includes('\\')) {
    logger.warn('shell:exec rejected non-allowlisted path', { bin })
    return { stdout: '', stderr: '', error: `Binary path not allowed: ${bin}` }
  }

  if (!SHELL_EXEC_BINARY_ALLOWLIST.has(binName)) {
    logger.warn('shell:exec rejected non-allowlisted binary', { binName })
    return {
      stdout: '',
      stderr: '',
      error: `Binary not allowed by sandbox policy: ${binName}. Allowed: ${[...SHELL_EXEC_BINARY_ALLOWLIST].join(', ')}`,
    }
  }

  return executeShellCommand(bin, args)
})

ipcMain.handle('git:status', async (_event, repoPath: string) => {
  const repo = await resolveGitRepository(repoPath)
  if (!repo.repoRoot) {
    return { stdout: '', stderr: '', error: repo.error ?? 'Git repository not found' }
  }

  return runGitCommand(repo.repoRoot, ['status', '--short'])
})

ipcMain.handle('git:diff', async (_event, repoPath: string, filePath?: string) => {
  const repo = await resolveGitRepository(repoPath)
  if (!repo.repoRoot) {
    return { stdout: '', stderr: '', error: repo.error ?? 'Git repository not found' }
  }

  const args = ['diff']
  if (filePath) {
    const normalizedPath = normalizeGitPathspec(repo.repoRoot, filePath)
    if (!normalizedPath.pathspec) {
      return { stdout: '', stderr: '', error: normalizedPath.error ?? 'Invalid diff path' }
    }
    args.push('--', normalizedPath.pathspec)
  }

  return runGitCommand(repo.repoRoot, args)
})

ipcMain.handle('git:log', async (_event, repoPath: string, maxCount = 10) => {
  const repo = await resolveGitRepository(repoPath)
  if (!repo.repoRoot) {
    return { stdout: '', stderr: '', error: repo.error ?? 'Git repository not found' }
  }

  const safeMaxCount = Math.max(1, Math.min(100, Math.trunc(Number(maxCount) || 10)))
  return runGitCommand(repo.repoRoot, ['log', '--oneline', `--max-count=${safeMaxCount}`])
})

ipcMain.handle('git:add', async (_event, repoPath: string, pathspecs: string[] = ['.']) => {
  const repo = await resolveGitRepository(repoPath)
  if (!repo.repoRoot) {
    return { stdout: '', stderr: '', error: repo.error ?? 'Git repository not found' }
  }

  const normalizedPathspecs: string[] = []
  for (const pathspec of pathspecs) {
    const normalizedPath = normalizeGitPathspec(repo.repoRoot, pathspec)
    if (!normalizedPath.pathspec) {
      return { stdout: '', stderr: '', error: normalizedPath.error ?? 'Invalid add path' }
    }
    normalizedPathspecs.push(normalizedPath.pathspec)
  }

  return runGitCommand(repo.repoRoot, ['add', '--', ...(normalizedPathspecs.length > 0 ? normalizedPathspecs : ['.'])])
})

ipcMain.handle('git:commit', async (_event, repoPath: string, message: string) => {
  const repo = await resolveGitRepository(repoPath)
  if (!repo.repoRoot) {
    return { stdout: '', stderr: '', error: repo.error ?? 'Git repository not found' }
  }

  if (!message.trim()) {
    return { stdout: '', stderr: '', error: 'Commit message is required' }
  }

  return runGitCommand(repo.repoRoot, ['commit', '-m', message])
})

// ─── IPC Handlers: File Edit (patch) ───────────────────────────────

ipcMain.handle('fs:editFile', async (_event, filePath: string, oldText: string, newText: string) => {
  try {
    const pathErr = enforceFsPathInWorkspace(filePath)
    if (pathErr) return { error: pathErr }
    const content = await readTextFileWithLimit(filePath)
    const firstMatch = content.indexOf(oldText)
    if (firstMatch === -1) {
      return { error: `Old text not found in ${filePath}` }
    }
    if (content.indexOf(oldText, firstMatch + oldText.length) !== -1) {
      return { error: `Old text is not unique in ${filePath}; provide a more specific snippet` }
    }
    // Use function replacer to avoid $-substitution in replacement string
    const updated = content.replace(oldText, () => newText)
    await atomicWriteFile(filePath, updated)
    return { success: true }
  } catch (err: unknown) {
    return { error: err instanceof Error ? err.message : String(err) }
  }
})

// ─── IPC Handlers: Search Files (grep) ─────────────────────────────

const MAX_CONTEXT_LINES = 5

ipcMain.handle('fs:searchFiles', async (_event, dirPath: string, pattern: string, options?: { maxResults?: number; filePattern?: string; regex?: boolean; caseSensitive?: boolean; contextLines?: number; excludePattern?: string }) => {
  const pathErr = enforceFsPathInWorkspace(dirPath)
  if (pathErr) return { error: pathErr }
  const maxResults = options?.maxResults ?? 50
  const filePattern = options?.filePattern ?? ''
  const useRegex = options?.regex ?? false
  const caseSensitive = options?.caseSensitive ?? true
  const contextLines = Math.min(options?.contextLines ?? 0, MAX_CONTEXT_LINES)
  const excludePattern = options?.excludePattern ?? ''
  const results: { file: string; line: number; content: string; context?: string[] }[] = []
  let filePatternRegex: RegExp | null = null
  if (filePattern) {
    try {
      filePatternRegex = wildcardPatternToRegex(filePattern)
    } catch {
      return { error: `Invalid file pattern: ${filePattern}` }
    }
  }

  let searchRegex: RegExp | null = null
  if (useRegex) {
    try {
      searchRegex = new RegExp(pattern, caseSensitive ? '' : 'i')
    } catch {
      return { error: `Invalid regex pattern: ${pattern}` }
    }
  }

  let excludeRegex: RegExp | null = null
  if (excludePattern) {
    try {
      // Escape regex special chars except *, then replace * with .*
      const escaped = excludePattern.replace(/[.+^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*')
      excludeRegex = new RegExp(escaped, 'i')
    } catch {
      // ignore invalid exclude patterns
    }
  }

  function matchesPattern(line: string): boolean {
    if (searchRegex) return searchRegex.test(line)
    if (caseSensitive) return line.includes(pattern)
    return line.toLowerCase().includes(pattern.toLowerCase())
  }

  async function walk(dir: string) {
    if (results.length >= maxResults) return
    try {
      const entries = await fs.readdir(dir, { withFileTypes: true })
      for (const entry of entries) {
        if (results.length >= maxResults) return
        const fullPath = path.join(dir, entry.name)
        // Skip hidden dirs and node_modules
        if (entry.isDirectory()) {
          if (entry.name.startsWith('.') || entry.name === 'node_modules' || entry.name === 'dist') continue
          if (excludeRegex && excludeRegex.test(entry.name)) continue
          await walk(fullPath)
        } else {
          if (filePatternRegex && !filePatternRegex.test(entry.name)) continue
          if (excludeRegex && excludeRegex.test(entry.name)) continue
          try {
            const text = await fs.readFile(fullPath, 'utf-8')
            const lines = text.split('\n')
            for (let i = 0; i < lines.length; i++) {
              if (results.length >= maxResults) return
              if (matchesPattern(lines[i])) {
                const result: { file: string; line: number; content: string; context?: string[] } = {
                  file: fullPath,
                  line: i + 1,
                  content: lines[i].trim().slice(0, 200),
                }
                if (contextLines > 0) {
                  const ctxStart = Math.max(0, i - contextLines)
                  const ctxEnd = Math.min(lines.length - 1, i + contextLines)
                  result.context = []
                  for (let j = ctxStart; j <= ctxEnd; j++) {
                    const prefix = j === i ? '>' : ' '
                    result.context.push(`${prefix} ${j + 1}: ${lines[j].slice(0, 200)}`)
                  }
                }
                results.push(result)
              }
            }
          } catch {
            // Skip binary / unreadable files
          }
        }
      }
    } catch {
      // Skip inaccessible directories
    }
  }

  await walk(dirPath)
  return results
})

// ─── IPC Handlers: Glob Files ──────────────────────────────────────

ipcMain.handle('fs:glob', async (_event, basePath: string, pattern: string, excludePattern: string) => {
  try {
    const pathErr = enforceFsPathInWorkspace(basePath)
    if (pathErr) return { error: pathErr }
    const excludeSet = new Set(
      excludePattern.split(',').map((s) => s.trim().toLowerCase()).filter(Boolean)
    )
    const results: string[] = []
    const MAX_RESULTS = 500

    const regex = globToRegex(pattern)

    async function walk(dir: string, relativeBase: string): Promise<void> {
      if (results.length >= MAX_RESULTS) return
      try {
        const entries = await fs.readdir(dir, { withFileTypes: true })
        for (const entry of entries) {
          if (results.length >= MAX_RESULTS) return
          const name = entry.name.toLowerCase()
          if (excludeSet.has(name)) continue

          const fullPath = path.join(dir, entry.name)
          const relativePath = relativeBase ? `${relativeBase}/${entry.name}` : entry.name

          if (entry.isDirectory()) {
            await walk(fullPath, relativePath)
          } else if (regex.test(relativePath)) {
            results.push(fullPath)
          }
        }
      } catch {
        // skip inaccessible
      }
    }

    await walk(basePath, '')
    return results
  } catch (err: unknown) {
    return { error: err instanceof Error ? err.message : String(err) }
  }
})

// ─── IPC Handlers: Open URL in default browser ─────────────────────

ipcMain.handle('shell:openPath', async (_event, targetPath: string) => {
  try {
    const pathErr = enforceFsPathInWorkspace(targetPath)
    if (pathErr) return { error: pathErr }
    const resolved = resolveUserPath(targetPath, app.getPath('home'))
    const error = await shell.openPath(resolved)
    if (error) return { error }
    return { success: true }
  } catch (err: unknown) {
    return { error: err instanceof Error ? err.message : String(err) }
  }
})

ipcMain.handle('shell:openUrl', async (_event, url: string) => {
  try {
    // Only allow http/https protocols
    const parsed = new URL(url)
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      return { error: 'Only http and https URLs are allowed' }
    }
    await shell.openExternal(url)
    return { success: true }
  } catch (err: unknown) {
    return { error: err instanceof Error ? err.message : String(err) }
  }
})

// ─── IPC Handlers: System Info ─────────────────────────────────────

ipcMain.handle('system:info', async () => {
  return {
    platform: process.platform,
    arch: process.arch,
    hostname: os.hostname(),
    cpus: os.cpus().length,
    cpuModel: os.cpus()[0]?.model ?? 'unknown',
    totalMemory: os.totalmem(),
    freeMemory: os.freemem(),
    homeDir: os.homedir(),
    tmpDir: os.tmpdir(),
    uptime: os.uptime(),
    nodeVersion: process.version,
    electronVersion: process.versions.electron,
  }
})

// ─── IPC Handlers: Fetch Webpage ───────────────────────────────────

function stripHtml(html: string): string {
  const ENTITIES: Record<string, string> = {
    '&amp;': '&', '&lt;': '<', '&gt;': '>', '&quot;': '"', '&#39;': "'", '&nbsp;': ' ',
  }
  return html
    .replace(/<(script|style)[^>]*>[\s\S]*?<\/\1>/gi, ' ')
    .replace(/<!--[\s\S]*?-->/g, ' ')
    .replace(/<[^>]+>/g, ' ')
    // Single-pass entity decode to avoid double-unescaping
    .replace(/&(?:#\d+|#x[\da-fA-F]+|[a-zA-Z]+);/g, (match) => ENTITIES[match] ?? ' ')
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

/** Minimal shape of a Node.js HTTP/HTTPS IncomingMessage we rely on */
interface FetchResponse {
  statusCode: number
  headers: Record<string, string | string[] | undefined>
  resume(): void
  on(event: 'data', listener: (chunk: unknown) => void): void
  on(event: 'end', listener: () => void): void
}

/** Minimal shape of a Node.js ClientRequest we rely on */
interface FetchRequest {
  on(event: 'error', listener: (err: Error) => void): FetchRequest
  setTimeout(ms: number, callback: () => void): FetchRequest
  destroy(): void
}

interface AiFetchStartPayload {
  url: string
  method?: string
  headers?: Record<string, string>
  bodyText?: string
  bodyBase64?: string
  timeoutMs?: number
}

type AiFetchEventPayload =
  | { requestId: string; type: 'response'; status: number; statusText: string; headers: Record<string, string> }
  | { requestId: string; type: 'data'; chunkBase64: string }
  | { requestId: string; type: 'end' }
  | { requestId: string; type: 'error'; error: string }

const activeAiFetchRequests = new Map<string, ClientRequest>()
const knownAiFetchRequests = new Set<string>()
const pendingAiFetchAborts = new Set<string>()

function clearAiFetchRequestTracking(requestId: string): void {
  activeAiFetchRequests.delete(requestId)
  knownAiFetchRequests.delete(requestId)
  pendingAiFetchAborts.delete(requestId)
}

function serializeResponseHeaders(headers: IncomingMessage['headers']): Record<string, string> {
  const result: Record<string, string> = {}
  for (const [key, value] of Object.entries(headers)) {
    if (value == null) continue
    result[key] = Array.isArray(value) ? value.join(', ') : value
  }
  return result
}

function sendAiFetchEvent(target: Electron.WebContents, payload: AiFetchEventPayload): void {
  if (target.isDestroyed()) return
  target.send('ai:fetch:event', payload)
}

function beginAiFetch(
  target: Electron.WebContents,
  requestId: string,
  payload: AiFetchStartPayload,
  redirectsLeft = 5,
): void {
  void (async () => {
    try {
      if (pendingAiFetchAborts.delete(requestId)) {
        knownAiFetchRequests.delete(requestId)
        return
      }
      const parsed = await validatePublicHttpUrlWithDns(payload.url)
      if (pendingAiFetchAborts.delete(requestId)) {
        knownAiFetchRequests.delete(requestId)
        return
      }
      startAiFetchRequest(target, requestId, parsed.toString(), payload, redirectsLeft)
    } catch (err: unknown) {
      clearAiFetchRequestTracking(requestId)
      sendAiFetchEvent(target, {
        requestId,
        type: 'error',
        error: err instanceof Error ? err.message : String(err),
      })
    }
  })()
}

function startAiFetchRequest(
  target: Electron.WebContents,
  requestId: string,
  url: string,
  payload: AiFetchStartPayload,
  redirectsLeft: number,
): void {
  if (pendingAiFetchAborts.delete(requestId)) {
    knownAiFetchRequests.delete(requestId)
    return
  }

  const method = (payload.method ?? 'GET').toUpperCase()
  const reqModule = url.startsWith('https:') ? https : http
  const body = payload.bodyBase64
    ? Buffer.from(payload.bodyBase64, 'base64')
    : payload.bodyText !== undefined
      ? Buffer.from(payload.bodyText, 'utf-8')
      : undefined
  const headers = { ...(payload.headers ?? {}) }
  const headerNames = new Set(Object.keys(headers).map((name) => name.toLowerCase()))
  if (!headerNames.has('user-agent')) {
    headers['User-Agent'] = `Mozilla/5.0 Suora/${app.getVersion()}`
  }
  if (!headerNames.has(AI_REQUEST_CLIENT_HEADER)) {
    headers['X-Suora-Client'] = AI_REQUEST_CLIENT_VALUE
  }

  const req = reqModule.request(
    url,
    {
      method,
      headers,
      lookup: safeDnsLookup,
    },
    (res: IncomingMessage) => {
      const redirectLocation = Array.isArray(res.headers.location) ? res.headers.location[0] : res.headers.location
      const statusCode = res.statusCode ?? 0

      if ([301, 302, 303, 307, 308].includes(statusCode) && redirectLocation && redirectsLeft > 0) {
        const redirectUrl = new URL(redirectLocation, url).toString()
        const nextMethod = statusCode === 303 ? 'GET' : method
        res.resume()
        activeAiFetchRequests.delete(requestId)
        beginAiFetch(target, requestId, {
          ...payload,
          url: redirectUrl,
          method: nextMethod,
          ...(nextMethod === 'GET' ? { bodyText: undefined, bodyBase64: undefined } : {}),
        }, redirectsLeft - 1)
        return
      }

      sendAiFetchEvent(target, {
        requestId,
        type: 'response',
        status: statusCode,
        statusText: res.statusMessage ?? '',
        headers: serializeResponseHeaders(res.headers),
      })

      res.on('data', (chunk: Buffer | string) => {
        const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)
        sendAiFetchEvent(target, {
          requestId,
          type: 'data',
          chunkBase64: buffer.toString('base64'),
        })
      })

      res.on('end', () => {
        clearAiFetchRequestTracking(requestId)
        sendAiFetchEvent(target, { requestId, type: 'end' })
      })

      res.on('error', (err: Error) => {
        clearAiFetchRequestTracking(requestId)
        sendAiFetchEvent(target, {
          requestId,
          type: 'error',
          error: err.message,
        })
      })
    },
  )

  activeAiFetchRequests.set(requestId, req)

  req.on('error', (err: Error) => {
    clearAiFetchRequestTracking(requestId)
    sendAiFetchEvent(target, {
      requestId,
      type: 'error',
      error: err.message,
    })
  })

  req.setTimeout(payload.timeoutMs ?? 120_000, () => {
    req.destroy(new Error('AI request timed out'))
  })

  if (body && method !== 'GET' && method !== 'HEAD') {
    req.write(body)
  }

  req.end()
}

type HttpGetFn = (url: string, options: Record<string, unknown>, callback: (res: FetchResponse) => void) => FetchRequest

function fetchUrl(url: string, redirectsLeft = 5, accept = 'text/html'): Promise<{ body: string; rawTruncated: boolean }> {
  return new Promise((resolve, reject) => {
    if (redirectsLeft <= 0) return reject(new Error('Too many redirects'))
    try {
      validatePublicHttpUrl(url)
    } catch (err) {
      reject(err)
      return
    }
    const mod = url.startsWith('https:') ? https : http
    const req = (mod.get as unknown as HttpGetFn)(
      url,
      { headers: { 'User-Agent': 'Mozilla/5.0 Suora/1.0', Accept: accept }, lookup: safeDnsLookup },
      (res: FetchResponse) => {
        if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
          const next = new URL(res.headers.location as string, url).toString()
          res.resume()
          resolve(fetchUrl(next, redirectsLeft - 1, accept))
          return
        }
        const ct: string = (res.headers['content-type'] as string | undefined) ?? ''
        if (!ct.includes('text/') && !ct.includes('application/json') && !ct.includes('application/xhtml')) {
          res.resume()
          reject(new Error(`Unsupported content type: ${ct}`))
          return
        }
        const RAW_LIMIT = 512 * 1024
        let raw = ''
        let totalLen = 0
        let rawTruncated = false
        res.on('data', (chunk: unknown) => {
          const s = String(chunk)
          totalLen += s.length
          if (totalLen <= RAW_LIMIT) {
            raw += s
          } else {
            rawTruncated = true
          }
        })
        res.on('end', () => resolve({ body: raw, rawTruncated }))
      }
    )
    req.on('error', reject)
    req.setTimeout(15_000, () => {
      req.destroy()
      reject(new Error('Fetch request timed out'))
    })
  })
}

ipcMain.handle('web:fetch', async (_event, url: string) => {
  try {
    validatePublicHttpUrl(url)
    const { body: raw, rawTruncated } = await fetchUrl(url)
    const text = stripHtml(raw)
    const truncated = rawTruncated || text.length > 8000
    return { content: text.slice(0, 8000), url, truncated, rawTruncated }
  } catch (err: unknown) {
    return { error: err instanceof Error ? err.message : String(err) }
  }
})

ipcMain.handle('web:fetchJson', async (_event, url: string) => {
  try {
    validatePublicHttpUrl(url)
    const { body: raw, rawTruncated } = await fetchUrl(url, 5, 'application/json')
    if (raw.length > MAX_IPC_TEXT_FILE_BYTES) {
      return { error: `Response is too large (${raw.length} bytes)` }
    }
    return { content: raw, url, truncated: rawTruncated, rawTruncated }
  } catch (err: unknown) {
    return { error: err instanceof Error ? err.message : String(err) }
  }
})

ipcMain.handle('web:fetchText', async (_event, url: string) => {
  try {
    validatePublicHttpUrl(url)
    const { body: raw, rawTruncated } = await fetchUrl(url)
    if (raw.length > MAX_IPC_TEXT_FILE_BYTES) {
      return { error: `Response is too large (${raw.length} bytes)` }
    }
    return { content: raw, url, truncated: rawTruncated, rawTruncated }
  } catch (err: unknown) {
    return { error: err instanceof Error ? err.message : String(err) }
  }
})

ipcMain.handle('ai:fetch:start', (event, payload: AiFetchStartPayload) => {
  if (!payload || typeof payload.url !== 'string' || !payload.url.trim()) {
    throw new Error('AI fetch URL is required')
  }

  const requestId = crypto.randomUUID()
  knownAiFetchRequests.add(requestId)
  beginAiFetch(event.sender, requestId, payload)
  return { requestId }
})

ipcMain.handle('ai:fetch:abort', (_event, requestId: string) => {
  if (typeof requestId !== 'string' || !requestId) {
    throw new Error('AI fetch request ID is required')
  }

  const request = activeAiFetchRequests.get(requestId)
  if (request) {
    activeAiFetchRequests.delete(requestId)
    request.destroy(new Error('Request aborted'))
  } else if (knownAiFetchRequests.has(requestId)) {
    pendingAiFetchAborts.add(requestId)
  }

  return { success: true }
})

// ─── IPC Handlers: Browser Automation ──────────────────────────────

let automationWindow: BrowserWindow | null = null
const BROWSER_TIMEOUT = 15_000

const SAFE_BROWSER_EVALUATIONS: Record<string, string> = {
  title: 'document.title',
  location: 'location.href',
  text: "document.body ? document.body.innerText.slice(0, 16000) : ''",
  links: `Array.from(document.querySelectorAll('a[href]')).map(a => ({ text: a.textContent.trim().slice(0, 200), href: a.href })).filter(l => l.href.startsWith('http')).slice(0, 200)`,
  headings: `Array.from(document.querySelectorAll('h1,h2,h3')).map(h => ({ level: h.tagName.toLowerCase(), text: h.textContent.trim().slice(0, 300) })).filter(h => h.text).slice(0, 100)`,
}

function getAutomationWindow(): BrowserWindow {
  if (automationWindow && !automationWindow.isDestroyed()) {
    return automationWindow
  }
  automationWindow = new BrowserWindow({
    show: false,
    width: 1280,
    height: 720,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true,
      // Isolate cookies/storage from the main app session and from prior
      // automation runs — prevents accumulating cross-site state.
      partition: 'automation',
    },
  })
  // Block any popups, new windows, and unwanted navigations the page might attempt.
  automationWindow.webContents.setWindowOpenHandler(() => ({ action: 'deny' }))
  automationWindow.webContents.on('will-navigate', (event, navUrl) => {
    try {
      validatePublicHttpUrl(navUrl)
    } catch {
      event.preventDefault()
    }
  })
  automationWindow.webContents.on('will-attach-webview', (event) => {
    event.preventDefault()
  })
  return automationWindow
}

function showAutomationWindow(win = getAutomationWindow()): BrowserWindow {
  if (!win.isVisible()) win.show()
  if (win.isMinimized()) win.restore()
  win.focus()
  return win
}

function getLoadedAutomationWindow(url?: string, reveal = false): BrowserWindow {
  const win = getAutomationWindow()
  if (reveal) showAutomationWindow(win)
  const currentUrl = win.webContents.getURL()
  if (!url && (!currentUrl || currentUrl === 'about:blank')) {
    throw new Error('No automation window available. Navigate to a URL first.')
  }
  return win
}

function validateBrowserUrl(url: string): void {
  const parsed = new URL(url)
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    throw new Error('Only http and https URLs are allowed')
  }
}

async function navigateAutomationWindow(url: string, reveal = false): Promise<BrowserWindow> {
  validateBrowserUrl(url)
  // Best-effort DNS rebinding protection for browser navigation: resolve
  // the hostname and reject if any A/AAAA points at a private/loopback IP.
  await validatePublicHttpUrlWithDns(url)
  const win = getAutomationWindow()
  if (reveal) showAutomationWindow(win)
  await Promise.race([
    win.loadURL(url),
    new Promise((_, reject) => setTimeout(() => reject(new Error('Navigation timed out')), BROWSER_TIMEOUT)),
  ])
  return win
}

function getAutomationWindowState() {
  if (!automationWindow || automationWindow.isDestroyed()) {
    return {
      available: false,
      visible: false,
      loading: false,
      title: '',
      url: '',
    }
  }

  return {
    available: true,
    visible: automationWindow.isVisible(),
    loading: automationWindow.webContents.isLoading(),
    title: automationWindow.webContents.getTitle(),
    url: automationWindow.webContents.getURL() === 'about:blank' ? '' : automationWindow.webContents.getURL(),
  }
}

ipcMain.handle('browser:navigate', async (_event, url: string) => {
  try {
    const win = await navigateAutomationWindow(url)
    const title = win.webContents.getTitle()
    const text = await win.webContents.executeJavaScript(
      `document.body ? document.body.innerText.slice(0, 8000) : ''`
    )
    return { title, content: text, url }
  } catch (err: unknown) {
    return { error: err instanceof Error ? err.message : String(err) }
  }
})

ipcMain.handle('browser:show', async (_event, url?: string) => {
  try {
    const win = url ? await navigateAutomationWindow(url, true) : showAutomationWindow()
    return {
      success: true,
      ...getAutomationWindowState(),
      title: win.webContents.getTitle(),
      url: win.webContents.getURL() === 'about:blank' ? '' : win.webContents.getURL(),
    }
  } catch (err: unknown) {
    return { error: err instanceof Error ? err.message : String(err) }
  }
})

ipcMain.handle('browser:hide', async () => {
  try {
    if (automationWindow && !automationWindow.isDestroyed()) automationWindow.hide()
    return { success: true, ...getAutomationWindowState() }
  } catch (err: unknown) {
    return { error: err instanceof Error ? err.message : String(err) }
  }
})

ipcMain.handle('browser:getState', async () => {
  try {
    return getAutomationWindowState()
  } catch (err: unknown) {
    return { error: err instanceof Error ? err.message : String(err) }
  }
})

ipcMain.handle('browser:screenshot', async (_event, url?: string) => {
  try {
    if (url) {
      await navigateAutomationWindow(url)
    }
    const win = getLoadedAutomationWindow(url)
    const image = await win.webContents.capturePage()
    const base64 = image.toPNG().toString('base64')
    return { image: base64, format: 'png' }
  } catch (err: unknown) {
    return { error: err instanceof Error ? err.message : String(err) }
  }
})

ipcMain.handle('browser:evaluate', async (_event, url: string | undefined, expression: string) => {
  try {
    if (url) validatePublicHttpUrl(url)
    const script = SAFE_BROWSER_EVALUATIONS[expression]
    if (!script) {
      return { error: `Unsupported browser evaluation: ${expression}. Allowed: ${Object.keys(SAFE_BROWSER_EVALUATIONS).join(', ')}` }
    }
    if (url) await navigateAutomationWindow(url)
    const win = getLoadedAutomationWindow(url)
    const result = await Promise.race([
      win.webContents.executeJavaScript(script),
      new Promise((_, reject) => setTimeout(() => reject(new Error('Script execution timed out')), BROWSER_TIMEOUT)),
    ])
    return { result: typeof result === 'string' ? result : JSON.stringify(result) }
  } catch (err: unknown) {
    return { error: err instanceof Error ? err.message : String(err) }
  }
})

ipcMain.handle('browser:extractLinks', async (_event, url?: string) => {
  try {
    if (url) await navigateAutomationWindow(url)
    const win = getLoadedAutomationWindow(url)
    const links = await win.webContents.executeJavaScript(`
      Array.from(document.querySelectorAll('a[href]')).map(a => ({
        text: a.textContent.trim().slice(0, 200),
        href: a.href,
      })).filter(l => l.href.startsWith('http'))
    `)
    return { links, count: links.length }
  } catch (err: unknown) {
    return { error: err instanceof Error ? err.message : String(err) }
  }
})

ipcMain.handle('browser:extractText', async (_event, url?: string) => {
  try {
    if (url) await navigateAutomationWindow(url)
    const win = getLoadedAutomationWindow(url)
    const text = await win.webContents.executeJavaScript(
      `document.body ? document.body.innerText : ''`
    )
    return { text: String(text).slice(0, 16000), truncated: String(text).length > 16000 }
  } catch (err: unknown) {
    return { error: err instanceof Error ? err.message : String(err) }
  }
})

ipcMain.handle('browser:fillForm', async (_event, url: string | undefined, selector: string, value: string) => {
  try {
    if (url) await navigateAutomationWindow(url, true)
    const win = getLoadedAutomationWindow(url, true)
    const filled = await win.webContents.executeJavaScript(`
      (() => {
        const sel = ${JSON.stringify(selector)};
        const el = document.querySelector(sel);
        if (!el) return { error: 'Element not found: ' + sel };
        el.focus();
        el.value = ${JSON.stringify(value)};
        el.dispatchEvent(new Event('input', { bubbles: true }));
        el.dispatchEvent(new Event('change', { bubbles: true }));
        return { success: true, tag: el.tagName, type: el.type || '' };
      })()
    `)
    return filled
  } catch (err: unknown) {
    return { error: err instanceof Error ? err.message : String(err) }
  }
})

ipcMain.handle('browser:click', async (_event, url: string | undefined, selector: string) => {
  try {
    if (url) await navigateAutomationWindow(url, true)
    const win = getLoadedAutomationWindow(url, true)
    const clicked = await win.webContents.executeJavaScript(`
      (() => {
        const sel = ${JSON.stringify(selector)};
        const el = document.querySelector(sel);
        if (!el) return { error: 'Element not found: ' + sel };
        el.click();
        return { success: true, tag: el.tagName, text: (el.textContent || '').trim().slice(0, 200) };
      })()
    `)
    return clicked
  } catch (err: unknown) {
    return { error: err instanceof Error ? err.message : String(err) }
  }
})

// ─── IPC Handlers: Clipboard ───────────────────────────────────────

ipcMain.handle('clipboard:read', async () => {
  try {
    return { text: clipboard.readText() }
  } catch (err: unknown) {
    return { error: err instanceof Error ? err.message : String(err) }
  }
})

ipcMain.handle('clipboard:write', async (_event, text: string) => {
  try {
    clipboard.writeText(text)
    return { success: true }
  } catch (err: unknown) {
    return { error: err instanceof Error ? err.message : String(err) }
  }
})

// ─── IPC Handlers: System Notification ─────────────────────────────

ipcMain.handle('system:notify', async (_event, title: string, body?: string) => {
  try {
    const notification = new Notification({ title, body: body ?? '' })
    notification.show()
    return { success: true }
  } catch (err: unknown) {
    return { error: err instanceof Error ? err.message : String(err) }
  }
})

// ─── IPC Handlers: Screenshot ──────────────────────────────────────

ipcMain.handle('system:screenshot', async () => {
  try {
    const sources = await desktopCapturer.getSources({ types: ['screen'], thumbnailSize: { width: 1920, height: 1080 } })
    if (!sources.length) return { error: 'No screen sources available' }
    const primary = sources[0]
    const image = primary.thumbnail
    const base64 = image.toPNG().toString('base64')
    return { data: base64, mimeType: 'image/png' }
  } catch (err: unknown) {
    return { error: err instanceof Error ? err.message : String(err) }
  }
})

// ─── Timer / Scheduled Task Engine ─────────────────────────────────

interface StoredTimer {
  id: string
  name: string
  type: 'once' | 'interval' | 'cron'
  schedule: string
  action: 'notify' | 'prompt' | 'pipeline'
  prompt?: string
  agentId?: string
  pipelineId?: string
  enabled: boolean
  createdAt: number
  updatedAt: number
  lastRun?: number
  nextRun?: number
  timezone?: string
  missedRunPolicy?: 'skip' | 'run-once' | 'run-all'
  maxRetries?: number
  retryIntervalMinutes?: number
  calendarRule?: 'all-days' | 'weekdays' | 'weekends'
}

interface TimerExecutionRecord {
  id: string
  timerId: string
  firedAt: number
  completedAt?: number
  action: 'notify' | 'prompt' | 'pipeline'
  prompt?: string
  agentId?: string
  pipelineId?: string
  pipelineExecutionId?: string
  sessionId?: string
  result?: string
  status: 'running' | 'success' | 'error'
  error?: string
}

/** Compute the next fire time for a timer. Returns epoch ms or undefined if not schedulable. */
function computeNextRun(timer: StoredTimer): number | undefined {
  const now = Date.now()
  if (timer.type === 'once') {
    const ts = new Date(timer.schedule).getTime()
    return Number.isNaN(ts) ? undefined : (ts > now ? ts : undefined)
  }
  if (timer.type === 'interval') {
    const minutes = Number(timer.schedule)
    if (Number.isNaN(minutes) || minutes <= 0) return undefined
    const base = timer.lastRun ?? timer.createdAt
    const intervalMs = minutes * 60_000
    // Use modular arithmetic to jump directly to the next future fire time
    const next = base + Math.ceil((now - base) / intervalMs) * intervalMs
    return next <= now ? next + intervalMs : next
  }
  if (timer.type === 'cron') {
    try {
      const interval = CronExpressionParser.parse(timer.schedule, {
        currentDate: timer.lastRun ? new Date(timer.lastRun) : new Date(now)
      })
      return interval.next().getTime()
    } catch {
      return undefined
    }
  }
  return undefined
}

async function readTimers(): Promise<StoredTimer[]> {
  const database = await getSuoraDatabase()
  return (await database.listJsonTable('timers'))
    .filter((entry): entry is StoredTimer => Boolean(entry && typeof entry === 'object' && 'id' in entry && 'createdAt' in entry))
}

async function writeTimers(timers: StoredTimer[]): Promise<void> {
  const database = await getSuoraDatabase()
  const existing = (await database.listJsonTable('timers'))
    .filter((entry): entry is StoredTimer => Boolean(entry && typeof entry === 'object' && 'id' in entry))
  const nextIds = new Set(timers.map((timer) => timer.id))

  for (const timer of timers) {
    await database.saveJsonEntity('timers', timer.id, timer)
  }
  for (const timer of existing) {
    if (!nextIds.has(timer.id)) await database.deleteJsonEntity('timers', timer.id)
  }
}

async function readTimerHistory(): Promise<TimerExecutionRecord[]> {
  const database = await getSuoraDatabase()
  return (await database.listJsonTable('timer_executions'))
    .filter((entry): entry is TimerExecutionRecord => Boolean(entry && typeof entry === 'object' && 'id' in entry && 'timerId' in entry && 'firedAt' in entry))
    .sort((left, right) => left.firedAt - right.firedAt)
}

async function writeTimerHistory(records: TimerExecutionRecord[]): Promise<void> {
  const database = await getSuoraDatabase()
  const trimmed = records.slice(-500)
  const nextIds = new Set(trimmed.map((record) => record.id))
  const existing = (await database.listJsonTable('timer_executions'))
    .filter((entry): entry is TimerExecutionRecord => Boolean(entry && typeof entry === 'object' && 'id' in entry))

  for (const record of trimmed) {
    await database.saveJsonEntity('timer_executions', record.id, record)
  }
  for (const record of existing) {
    if (!nextIds.has(record.id)) await database.deleteJsonEntity('timer_executions', record.id)
  }
}

async function appendTimerExecution(record: TimerExecutionRecord): Promise<void> {
  const database = await getSuoraDatabase()
  await database.saveJsonEntity('timer_executions', record.id, record)
}

// IPC: List all timers
ipcMain.handle('timer:list', async () => {
  try {
    return { timers: await readTimers() }
  } catch (err: unknown) {
    return { error: err instanceof Error ? err.message : String(err) }
  }
})

// IPC: Create a new timer
ipcMain.handle('timer:create', async (_event, data: Omit<StoredTimer, 'id' | 'createdAt' | 'updatedAt' | 'lastRun' | 'nextRun'>) => {
  try {
    const timers = await readTimers()
    const now = Date.now()
    const timer: StoredTimer = {
      id: `timer-${crypto.randomUUID()}`,
      name: data.name,
      type: data.type,
      schedule: data.schedule,
      action: data.action,
      prompt: data.prompt,
      agentId: data.agentId,
      pipelineId: data.pipelineId,
      timezone: data.timezone,
      missedRunPolicy: data.missedRunPolicy,
      maxRetries: data.maxRetries,
      retryIntervalMinutes: data.retryIntervalMinutes,
      calendarRule: data.calendarRule,
      enabled: data.enabled,
      createdAt: now,
      updatedAt: now,
    }
    timer.nextRun = computeNextRun(timer)
    timers.push(timer)
    await writeTimers(timers)
    return { timer }
  } catch (err: unknown) {
    return { error: err instanceof Error ? err.message : String(err) }
  }
})

// IPC: Update a timer
ipcMain.handle('timer:update', async (_event, id: string, updates: Partial<Pick<StoredTimer, 'name' | 'type' | 'schedule' | 'action' | 'prompt' | 'enabled' | 'agentId' | 'pipelineId' | 'timezone' | 'missedRunPolicy' | 'maxRetries' | 'retryIntervalMinutes' | 'calendarRule'>>) => {
  try {
    const timers = await readTimers()
    const idx = timers.findIndex((t) => t.id === id)
    if (idx === -1) return { error: `Timer not found: ${id}` }
    const updated = { ...timers[idx], ...updates, updatedAt: Date.now() }
    updated.nextRun = updated.enabled ? computeNextRun(updated) : undefined
    timers[idx] = updated
    await writeTimers(timers)
    return { timer: updated }
  } catch (err: unknown) {
    return { error: err instanceof Error ? err.message : String(err) }
  }
})

// IPC: Delete a timer
ipcMain.handle('timer:delete', async (_event, id: string) => {
  try {
    let timers = await readTimers()
    const existed = timers.some((t) => t.id === id)
    if (!existed) return { error: `Timer not found: ${id}` }
    timers = timers.filter((t) => t.id !== id)
    await writeTimers(timers)
    return { success: true }
  } catch (err: unknown) {
    return { error: err instanceof Error ? err.message : String(err) }
  }
})

// IPC: Get execution history for a specific timer (or all timers)
ipcMain.handle('timer:history', async (_event, timerId?: string) => {
  try {
    const records = await readTimerHistory()
    const filtered = timerId ? records.filter((r) => r.timerId === timerId) : records
    return { history: filtered.slice(-100) }
  } catch (err: unknown) {
    return { error: err instanceof Error ? err.message : String(err) }
  }
})

ipcMain.handle('timer:startExecution', async (_event, data: {
  timerId: string
  firedAt: number
  action: 'notify' | 'prompt' | 'pipeline'
  prompt?: string
  agentId?: string
  pipelineId?: string
}) => {
  try {
    const execution: TimerExecutionRecord = {
      id: `exec-${crypto.randomUUID()}`,
      timerId: data.timerId,
      firedAt: data.firedAt,
      action: data.action,
      prompt: data.prompt,
      agentId: data.agentId,
      pipelineId: data.pipelineId,
      status: 'running',
    }
    await appendTimerExecution(execution)
    return { execution }
  } catch (err: unknown) {
    return { error: err instanceof Error ? err.message : String(err) }
  }
})

ipcMain.handle('timer:updateExecution', async (_event, data: {
  timerId: string
  firedAt: number
  status: 'running' | 'success' | 'error'
  error?: string
  result?: string
  sessionId?: string
  pipelineExecutionId?: string
}) => {
  try {
    const records = await readTimerHistory()
    let updatedRecord: TimerExecutionRecord | undefined

    for (let index = records.length - 1; index >= 0; index -= 1) {
      const record = records[index]
      if (record.timerId !== data.timerId || record.firedAt !== data.firedAt) continue

      updatedRecord = {
        ...record,
        status: data.status,
        completedAt: data.status === 'running' ? record.completedAt : Date.now(),
        error: data.status === 'error' ? data.error : undefined,
        result: data.result ?? record.result,
        sessionId: data.sessionId ?? record.sessionId,
        pipelineExecutionId: data.pipelineExecutionId ?? record.pipelineExecutionId,
      }
      records[index] = updatedRecord
      break
    }

    if (!updatedRecord) {
      return { error: `Timer execution not found for ${data.timerId} at ${data.firedAt}` }
    }

    await writeTimerHistory(records)
    return { execution: updatedRecord }
  } catch (err: unknown) {
    return { error: err instanceof Error ? err.message : String(err) }
  }
})

const TIMER_CHECK_INTERVAL_MS = 15_000

// Timer tick: check for due timers at regular intervals
let timerInterval: ReturnType<typeof setInterval> | null = null

function startTimerEngine() {
  if (timerInterval) return
  timerInterval = setInterval(async () => {
    try {
      const timers = await readTimers()
      const now = Date.now()
      let changed = false

      for (const timer of timers) {
        if (!timer.enabled || !timer.nextRun) continue
        if (timer.nextRun <= now) {
          // Fire!
          changed = true
          timer.lastRun = now

          // Send notification
          try {
            const notification = new Notification({
              title: timer.name,
              body: timer.prompt || 'Timer fired!',
            })
            notification.show()
          } catch {
            // ignore notification errors
          }

          // Notify renderer (includes agentId for agent prompt execution)
          if (mainWindow && !mainWindow.isDestroyed()) {
            mainWindow.webContents.send('timer:fired', timer)
          }

          // Compute next run (for interval timers) or disable (for once timers)
          if (timer.type === 'once') {
            timer.enabled = false
            timer.nextRun = undefined
          } else {
            timer.nextRun = computeNextRun(timer)
          }
        }
      }

      if (changed) await writeTimers(timers)
    } catch {
      // Silently ignore tick errors
    }
  }, TIMER_CHECK_INTERVAL_MS)
}

function stopTimerEngine() {
  if (timerInterval) {
    clearInterval(timerInterval)
    timerInterval = null
  }
}

// ─── IPC Handlers: Channel Integration ──────────────────────────────

const channelService = getChannelService(process.env.CHANNEL_PORT ? parseInt(process.env.CHANNEL_PORT, 10) : 3000)

// Initialize channel service message handler
channelService.onMessage(async (event: ChannelWebhookEvent) => {
  const { channel, message } = event
  logger.info('Channel message received', {
    channelId: channel.id,
    platform: channel.platform,
    sender: message.senderName,
    content: message.content.substring(0, 100),
  })

  // Forward message to renderer process for agent handling
  if (mainWindow) {
    mainWindow.webContents.send('channel:message', {
      channel,
      message,
    })
  }
})

ipcMain.handle('channel:start', async () => {
  try {
    if (channelService.isRunning()) {
      return { success: true, message: 'Channel service already running' }
    }
    await channelService.start()
    return { success: true }
  } catch (error: unknown) {
    return { error: error instanceof Error ? error.message : String(error) }
  }
})

ipcMain.handle('channel:stop', async () => {
  try {
    await channelService.stop()
    return { success: true }
  } catch (error: unknown) {
    return { error: error instanceof Error ? error.message : String(error) }
  }
})

ipcMain.handle('channel:status', () => {
  return { running: channelService.isRunning() }
})

ipcMain.handle('channel:register', async (_event, channels: unknown) => {
  try {
    // Type guard to validate channel config structure
    const validChannels = Array.isArray(channels) ? channels : []
    await channelService.registerChannels(validChannels as ChannelConfig[])
    return { success: true }
  } catch (error: unknown) {
    return { error: error instanceof Error ? error.message : String(error) }
  }
})

ipcMain.handle('channel:getWebhookUrl', (_event, channel: unknown) => {
  try {
    const url = channelService.getWebhookUrl(channel as ChannelConfig)
    return { success: true, url }
  } catch (error: unknown) {
    return { error: error instanceof Error ? error.message : String(error) }
  }
})

ipcMain.handle('channel:sendMessage', async (_event, channelId: string, chatId: string, content: string) => {
  try {
    const channelService = getChannelService()
    const result = await channelService.sendMessage(channelId, chatId, content)
    return result
  } catch (error: unknown) {
    return { error: error instanceof Error ? error.message : String(error) }
  }
})

ipcMain.handle('channel:sendMessageQueued', async (_event, channelId: string, chatId: string, content: string) => {
  try {
    const channelService = getChannelService()
    const msgId = channelService.enqueueMessage(channelId, chatId, content)
    return { success: true, messageId: msgId }
  } catch (error: unknown) {
    return { error: error instanceof Error ? error.message : String(error) }
  }
})

ipcMain.handle('channel:getAccessToken', async (_event, channelId: string) => {
  try {
    const channelService = getChannelService()
    const token = await channelService.getAccessToken(channelId)
    return { success: true, token }
  } catch (error: unknown) {
    return { error: error instanceof Error ? error.message : String(error) }
  }
})

ipcMain.handle('channel:healthCheck', async (_event, channelId: string) => {
  try {
    const channelService = getChannelService()
    const health = await channelService.healthCheck(channelId)
    return { success: true, health }
  } catch (error: unknown) {
    return { error: error instanceof Error ? error.message : String(error) }
  }
})

ipcMain.handle('channel:streamStatus', (_event, channelId: string) => {
  try {
    const channelService = getChannelService()
    const status = channelService.getStreamStatus(channelId)
    return { success: true, ...status }
  } catch (error: unknown) {
    return { error: error instanceof Error ? error.message : String(error) }
  }
})

ipcMain.handle('channel:debugSend', async (_event, channelId: string, mockMessage: string) => {
  // Restrict simulated inbound messages to development. In production a XSS
  // in the renderer could otherwise forge platform messages and trigger the
  // agent pipeline.
  if (!isDev) {
    return { error: 'channel:debugSend is only available in development builds' }
  }
  try {
    const channelService = getChannelService()
    await channelService.simulateIncomingMessage(channelId, mockMessage)
    return { success: true }
  } catch (error: unknown) {
    return { error: error instanceof Error ? error.message : String(error) }
  }
})

ipcMain.handle('channel:wechatPersonalLoginStart', async (_event, force?: boolean) => {
  try {
    const channelService = getChannelService()
    return await channelService.startWeChatPersonalLogin(Boolean(force))
  } catch (error: unknown) {
    return { success: false, message: error instanceof Error ? error.message : String(error) }
  }
})

ipcMain.handle('channel:wechatPersonalLoginWait', async (_event, sessionKey: string, verifyCode?: string, timeoutMs?: number) => {
  try {
    const channelService = getChannelService()
    return await channelService.waitForWeChatPersonalLogin(sessionKey, verifyCode, timeoutMs)
  } catch (error: unknown) {
    return {
      success: false,
      status: 'error',
      sessionKey,
      message: error instanceof Error ? error.message : String(error),
    }
  }
})

// ─── IPC Handlers: Logging ──────────────────────────────────────────

ipcMain.handle('log:write', (_event, level: unknown, message: unknown, meta?: unknown) => {
  const logger = getLogger()
  if (!isLogLevel(level)) {
    logger.warn('Rejected renderer log with invalid level', { level })
    return { success: false, error: 'Invalid log level' }
  }
  const normalizedMessage = normalizeIpcLogMessage(message)
  switch (level) {
    case 'debug':
      logger.debug(normalizedMessage, meta)
      break
    case 'info':
      logger.info(normalizedMessage, meta)
      break
    case 'warn':
      logger.warn(normalizedMessage, meta)
      break
    case 'error':
      logger.error(normalizedMessage, meta)
      break
  }
  return { success: true }
})

ipcMain.handle('log:listFiles', async () => {
  try {
    return await getLogger().listFiles()
  } catch (error) {
    logger.error('Failed to list log files', { error: error instanceof Error ? error.message : String(error) })
    return []
  }
})

ipcMain.handle('log:readFile', async (_event, fileName: string, maxBytes?: number) => {
  try {
    return {
      fileName,
      content: await getLogger().readFile(fileName, maxBytes),
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    logger.error('Failed to read log file', { fileName, error: message })
    return { error: message }
  }
})

ipcMain.handle('log:clearFiles', async () => {
  try {
    await getLogger().clearFiles()
    logger.info('Runtime log files cleared')
    return { success: true }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    logger.error('Failed to clear log files', { error: message })
    return { error: message }
  }
})

// ─── IPC Handlers: File Watching (Skill Hot-Reload) ────────────────

const activeWatchers = new Map<string, FSWatcher>()

ipcMain.handle('fs:watch:start', async (_event, dirPath: string) => {
  try {
    const pathErr = enforceFsPathInWorkspace(dirPath)
    if (pathErr) return { error: pathErr }
    if (activeWatchers.has(dirPath)) {
      return { success: true, message: 'Already watching' }
    }

    // Ensure the directory exists
    try {
      await fs.access(dirPath)
    } catch {
      await fs.mkdir(dirPath, { recursive: true })
    }

    const watcher = watch(dirPath, { recursive: false }, (eventType, filename) => {
      if (!filename) return
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('fs:watch:changed', {
          dir: dirPath,
          filename,
          eventType,
        })
      }
    })

    watcher.on('error', () => {
      activeWatchers.delete(dirPath)
    })

    activeWatchers.set(dirPath, watcher)
    return { success: true }
  } catch (err: unknown) {
    return { error: err instanceof Error ? err.message : String(err) }
  }
})

ipcMain.handle('fs:watch:stop', async (_event, dirPath: string) => {
  const watcher = activeWatchers.get(dirPath)
  if (watcher) {
    watcher.close()
    activeWatchers.delete(dirPath)
  }
  return { success: true }
})

// ─── IPC Handlers: Export (Save Dialog) ────────────────────────────

interface ExportSaveOptions {
  defaultName: string
  filters: { name: string; extensions: string[] }[]
  content: string
  encoding: 'utf8' | 'base64'
}

ipcMain.handle('export:saveFileDialog', async (_event, options: ExportSaveOptions) => {
  try {
    const { filePath, canceled } = await dialog.showSaveDialog({
      defaultPath: options.defaultName,
      filters: options.filters,
    })
    if (canceled || !filePath) return { canceled: true }

    if (options.encoding === 'base64') {
      const buffer = Buffer.from(options.content, 'base64')
      await fs.writeFile(filePath, buffer)
    } else {
      await fs.writeFile(filePath, options.content, 'utf8')
    }
    return { success: true, filePath }
  } catch (err: unknown) {
    return { error: err instanceof Error ? err.message : String(err) }
  }
})

ipcMain.handle('export:printToPDF', async (_event, htmlContent: string, defaultName: string) => {
  try {
    const { filePath, canceled } = await dialog.showSaveDialog({
      defaultPath: defaultName,
      filters: [{ name: 'PDF', extensions: ['pdf'] }],
    })
    if (canceled || !filePath) return { canceled: true }

    const pdfWin = new BrowserWindow({
      show: false,
      webPreferences: { javascript: true },
    })

    await pdfWin.loadURL(
      `data:text/html;charset=utf-8,${encodeURIComponent(htmlContent)}`,
    )

    const pdfBuffer = await pdfWin.webContents.printToPDF({
      printBackground: true,
      margins: { marginType: 'default' },
    })
    pdfWin.destroy()

    await fs.writeFile(filePath, pdfBuffer)
    return { success: true, filePath }
  } catch (err: unknown) {
    return { error: err instanceof Error ? err.message : String(err) }
  }
})

// ─── Window State Persistence ──────────────────────────────────────

function getWindowStatePath(): string {
  return path.join(app.getPath('home'), '.suora', 'window-state.json')
}

interface WindowState {
  x?: number
  y?: number
  width: number
  height: number
  isMaximized?: boolean
}

async function loadWindowState(): Promise<WindowState> {
  try {
    const content = await fs.readFile(getWindowStatePath(), 'utf-8')
    try {
      return JSON.parse(content) as WindowState
    } catch {
      return { width: 1400, height: 900 }
    }
  } catch {
    return { width: 1400, height: 900 }
  }
}

async function saveWindowState(win: BrowserWindow): Promise<void> {
  const isMaximized = win.isMaximized()
  const bounds = isMaximized ? (win as BrowserWindow).getNormalBounds?.() ?? win.getBounds() : win.getBounds()
  const state: WindowState = {
    x: bounds.x,
    y: bounds.y,
    width: bounds.width,
    height: bounds.height,
    isMaximized,
  }
  try {
    const filePath = getWindowStatePath()
    await fs.mkdir(path.dirname(filePath), { recursive: true })
    await fs.writeFile(filePath, JSON.stringify(state, null, 2), 'utf-8')
  } catch {
    // ignore save errors
  }
}

// ─── System Tray ───────────────────────────────────────────────────

function createTray() {
  const icon = nativeImage.createFromPath(
    path.join(__dirname, '../../resources/icons/icon-32x32.png')
  )

  tray = new Tray(icon)
  tray.setToolTip('Suora')

  const contextMenu = Menu.buildFromTemplate([
    {
      label: 'Show Window',
      click: () => {
        if (mainWindow) {
          mainWindow.show()
          mainWindow.focus()
        } else {
          createWindow()
        }
      },
    },
    { type: 'separator' },
    {
      label: 'Quit',
      click: () => {
        app.quit()
      },
    },
  ])

  tray.setContextMenu(contextMenu)

  tray.on('click', () => {
    if (mainWindow) {
      if (mainWindow.isVisible()) {
        mainWindow.focus()
      } else {
        mainWindow.show()
      }
    } else {
      createWindow()
    }
  })
}

// ─── Global Shortcut ───────────────────────────────────────────────

function registerGlobalShortcuts() {
  // Ctrl+Space (or Cmd+Space on macOS) to toggle window
  const shortcut = process.platform === 'darwin' ? 'CommandOrControl+Shift+Space' : 'CommandOrControl+Shift+Space'
  globalShortcut.register(shortcut, () => {
    if (!mainWindow) {
      createWindow()
      return
    }
    if (mainWindow.isVisible() && mainWindow.isFocused()) {
      mainWindow.hide()
    } else {
      mainWindow.show()
      mainWindow.focus()
    }
  })
}

// ─── Auto-Updater ──────────────────────────────────────────────────

interface UpdateInfo {
  version: string
  releaseDate: string
  releaseNotes: string
  downloadUrl: string
}

interface UpdaterState {
  status: 'unsupported' | 'idle' | 'checking' | 'available' | 'downloading' | 'downloaded' | 'no-update' | 'error'
  currentVersion: string
  latestVersion?: string
  releaseDate?: string
  releaseNotes?: string
  downloadUrl?: string
  downloadPercent?: number
  downloaded: boolean
  lastCheckedAt?: string
  error?: string
}

let updateCheckInProgress = false
let updaterInitialized = false
let updaterState: UpdaterState = {
  status: isDev ? 'unsupported' : 'idle',
  currentVersion: app.getVersion(),
  downloaded: false,
  error: isDev ? 'Auto updates are disabled in development builds.' : undefined,
}

function normalizeReleaseNotes(value: unknown): string {
  if (typeof value === 'string') return value.trim()
  if (Array.isArray(value)) {
    return value
      .map((entry) => {
        if (typeof entry === 'string') return entry
        if (entry && typeof entry === 'object') {
          const version = 'version' in entry && typeof entry.version === 'string' ? entry.version : ''
          const note = 'note' in entry && typeof entry.note === 'string' ? entry.note : ''
          return [version, note].filter(Boolean).join('\n')
        }
        return ''
      })
      .filter(Boolean)
      .join('\n\n')
      .trim()
  }
  return ''
}

function toUpdateInfo(info: {
  version?: string
  releaseDate?: string
  releaseNotes?: unknown
  files?: Array<{ url?: string }>
}): UpdateInfo {
  return {
    version: info.version || '',
    releaseDate: info.releaseDate || new Date().toISOString(),
    releaseNotes: normalizeReleaseNotes(info.releaseNotes),
    downloadUrl: info.files?.find((file) => typeof file.url === 'string' && file.url.trim().length > 0)?.url || '',
  }
}

function broadcastUpdaterState() {
  if (!mainWindow || mainWindow.isDestroyed()) return
  mainWindow.webContents.send('updater:state', updaterState)
}

function setUpdaterState(patch: Partial<UpdaterState>) {
  updaterState = {
    ...updaterState,
    currentVersion: app.getVersion(),
    ...patch,
  }
  broadcastUpdaterState()
}

function initAutoUpdater() {
  if (updaterInitialized || isDev) return
  updaterInitialized = true

  autoUpdater.autoDownload = true
  autoUpdater.autoInstallOnAppQuit = true

  autoUpdater.on('checking-for-update', () => {
    setUpdaterState({
      status: 'checking',
      downloaded: false,
      downloadPercent: undefined,
      error: undefined,
      lastCheckedAt: new Date().toISOString(),
    })
  })

  autoUpdater.on('update-available', (info) => {
    const next = toUpdateInfo(info)
    setUpdaterState({
      status: 'available',
      latestVersion: next.version,
      releaseDate: next.releaseDate,
      releaseNotes: next.releaseNotes,
      downloadUrl: next.downloadUrl,
      downloaded: false,
      downloadPercent: 0,
      error: undefined,
      lastCheckedAt: new Date().toISOString(),
    })
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('updater:available', next)
    }
  })

  autoUpdater.on('download-progress', (progress) => {
    setUpdaterState({
      status: 'downloading',
      downloadPercent: Math.max(0, Math.min(100, Number(progress.percent) || 0)),
      downloaded: false,
      error: undefined,
    })
  })

  autoUpdater.on('update-downloaded', (info) => {
    const next = toUpdateInfo(info)
    setUpdaterState({
      status: 'downloaded',
      latestVersion: next.version,
      releaseDate: next.releaseDate,
      releaseNotes: next.releaseNotes,
      downloadUrl: next.downloadUrl,
      downloaded: true,
      downloadPercent: 100,
      error: undefined,
    })
  })

  autoUpdater.on('update-not-available', () => {
    setUpdaterState({
      status: 'no-update',
      latestVersion: undefined,
      releaseDate: undefined,
      releaseNotes: undefined,
      downloadUrl: undefined,
      downloaded: false,
      downloadPercent: undefined,
      error: undefined,
      lastCheckedAt: new Date().toISOString(),
    })
  })

  autoUpdater.on('error', (error) => {
    setUpdaterState({
      status: 'error',
      downloaded: false,
      error: error instanceof Error ? error.message : String(error),
      lastCheckedAt: new Date().toISOString(),
    })
  })
}

async function checkForUpdates(_feedUrl?: string): Promise<UpdateInfo | null> {
  if (isDev) {
    setUpdaterState({
      status: 'unsupported',
      downloaded: false,
      error: 'Auto updates are disabled in development builds.',
    })
    return null
  }
  if (updateCheckInProgress) return null
  updateCheckInProgress = true
  try {
    initAutoUpdater()
    logger.info('Checking for updates via electron-updater', { currentVersion: app.getVersion() })
    const result = await autoUpdater.checkForUpdates()
    const info = result?.updateInfo
    if (!info || !info.version || info.version === app.getVersion()) return null
    return toUpdateInfo(info)
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    logger.error('Auto update check failed', { error: message })
    setUpdaterState({
      status: 'error',
      downloaded: false,
      error: message,
      lastCheckedAt: new Date().toISOString(),
    })
    return null
  } finally {
    updateCheckInProgress = false
  }
}

ipcMain.handle('updater:check', async (_event, feedUrl?: string) => {
  const update = await checkForUpdates(feedUrl ?? undefined)
  return update
})

ipcMain.handle('updater:getVersion', () => app.getVersion())
ipcMain.handle('updater:getState', () => updaterState)
ipcMain.handle('updater:install', async () => {
  if (isDev) {
    return { success: false, error: 'Auto updates are disabled in development builds.' }
  }
  if (!updaterState.downloaded) {
    return { success: false, error: 'No downloaded update is ready to install.' }
  }
  setImmediate(() => autoUpdater.quitAndInstall(false, true))
  return { success: true }
})

// ─── Email Sending ─────────────────────────────────────────────────

ipcMain.handle('email:send', async (
  _event,
  config: { smtpHost: string; smtpPort: number; secure: boolean; username: string; password: string; fromName: string; fromAddress: string },
  message: { to: string; subject: string; body: string; cc?: string; bcc?: string; isHtml?: boolean }
) => {
  try {
    logger.info('Email send requested', {
      host: config.smtpHost,
      port: config.smtpPort,
      secure: config.secure,
      from: config.fromAddress,
      to: message.to,
      subject: message.subject?.slice(0, 80),
      hasAuth: !!(config.username && config.password),
    })

    // Dynamic import nodemailer (CJS module) — handle both ESM default and direct export
    const nodemailerModule = await import('nodemailer')
    const nodemailer = nodemailerModule.default || nodemailerModule

    logger.info('Creating SMTP transporter', { host: config.smtpHost, port: config.smtpPort, secure: config.secure })

    const transporter = nodemailer.createTransport({
      host: config.smtpHost,
      port: config.smtpPort,
      secure: config.secure,
      disableFileAccess: true,
      disableUrlAccess: true,
      auth: {
        user: config.username,
        pass: config.password,
      },
      tls: {
        rejectUnauthorized: true,
        minVersion: 'TLSv1.2',
      },
      connectionTimeout: 10000,
      greetingTimeout: 10000,
      socketTimeout: 15000,
      logger: false,
      debug: false,
    })

    const mailOptions: Record<string, unknown> = {
      from: config.fromName ? `"${config.fromName}" <${config.fromAddress}>` : config.fromAddress,
      to: message.to,
      subject: message.subject,
    }

    if (message.cc) mailOptions.cc = message.cc
    if (message.bcc) mailOptions.bcc = message.bcc

    if (message.isHtml) {
      mailOptions.html = message.body
    } else {
      mailOptions.text = message.body
    }

    const info = await transporter.sendMail(mailOptions)
    logger.info('Email sent successfully', { messageId: info.messageId, to: message.to })
    return { success: true, messageId: info.messageId }
  } catch (err) {
    const errMsg = err instanceof Error ? err.message : String(err)
    logger.error('Failed to send email', { error: errMsg, to: message.to })
    return { success: false, error: errMsg }
  }
})

ipcMain.handle('email:test', async (
  _event,
  config: { smtpHost: string; smtpPort: number; secure: boolean; username: string; password: string; fromName: string; fromAddress: string }
) => {
  try {
    const nodemailerModule = await import('nodemailer')
    const nodemailer = nodemailerModule.default || nodemailerModule
    const transporter = nodemailer.createTransport({
      host: config.smtpHost,
      port: config.smtpPort,
      secure: config.secure,
      disableFileAccess: true,
      disableUrlAccess: true,
      auth: {
        user: config.username,
        pass: config.password,
      },
      tls: {
        rejectUnauthorized: true,
        minVersion: 'TLSv1.2',
      },
      connectionTimeout: 10000,
      greetingTimeout: 10000,
      socketTimeout: 15000,
    })
    await transporter.verify()
    logger.info('Email connection test successful', { host: config.smtpHost })
    return { success: true }
  } catch (err) {
    const errMsg = err instanceof Error ? err.message : String(err)
    logger.error('Email connection test failed', { error: errMsg })
    return { success: false, error: errMsg }
  }
})

// ─── Deep Linking Protocol ─────────────────────────────────────────

const PROTOCOL_NAME = 'suora'

if (process.defaultApp) {
  // Development: register with path to electron executable
  if (process.argv.length >= 2) {
    app.setAsDefaultProtocolClient(PROTOCOL_NAME, process.execPath, [path.resolve(process.argv[1])])
  }
} else {
  // Production
  app.setAsDefaultProtocolClient(PROTOCOL_NAME)
}

// Single-instance lock — ensures only one window handles deep links
const gotTheLock = app.requestSingleInstanceLock()

if (!gotTheLock) {
  app.quit()
} else {
  app.on('second-instance', (_event, commandLine) => {
    // Windows / Linux: deep link URL is in commandLine
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore()
      mainWindow.focus()
      const deepLinkUrl = commandLine.find((arg) => arg.startsWith(`${PROTOCOL_NAME}://`))
      if (deepLinkUrl) {
        handleDeepLink(deepLinkUrl)
      }
    }
  })
}

// macOS: open-url event
app.on('open-url', (_event, url) => {
  handleDeepLink(url)
})

function handleDeepLink(url: string) {
  try {
    logger.info('Deep link received', { url })
    const parsed = new URL(url)
    const action = parsed.hostname // e.g., 'chat', 'agent', 'settings'
    const params = Object.fromEntries(parsed.searchParams.entries())

    if (mainWindow) {
      mainWindow.webContents.send('deep-link', { action, path: parsed.pathname, params })
    }
  } catch (err) {
    logger.error('Failed to parse deep link', { url, error: err })
  }
}

ipcMain.handle('deep-link:getProtocol', () => PROTOCOL_NAME)

// ─── Crash Reporting ───────────────────────────────────────────────

const crashLogDir = path.join(app.getPath('home'), '.suora', 'crashes')

async function logCrash(error: { message: string; stack?: string; type: string }) {
  try {
    await fs.mkdir(crashLogDir, { recursive: true })
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
    const crashReport = {
      timestamp: new Date().toISOString(),
      appVersion: app.getVersion(),
      platform: process.platform,
      arch: process.arch,
      electronVersion: process.versions.electron,
      nodeVersion: process.versions.node,
      type: error.type,
      message: error.message,
      stack: error.stack,
      memory: process.memoryUsage(),
      uptime: process.uptime(),
    }
    await fs.writeFile(
      path.join(crashLogDir, `crash-${timestamp}.json`),
      JSON.stringify(crashReport, null, 2),
    )
    logger.error('Crash logged', { type: error.type, message: error.message })
  } catch (writeErr) {
    logger.error('Failed to write crash log', { error: writeErr })
  }
}

process.on('uncaughtException', (err) => {
  logCrash({ message: err.message, stack: err.stack, type: 'uncaughtException' })
})

process.on('unhandledRejection', (reason) => {
  const msg = reason instanceof Error ? reason.message : String(reason)
  const stack = reason instanceof Error ? reason.stack : undefined
  logCrash({ message: msg, stack, type: 'unhandledRejection' })
})

ipcMain.handle('crash:report', async (_event, error: { message: string; stack?: string; source?: string }) => {
  await logCrash({ message: error.message, stack: error.stack, type: `renderer:${error.source || 'unknown'}` })
  return { success: true }
})

ipcMain.handle('crash:getLogs', async () => {
  try {
    await fs.mkdir(crashLogDir, { recursive: true })
    const files = await fs.readdir(crashLogDir)
    const logs = await Promise.all(
      files.filter((f) => f.endsWith('.json')).slice(-20).map(async (f) => {
        const content = await fs.readFile(path.join(crashLogDir, f), 'utf-8')
        try {
          return JSON.parse(content)
        } catch {
          return null
        }
      })
    )
    return logs.filter((log) => log !== null).sort((a: { timestamp: string }, b: { timestamp: string }) => b.timestamp.localeCompare(a.timestamp))
  } catch {
    return []
  }
})

ipcMain.handle('crash:clearLogs', async () => {
  try {
    const files = await fs.readdir(crashLogDir)
    await Promise.all(files.map((f) => fs.unlink(path.join(crashLogDir, f))))
    return { success: true }
  } catch (err) {
    return { error: err instanceof Error ? err.message : String(err) }
  }
})

// ─── Performance Monitoring ────────────────────────────────────────

ipcMain.handle('perf:getMetrics', () => {
  const memUsage = process.memoryUsage()
  const cpuUsage = process.cpuUsage()
  return {
    memory: {
      heapUsed: memUsage.heapUsed,
      heapTotal: memUsage.heapTotal,
      rss: memUsage.rss,
      external: memUsage.external,
    },
    cpu: {
      user: cpuUsage.user,
      system: cpuUsage.system,
    },
    uptime: process.uptime(),
    pid: process.pid,
    versions: {
      electron: process.versions.electron,
      node: process.versions.node,
      chrome: process.versions.chrome,
      v8: process.versions.v8,
    },
  }
})

// ─── App Lifecycle ─────────────────────────────────────────────────

let updateCheckTimeout: ReturnType<typeof setTimeout> | null = null

app.whenReady().then(async () => {
  // Acquire the workspace lock in parallel with constructing the main window.
  // The lock check involves fs IO; opening the BrowserWindow can begin in the
  // meantime so the first frame is ready sooner. We still abort if the lock
  // was not granted.
  const [lockAcquired] = await Promise.all([
    acquireInitialWorkspaceLock(),
    createWindow(),
  ])

  if (!lockAcquired) {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.destroy()
      mainWindow = null
    }
    app.quit()
    return
  }

  // Defer non-critical startup work until the window has actually painted,
  // so tray/shortcut/timer registration doesn't compete with first frame.
  let deferredStartupRan = false
  const scheduleDeferredStartup = () => {
    if (deferredStartupRan) return
    deferredStartupRan = true
    try {
      createTray()
    } catch (err) {
      logger.error('Failed to create tray', { error: err instanceof Error ? err.message : String(err) })
    }
    try {
      registerGlobalShortcuts()
    } catch (err) {
      logger.error('Failed to register global shortcuts', { error: err instanceof Error ? err.message : String(err) })
    }
    try {
      startTimerEngine()
    } catch (err) {
      logger.error('Failed to start timer engine', { error: err instanceof Error ? err.message : String(err) })
    }
    // Check for updates after a short delay (non-blocking).
    if (!isDev) {
      updateCheckTimeout = setTimeout(() => {
        updateCheckTimeout = null
        checkForUpdates().then((update) => {
          if (update && mainWindow && !mainWindow.isDestroyed()) {
            mainWindow.webContents.send('updater:available', update)
          }
        }).catch(() => {})
      }, 10000)
    }
  }

  if (mainWindow && !mainWindow.isDestroyed()) {
    // If the window has already shown by the time we get here, run immediately;
    // otherwise wait for the first paint.
    if (mainWindow.isVisible()) {
      scheduleDeferredStartup()
    } else {
      mainWindow.once('show', scheduleDeferredStartup)
      // Safety net: if `show` somehow never fires (e.g. window destroyed early),
      // still schedule after 5s. The flag above guarantees a single execution.
      setTimeout(scheduleDeferredStartup, 5000)
    }
  } else {
    scheduleDeferredStartup()
  }
})

app.on('before-quit', () => {
  if (updateCheckTimeout) {
    clearTimeout(updateCheckTimeout)
    updateCheckTimeout = null
  }
  releaseWorkspaceLockSync(currentWorkspaceLock)
  currentWorkspaceLock = null
})

app.on('window-all-closed', async () => {
  if (updateCheckTimeout) {
    clearTimeout(updateCheckTimeout)
    updateCheckTimeout = null
  }
  stopTimerEngine()
  globalShortcut.unregisterAll()
  // Stop the channel webhook server so it doesn't keep listening when the
  // app is fully closed (especially on macOS where the process lingers).
  try {
    await channelService.stop()
  } catch (err) {
    logger.error('Failed to stop channel service', { error: err instanceof Error ? err.message : String(err) })
  }
  await closeSuoraDatabase()
  // Close file watchers
  for (const [, watcher] of activeWatchers) {
    watcher.close()
  }
  activeWatchers.clear()
  if (automationWindow && !automationWindow.isDestroyed()) {
    automationWindow.destroy()
    automationWindow = null
  }
  // Close logger
  await closeLogger()
  logger.info('Suora stopped')
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

app.on('activate', () => {
  if (mainWindow === null) {
    createWindow()
  }
})
