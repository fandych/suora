// File-based session persistence
// Structure: {workspacePath}/sessions/{sessionId}/conversation.json
//            {workspacePath}/sessions/{sessionId}/memories.json

import type { Session, AgentMemoryEntry } from '@/types'
import { logger } from '@/services/logger'
import { safePathSegment } from '@/utils/pathSegments'
import { safeParse, safeStringify } from '@/utils/safeJson'

type ElectronBridge = { invoke: (ch: string, ...args: unknown[]) => Promise<unknown> }

function getElectron(): ElectronBridge | undefined {
  return (window as unknown as { electron?: ElectronBridge }).electron
}

/** Lightweight runtime validator — ensures a loaded blob actually looks like a Session. */
function isValidSession(value: unknown): value is Session {
  if (!value || typeof value !== 'object') return false
  const v = value as Partial<Session>
  return typeof v.id === 'string' && Array.isArray(v.messages)
}

function sessionsRoot(workspacePath: string): string {
  return `${workspacePath}/sessions`
}

function sessionDir(workspacePath: string, sessionId: string): string {
  return `${sessionsRoot(workspacePath)}/${safePathSegment(sessionId, 'session')}`
}

function conversationPath(workspacePath: string, sessionId: string): string {
  return `${sessionDir(workspacePath, sessionId)}/conversation.json`
}

function memoriesPath(workspacePath: string, sessionId: string): string {
  return `${sessionDir(workspacePath, sessionId)}/memories.json`
}

// ─── Conversation persistence ──────────────────────────────────────

/** Load all sessions (conversation.json) from disk */
export async function loadSessionsFromDisk(workspacePath: string): Promise<Session[]> {
  const electron = getElectron()
  if (!electron || !workspacePath) return []

  try {
    const entries = (await electron.invoke('fs:listDir', sessionsRoot(workspacePath))) as
      | { name: string; isDirectory: boolean; path: string }[]
      | { error: string }

    if (!Array.isArray(entries)) return [] // dir doesn't exist yet

    const sessions: Session[] = []
    for (const entry of entries) {
      if (!entry.isDirectory) continue
      const filePath = `${entry.path}/conversation.json`
      let raw: unknown
      try {
        raw = await electron.invoke('fs:readFile', filePath)
      } catch (readErr) {
        logger.warn('[sessionFiles] Failed to read session file', {
          filePath,
          error: readErr instanceof Error ? readErr.message : String(readErr),
        })
        continue
      }
      if (typeof raw !== 'string') continue
      let parsed: unknown
      try {
        parsed = safeParse(raw)
      } catch (parseErr) {
        logger.error('[sessionFiles] Corrupted conversation file — skipping', {
          filePath,
          error: parseErr instanceof Error ? parseErr.message : String(parseErr),
        })
        continue
      }
      if (!isValidSession(parsed)) {
        logger.warn('[sessionFiles] Conversation file has invalid shape — skipping', { filePath })
        continue
      }
      sessions.push(parsed)
    }
    // Sort by updatedAt descending (newest first)
    sessions.sort((a, b) => b.updatedAt - a.updatedAt)
    return sessions
  } catch {
    return []
  }
}

/** Save a session's conversation to disk */
export async function saveSessionToDisk(workspacePath: string, session: Session): Promise<boolean> {
  const electron = getElectron()
  if (!electron || !workspacePath) return false

  try {
    const dir = sessionDir(workspacePath, session.id)
    const ensureResult = await electron.invoke('system:ensureDirectory', dir) as { error?: string }
    if (ensureResult?.error) return false
    const json = safeStringify(session, 2)
    const result = (await electron.invoke(
      'fs:writeFile',
      conversationPath(workspacePath, session.id),
      json,
    )) as { success?: boolean }
    return result?.success ?? false
  } catch {
    return false
  }
}

/** Delete an entire session directory from disk */
export async function deleteSessionFromDisk(workspacePath: string, sessionId: string): Promise<boolean> {
  const electron = getElectron()
  if (!electron || !workspacePath) return false

  try {
    const dir = sessionDir(workspacePath, sessionId)
    const result = (await electron.invoke('fs:deleteDir', dir)) as { success?: boolean }
    return result?.success ?? false
  } catch {
    return false
  }
}

// ─── Session memories persistence ──────────────────────────────────

/** Load session-specific memories */
export async function loadSessionMemories(workspacePath: string, sessionId: string): Promise<AgentMemoryEntry[]> {
  const electron = getElectron()
  if (!electron || !workspacePath) return []

  const filePath = memoriesPath(workspacePath, sessionId)
  let raw: unknown
  try {
    raw = await electron.invoke('fs:readFile', filePath)
  } catch (readErr) {
    // Benign when memories file simply doesn't exist yet; log otherwise.
    const msg = readErr instanceof Error ? readErr.message : String(readErr)
    if (!/ENOENT|no such file|not found/i.test(msg)) {
      logger.warn('[sessionFiles] Failed to read memories file', { filePath, error: msg })
    }
    return []
  }
  if (typeof raw !== 'string') return []
  try {
    const parsed = safeParse(raw)
    return Array.isArray(parsed) ? (parsed as AgentMemoryEntry[]) : []
  } catch (parseErr) {
    logger.error('[sessionFiles] Corrupted memories file — returning empty', {
      filePath,
      error: parseErr instanceof Error ? parseErr.message : String(parseErr),
    })
    return []
  }
}

/** Save session-specific memories */
export async function saveSessionMemories(workspacePath: string, sessionId: string, memories: AgentMemoryEntry[]): Promise<boolean> {
  const electron = getElectron()
  if (!electron || !workspacePath) return false

  try {
    const dir = sessionDir(workspacePath, sessionId)
    const ensureResult = await electron.invoke('system:ensureDirectory', dir) as { error?: string }
    if (ensureResult?.error) return false
    const json = safeStringify(memories, 2)
    const result = (await electron.invoke(
      'fs:writeFile',
      memoriesPath(workspacePath, sessionId),
      json,
    )) as { success?: boolean }
    return result?.success ?? false
  } catch {
    return false
  }
}
