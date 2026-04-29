import { app, BrowserWindow, ipcMain, shell, clipboard, Notification, desktopCapturer, Tray, Menu, globalShortcut, nativeImage, safeStorage } from 'electron'
import { fileURLToPath } from 'url'
import path from 'path'
import os from 'os'
import fs from 'fs/promises'
import { readFileSync, watch, type FSWatcher } from 'fs'
import http, { type IncomingMessage } from 'http'
import { execFile } from 'child_process'
import crypto from 'crypto'
import https from 'https'
import net from 'net'
import dns from 'dns'
import { CronExpressionParser } from 'cron-parser'
import { MAX_IPC_TEXT_FILE_BYTES, atomicWriteFile, canonicalizePathSync, isWithinRoot, readTextFileRange, readTextFileWithLimit, resolveUserPath } from './fsUtils.js'
import { initLogger, getLogger, closeLogger, type LogLevel } from './logger.js'
import { getChannelService, type ChannelWebhookEvent } from './channelService.js'
import { openSuoraDatabase, type JsonTableName, type SuoraDatabase } from './database.js'
import type { ChannelConfig } from '../src/types/index.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const isDev = !app.isPackaged

const GITHUB_RELEASES_URL = 'https://api.github.com/repos/fandych/suora/releases/latest'

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
  const opts = typeof options === 'number' ? { family: options } : options
  dns.lookup(hostname, opts, (err: NodeJS.ErrnoException | null, address: string | dns.LookupAddress[], family: number) => {
    if (err) {
      callback(err, address, family)
      return
    }
    const ips = Array.isArray(address) ? address.map((entry) => entry.address) : [address as string]
    for (const ip of ips) {
      if (isBlockedIp(ip)) {
        callback(new Error(`Blocked private/local network IP for ${hostname}: ${ip}`), address, family)
        return
      }
    }
    callback(null, address, family)
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

function compareSemverLike(a: string, b: string): number {
  const parse = (value: string) => value.replace(/^v/i, '').split(/[.-]/).map((part) => Number.parseInt(part, 10)).map((part) => Number.isFinite(part) ? part : 0)
  const left = parse(a)
  const right = parse(b)
  const len = Math.max(left.length, right.length)
  for (let i = 0; i < len; i++) {
    const diff = (left[i] ?? 0) - (right[i] ?? 0)
    if (diff !== 0) return diff > 0 ? 1 : -1
  }
  return 0
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
    const config = JSON.parse(raw) as { workspacePath?: string }
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
let suoraDatabase: SuoraDatabase | null = null
let suoraDatabaseWorkspacePath: string | null = null

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
}

function isJsonTableName(table: unknown): table is JsonTableName {
  return typeof table === 'string' && DB_JSON_TABLES.has(table as JsonTableName)
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
    icon: path.join(__dirname, '../../resources/icons/icon-256x256.png'),
    webPreferences: {
      preload: preloadPath,
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true,
    },
  })

  if (windowState.isMaximized) {
    mainWindow.maximize()
  }

  mainWindow.setMenuBarVisibility(false)

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

  if (isDev && process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    mainWindow.loadFile(path.join(__dirname, '../renderer/index.html'))
  }

  // Save window state on resize/move/close
  mainWindow.on('close', () => {
    if (mainWindow) saveWindowState(mainWindow)
  })

  // Minimize to tray instead of closing on macOS
  mainWindow.on('closed', () => {
    mainWindow = null
  })
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

ipcMain.handle('workspace:getBootConfig', async () => {
  try {
    const bootConfigPath = getBootConfigPath()
    const data = await fs.readFile(bootConfigPath, 'utf-8')
    const config = JSON.parse(data) as { workspacePath?: string }
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
    const data = JSON.parse(raw) as Record<string, { name: string; total: number; category?: string }>
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
    if (!resolvedPath.startsWith(path.resolve(jsonDir))) return null
    const raw = await fs.readFile(resolvedPath, 'utf-8')
    return JSON.parse(raw)
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
    if (!resolvedPath.startsWith(path.resolve(jsonDir))) return []
    const raw = await fs.readFile(resolvedPath, 'utf-8')
    const data = JSON.parse(raw)
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

interface ShellExecResult {
  stdout: string
  stderr: string
  error?: string
}

ipcMain.handle('shell:exec', async (_event, command: unknown): Promise<ShellExecResult> => {
  if (typeof command !== 'string' || !command.trim()) {
    return { stdout: '', stderr: '', error: 'Command must be a non-empty string' }
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

  return new Promise<ShellExecResult>((resolve) => {
    // Minimal env — never inherit `process.env`, which contains API keys
    // (ANTHROPIC_API_KEY, OPENAI_API_KEY, etc.) loaded by the renderer.
    const minimalEnv: NodeJS.ProcessEnv = {
      PATH: process.env.PATH ?? '',
      HOME: process.env.HOME ?? '',
      LANG: process.env.LANG ?? 'C.UTF-8',
    }
    if (process.platform === 'win32') {
      minimalEnv.SYSTEMROOT = process.env.SYSTEMROOT ?? ''
      minimalEnv.USERPROFILE = process.env.USERPROFILE ?? ''
      minimalEnv.TEMP = process.env.TEMP ?? ''
      minimalEnv.TMP = process.env.TMP ?? ''
    }
    execFile(
      bin,
      args,
      {
        timeout: 30_000,
        maxBuffer: 1024 * 1024,
        cwd: currentWorkspacePath,
        windowsHide: true,
        env: minimalEnv,
      },
      (error, stdout, stderr) => {
        resolve({
          stdout: stdout?.toString() || '',
          stderr: stderr?.toString() || '',
          error: error ? error.message : undefined,
        })
      },
    )
  })
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
    const updated = content.replace(oldText, newText)
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
      excludeRegex = new RegExp(excludePattern.replace(/\*/g, '.*'), 'i')
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
          if (filePattern && !entry.name.match(new RegExp(filePattern.replace(/\*/g, '.*'), 'i'))) continue
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

    // Convert simple glob pattern to regex
    function globToRegex(glob: string): RegExp {
      let re = glob
        .replace(/\./g, '\\.')
        .replace(/\*\*/g, '{{DOUBLESTAR}}')
        .replace(/\*/g, '[^/\\\\]*')
        .replace(/\?/g, '[^/\\\\]')
        .replace(/\{\{DOUBLESTAR\}\}/g, '.*')
      return new RegExp(`^${re}$`, 'i')
    }

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

// ─── IPC Handlers: Web Search ──────────────────────────────────────

interface SearchResult {
  title: string
  url: string
  snippet: string
}

interface WebSearchResponse {
  query: string
  instant_answer?: string
  instant_answer_type?: string
  instant_answer_source?: string
  instant_answer_url?: string
  results: SearchResult[]
  error?: string
}

/**
 * Parse DuckDuckGo HTML search results page to extract real web search results.
 * Uses the HTML-lite endpoint which returns actual search results (unlike the
 * Instant Answer JSON API which only returns Wikipedia-style topics).
 */
function parseDDGHtml(html: string, query: string): WebSearchResponse {
  const results: SearchResult[] = []

  // DuckDuckGo HTML results are in <div class="result ..."> blocks
  // Each contains <a class="result__a"> for title/URL and <a class="result__snippet"> for snippet
  const resultBlockRegex = /<div[^>]*class="[^"]*result(?:__body|s_links_deep)[^"]*"[^>]*>([\s\S]*?)(?=<div[^>]*class="[^"]*result(?:__body|s_links_deep)|$)/gi
  const titleRegex = /<a[^>]*class="[^"]*result__a[^"]*"[^>]*href="([^"]*)"[^>]*>([\s\S]*?)<\/a>/i
  const snippetRegex = /<a[^>]*class="[^"]*result__snippet[^"]*"[^>]*>([\s\S]*?)<\/a>/i

  // Also try a simpler pattern that matches the actual DDG HTML structure
  const simpleResultRegex = /<a[^>]*class="result__a"[^>]*href="([^"]*)"[^>]*>([\s\S]*?)<\/a>/gi
  const snippetResults: { url: string; title: string }[] = []
  let match: RegExpExecArray | null

  while ((match = simpleResultRegex.exec(html)) !== null) {
    let url = match[1]
    const title = match[2].replace(/<[^>]+>/g, '').trim()
    if (!url || !title) continue

    // DDG wraps URLs in a redirect: //duckduckgo.com/l/?uddg=ENCODED_URL&...
    const uddgMatch = url.match(/[?&]uddg=([^&]+)/)
    if (uddgMatch) {
      url = decodeURIComponent(uddgMatch[1])
    }
    // Skip ad links and internal DDG links
    if (url.startsWith('https://duckduckgo.com') || url.startsWith('//duckduckgo.com')) continue
    if (!url.startsWith('http')) continue

    snippetResults.push({ url, title })
  }

  // Now find snippets by scanning for result__snippet near each result
  const snippetBlockRegex = /<a[^>]*class="result__snippet"[^>]*>([\s\S]*?)<\/a>/gi
  const snippets: string[] = []
  while ((match = snippetBlockRegex.exec(html)) !== null) {
    snippets.push(match[1].replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim())
  }

  for (let i = 0; i < snippetResults.length && results.length < 10; i++) {
    results.push({
      title: snippetResults[i].title,
      url: snippetResults[i].url,
      snippet: snippets[i] || '',
    })
  }

  // If the simple regex didn't work, try matching full result blocks
  if (results.length === 0) {
    let blockMatch: RegExpExecArray | null
    while ((blockMatch = resultBlockRegex.exec(html)) !== null && results.length < 10) {
      const block = blockMatch[1]
      const tMatch = titleRegex.exec(block)
      const sMatch = snippetRegex.exec(block)
      if (!tMatch) continue

      let url = tMatch[1]
      const title = tMatch[2].replace(/<[^>]+>/g, '').trim()
      const snippet = sMatch ? sMatch[1].replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim() : ''

      const uddgMatch = url.match(/[?&]uddg=([^&]+)/)
      if (uddgMatch) url = decodeURIComponent(uddgMatch[1])
      if (!url.startsWith('http')) continue

      results.push({ title, url, snippet })
    }
  }

  return { query, results }
}

/** Make an HTTPS request that follows redirects (up to 5) and returns the response body */
function httpsRequest(
  url: string,
  options: { method?: string; headers?: Record<string, string>; body?: string; timeout?: number },
  maxRedirects = 5,
): Promise<{ statusCode: number; body: string }> {
  return new Promise((resolve, reject) => {
    const reqModule = url.startsWith('https') ? https : http
    const method = options.method ?? 'GET'
    const reqOptions: https.RequestOptions = {
      method,
      headers: options.headers ?? {},
      lookup: safeDnsLookup,
    }

    const req = reqModule.request(url, reqOptions, (res: IncomingMessage) => {
      // Follow redirects
      const redirectLocation = Array.isArray(res.headers.location) ? res.headers.location[0] : res.headers.location
      if ((res.statusCode === 301 || res.statusCode === 302 || res.statusCode === 303) && redirectLocation && maxRedirects > 0) {
        let redirectUrl = redirectLocation
        if (redirectUrl.startsWith('/')) {
          const parsed = new URL(url)
          redirectUrl = `${parsed.protocol}//${parsed.host}${redirectUrl}`
        }
        res.destroy()
        httpsRequest(redirectUrl, options, maxRedirects - 1).then(resolve).catch(reject)
        return
      }

      const MAX_BODY = 1024 * 1024 // 1 MB
      let body = ''
      let overflow = false
      res.on('data', (chunk: Buffer | string) => {
        body += chunk.toString()
        if (body.length > MAX_BODY) {
          overflow = true
          res.destroy()
        }
      })
      res.on('end', () => {
        if (overflow) {
          reject(new Error('Response too large'))
          return
        }
        resolve({ statusCode: res.statusCode ?? 0, body })
      })
    })
    req.on('error', (err: Error) => reject(err))
    req.setTimeout(options.timeout ?? 15_000, () => {
      req.destroy()
      reject(new Error('Request timed out'))
    })
    if (options.body) req.write(options.body)
    req.end()
  })
}

ipcMain.handle('web:search', async (_event, query: string) => {
  try {
    // Use DuckDuckGo HTML-lite search for real web search results
    const searchUrl = 'https://html.duckduckgo.com/html/'
    const body = `q=${encodeURIComponent(query)}`

    const response = await httpsRequest(searchUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      },
      body,
      timeout: 15_000,
    })

    return parseDDGHtml(response.body, query)
  } catch (err: unknown) {
    return { query, results: [], error: err instanceof Error ? err.message : String(err) } as WebSearchResponse
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

type HttpGetFn = (url: string, options: Record<string, unknown>, callback: (res: FetchResponse) => void) => FetchRequest

function fetchUrl(url: string, redirectsLeft = 5): Promise<{ body: string; rawTruncated: boolean }> {
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
      { headers: { 'User-Agent': 'Mozilla/5.0 Suora/1.0', Accept: 'text/html' }, lookup: safeDnsLookup },
      (res: FetchResponse) => {
        if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
          const next = new URL(res.headers.location as string, url).toString()
          res.resume()
          resolve(fetchUrl(next, redirectsLeft - 1))
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
          } else if (!rawTruncated) {
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

function validateBrowserUrl(url: string): void {
  const parsed = new URL(url)
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    throw new Error('Only http and https URLs are allowed')
  }
}

async function navigateAutomationWindow(url: string): Promise<BrowserWindow> {
  validateBrowserUrl(url)
  // Best-effort DNS rebinding protection for browser navigation: resolve
  // the hostname and reject if any A/AAAA points at a private/loopback IP.
  await validatePublicHttpUrlWithDns(url)
  const win = getAutomationWindow()
  await Promise.race([
    win.loadURL(url),
    new Promise((_, reject) => setTimeout(() => reject(new Error('Navigation timed out')), BROWSER_TIMEOUT)),
  ])
  return win
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

ipcMain.handle('browser:screenshot', async (_event, url?: string) => {
  try {
    if (url) {
      await navigateAutomationWindow(url)
    }
    const win = getAutomationWindow()
    if (win.isDestroyed()) {
      return { error: 'No automation window available. Navigate to a URL first.' }
    }
    const image = await win.webContents.capturePage()
    const base64 = image.toPNG().toString('base64')
    return { image: base64, format: 'png' }
  } catch (err: unknown) {
    return { error: err instanceof Error ? err.message : String(err) }
  }
})

ipcMain.handle('browser:evaluate', async (_event, url: string, expression: string) => {
  try {
    validatePublicHttpUrl(url)
    const script = SAFE_BROWSER_EVALUATIONS[expression]
    if (!script) {
      return { error: `Unsupported browser evaluation: ${expression}. Allowed: ${Object.keys(SAFE_BROWSER_EVALUATIONS).join(', ')}` }
    }
    await navigateAutomationWindow(url)
    const win = getAutomationWindow()
    const result = await Promise.race([
      win.webContents.executeJavaScript(script),
      new Promise((_, reject) => setTimeout(() => reject(new Error('Script execution timed out')), BROWSER_TIMEOUT)),
    ])
    return { result: typeof result === 'string' ? result : JSON.stringify(result) }
  } catch (err: unknown) {
    return { error: err instanceof Error ? err.message : String(err) }
  }
})

ipcMain.handle('browser:extractLinks', async (_event, url: string) => {
  try {
    await navigateAutomationWindow(url)
    const win = getAutomationWindow()
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

ipcMain.handle('browser:extractText', async (_event, url: string) => {
  try {
    await navigateAutomationWindow(url)
    const win = getAutomationWindow()
    const text = await win.webContents.executeJavaScript(
      `document.body ? document.body.innerText : ''`
    )
    return { text: String(text).slice(0, 16000), truncated: String(text).length > 16000 }
  } catch (err: unknown) {
    return { error: err instanceof Error ? err.message : String(err) }
  }
})

ipcMain.handle('browser:fillForm', async (_event, url: string, selector: string, value: string) => {
  try {
    await navigateAutomationWindow(url)
    const win = getAutomationWindow()
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

ipcMain.handle('browser:click', async (_event, url: string, selector: string) => {
  try {
    await navigateAutomationWindow(url)
    const win = getAutomationWindow()
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
}

interface TimerExecutionRecord {
  id: string
  timerId: string
  firedAt: number
  action: 'notify' | 'prompt' | 'pipeline'
  prompt?: string
  agentId?: string
  pipelineId?: string
  pipelineExecutionId?: string
  sessionId?: string
  status: 'success' | 'error'
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
ipcMain.handle('timer:update', async (_event, id: string, updates: Partial<Pick<StoredTimer, 'name' | 'type' | 'schedule' | 'action' | 'prompt' | 'enabled' | 'agentId' | 'pipelineId'>>) => {
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

ipcMain.handle('timer:updateExecution', async (_event, data: {
  timerId: string
  firedAt: number
  status: 'success' | 'error'
  error?: string
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
        error: data.status === 'error' ? data.error : undefined,
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

          // Record execution history
          const execution: TimerExecutionRecord = {
            id: `exec-${crypto.randomUUID()}`,
            timerId: timer.id,
            firedAt: now,
            action: timer.action,
            prompt: timer.prompt,
            agentId: timer.agentId,
            pipelineId: timer.pipelineId,
            status: 'success',
          }
          appendTimerExecution(execution).catch(() => { /* ignore */ })

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

const channelService = getChannelService(process.env.CHANNEL_PORT ? parseInt(process.env.CHANNEL_PORT) : 3000)

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

// ─── IPC Handlers: Logging ──────────────────────────────────────────

ipcMain.handle('log:write', (_event, level: LogLevel, message: string, meta?: unknown) => {
  const logger = getLogger()
  switch (level) {
    case 'debug':
      logger.debug(message, meta)
      break
    case 'info':
      logger.info(message, meta)
      break
    case 'warn':
      logger.warn(message, meta)
      break
    case 'error':
      logger.error(message, meta)
      break
  }
  return { success: true }
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
    return JSON.parse(content) as WindowState
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

let updateCheckInProgress = false

async function checkForUpdates(feedUrl?: string): Promise<UpdateInfo | null> {
  if (updateCheckInProgress) return null
  updateCheckInProgress = true
  try {
    const url = validatePublicHttpUrl(feedUrl || GITHUB_RELEASES_URL, new Set(['api.github.com'])).toString()
    logger.info('Checking for updates', { url })
    
    return await new Promise<UpdateInfo | null>((resolve) => {
      const proto = url.startsWith('https') ? https : http
      const req = proto.get(url, { headers: { 'User-Agent': 'suora', Accept: 'application/json' } }, (res) => {
        let data = ''
        res.on('data', (chunk: Buffer) => { data += chunk.toString() })
        res.on('end', () => {
          try {
            const json = JSON.parse(data)
            const latestVersion = (json.tag_name || json.version || '').replace(/^v/, '')
            const currentVersion = app.getVersion()
            if (latestVersion && compareSemverLike(latestVersion, currentVersion) > 0) {
              resolve({
                version: latestVersion,
                releaseDate: json.published_at || new Date().toISOString(),
                releaseNotes: json.body || '',
                downloadUrl: json.html_url || json.download_url || '',
              })
            } else {
              resolve(null)
            }
          } catch {
            resolve(null)
          }
        })
      })
      req.on('error', () => resolve(null))
      req.setTimeout(15000, () => { req.destroy(); resolve(null) })
    })
  } finally {
    updateCheckInProgress = false
  }
}

ipcMain.handle('updater:check', async (_event, feedUrl?: string) => {
  const update = await checkForUpdates(feedUrl ?? undefined)
  if (update && mainWindow) {
    mainWindow.webContents.send('updater:available', update)
  }
  return update
})

ipcMain.handle('updater:getVersion', () => app.getVersion())

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
        return JSON.parse(content)
      })
    )
    return logs.sort((a: { timestamp: string }, b: { timestamp: string }) => b.timestamp.localeCompare(a.timestamp))
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
  await createWindow()
  createTray()
  registerGlobalShortcuts()
  startTimerEngine()
  // Check for updates after 10s delay (non-blocking)
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
})

app.on('before-quit', () => {
  if (updateCheckTimeout) {
    clearTimeout(updateCheckTimeout)
    updateCheckTimeout = null
  }
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
