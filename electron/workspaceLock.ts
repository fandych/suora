import fs from 'fs/promises'
import { readFileSync, unlinkSync } from 'fs'
import path from 'path'

export interface WorkspaceLockInfo {
  pid: number
  token: string
  startedAt: string
  execPath: string
  workspacePath: string
}

export interface WorkspaceLock {
  workspacePath: string
  lockPath: string
  info: WorkspaceLockInfo
}

export interface WorkspaceLockOptions {
  pid?: number
  execPath?: string
  isProcessAlive?: (pid: number) => boolean
  now?: () => Date
  token?: string
}

export class WorkspaceLockError extends Error {
  readonly workspacePath: string
  readonly lockPath: string
  readonly existing: WorkspaceLockInfo | null

  constructor(workspacePath: string, lockPath: string, existing: WorkspaceLockInfo | null) {
    const pid = existing?.pid ? ` by process ${existing.pid}` : ''
    super(`Workspace is already in use${pid}: ${workspacePath}`)
    this.name = 'WorkspaceLockError'
    this.workspacePath = workspacePath
    this.lockPath = lockPath
    this.existing = existing
  }
}

const LOCK_FILE_NAME = '.suora-workspace.lock'

function defaultIsProcessAlive(pid: number): boolean {
  if (!Number.isInteger(pid) || pid <= 0 || pid === process.pid) return false
  try {
    process.kill(pid, 0)
    return true
  } catch {
    return false
  }
}

function makeToken(pid: number): string {
  return `${pid}-${Date.now()}-${Math.random().toString(36).slice(2)}`
}

function parseLockInfo(raw: string): WorkspaceLockInfo | null {
  try {
    const parsed = JSON.parse(raw) as Partial<WorkspaceLockInfo>
    if (typeof parsed.pid !== 'number' || !Number.isInteger(parsed.pid)) return null
    if (typeof parsed.token !== 'string' || parsed.token.length === 0) return null
    if (typeof parsed.workspacePath !== 'string' || parsed.workspacePath.length === 0) return null
    return {
      pid: parsed.pid,
      token: parsed.token,
      startedAt: typeof parsed.startedAt === 'string' ? parsed.startedAt : '',
      execPath: typeof parsed.execPath === 'string' ? parsed.execPath : '',
      workspacePath: parsed.workspacePath,
    }
  } catch {
    return null
  }
}

async function readLockInfo(lockPath: string): Promise<WorkspaceLockInfo | null> {
  try {
    return parseLockInfo(await fs.readFile(lockPath, 'utf-8'))
  } catch {
    return null
  }
}

export async function acquireWorkspaceLock(workspacePath: string, options: WorkspaceLockOptions = {}): Promise<WorkspaceLock> {
  const resolvedWorkspacePath = path.resolve(workspacePath)
  await fs.mkdir(resolvedWorkspacePath, { recursive: true })

  const pid = options.pid ?? process.pid
  const lockPath = path.join(resolvedWorkspacePath, LOCK_FILE_NAME)
  const info: WorkspaceLockInfo = {
    pid,
    token: options.token ?? makeToken(pid),
    startedAt: (options.now ?? (() => new Date()))().toISOString(),
    execPath: options.execPath ?? process.execPath,
    workspacePath: resolvedWorkspacePath,
  }
  const isProcessAlive = options.isProcessAlive ?? defaultIsProcessAlive

  for (let attempt = 0; attempt < 2; attempt += 1) {
    let handle: fs.FileHandle | null = null
    try {
      handle = await fs.open(lockPath, 'wx')
      await handle.writeFile(JSON.stringify(info, null, 2), 'utf-8')
      return { workspacePath: resolvedWorkspacePath, lockPath, info }
    } catch (error) {
      const code = (error as NodeJS.ErrnoException).code
      if (code !== 'EEXIST') throw error

      const existing = await readLockInfo(lockPath)
      if (existing && isProcessAlive(existing.pid)) {
        throw new WorkspaceLockError(resolvedWorkspacePath, lockPath, existing)
      }

      await fs.unlink(lockPath).catch(() => {})
    } finally {
      await handle?.close().catch(() => {})
    }
  }

  const existing = await readLockInfo(lockPath)
  throw new WorkspaceLockError(resolvedWorkspacePath, lockPath, existing)
}

export async function releaseWorkspaceLock(lock: WorkspaceLock | null): Promise<void> {
  if (!lock) return
  const existing = await readLockInfo(lock.lockPath)
  if (existing?.token !== lock.info.token) return
  await fs.unlink(lock.lockPath).catch(() => {})
}

export function releaseWorkspaceLockSync(lock: WorkspaceLock | null): void {
  if (!lock) return
  try {
    const raw = readFileSync(lock.lockPath, 'utf-8')
    const existing = parseLockInfo(raw)
    if (existing?.token === lock.info.token) unlinkSync(lock.lockPath)
  } catch {
    // best-effort cleanup only
  }
}