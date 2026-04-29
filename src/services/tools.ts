// Built-in tool definitions and skill registry
//
// Architecture aligned with Claude Code source:
// - Tools have metadata (ToolMeta): isReadOnly, isDestructive, isConcurrencySafe, requiresConfirmation
// - Permission system: 3-level check (validate → checkPermissions → confirm)
// - Tools filtered by agent's allowedTools (allowlist) and disallowedTools (denylist)
// - Skills are tool groupings with optional system prompt

import { tool, type ToolSet } from 'ai'
import { z } from 'zod'
import type { DocumentGroup, DocumentItem, DocumentNode, Skill, ToolMeta, ToolSecuritySettings } from '@/types'
import { getPluginTools } from '@/services/pluginSystem'
import { logger } from '@/services/logger'
import { serializeSkillToMarkdown } from '@/services/skillRegistry'
import {
  getIndex,
  rebuildIndexFromStore,
  addToIndex,
  removeFromIndex,
  searchSimilar,
} from '@/services/vectorMemory'
import { readCached, writeCached } from '@/services/fileStorage'
import { delegateToAgent } from '@/services/agentCommunication'
import { confirmChoice } from '@/services/confirmDialog'
import { safePathSegment } from '@/utils/pathSegments'
import { safeParse, safeStringify } from '@/utils/safeJson'

const OFFICIAL_MARKETPLACE_URL = 'https://raw.githubusercontent.com/suora-market/skills/main/skills.json'

// ─── Constants ─────────────────────────────────────────────────────

const PREVIEW_LENGTH = 80
const DEFAULT_BLOCKED_COMMANDS = ['rm -rf', 'del /f /q', 'format', 'shutdown']

/** Shape of the persisted store state used by memory tools to avoid circular import with appStore. */
interface PersistedMemoryEntry {
  id: string
  content: string
  type: string
  scope: 'session' | 'global'
  createdAt: number
  source?: string
}

interface PersistedAgentEntry {
  id: string
  name?: string
  enabled?: boolean
  systemPrompt?: string
  modelId?: string
  skills?: string[]
  memories?: PersistedMemoryEntry[]
}

interface PersistedStoreShape {
  state?: {
    selectedAgent?: { id?: string }
    agents?: PersistedAgentEntry[]
    globalMemories?: PersistedMemoryEntry[]
    activeSessionId?: string
  }
}

// ─── Electron IPC bridge ───────────────────────────────────────────

function electronInvoke(channel: string, ...args: unknown[]): Promise<unknown> {
  const electron = (window as unknown as { electron?: { invoke: (ch: string, ...a: unknown[]) => Promise<unknown> } }).electron
  if (!electron?.invoke) {
    return Promise.reject(new Error('Electron IPC not available — running in browser mode'))
  }
  return electron.invoke(channel, ...args)
}

function splitGitPathspecInput(value: string): string[] {
  const matches = value.match(/"(?:\\.|[^"])*"|'(?:\\.|[^'])*'|\S+/g)
  if (!matches) return []

  return matches
    .map((entry) => entry.trim())
    .filter((entry) => entry.length > 0)
    .map((entry) => {
      if ((entry.startsWith('"') && entry.endsWith('"')) || (entry.startsWith("'") && entry.endsWith("'"))) {
        return entry.slice(1, -1)
      }
      return entry
    })
}

// ─── Store helpers (avoid circular import with appStore) ──────────

const STORE_KEY = 'suora-store'
const EVENTS_STORAGE_KEY = 'suora-event-triggers'

// Late-binding accessor for live Zustand store state (set by appStore after creation)
let _liveStoreAccessor: (() => Record<string, unknown>) | null = null
let _liveStoreWriter: ((updater: (state: Record<string, unknown>) => void) => void) | null = null

/**
 * Register a live store state accessor to avoid reading from the file cache.
 * Called once from appStore.ts after the store is created.
 */
export function setLiveStoreAccessor(accessor: () => Record<string, unknown>) {
  _liveStoreAccessor = accessor
}

export function setLiveStoreWriter(writer: (updater: (state: Record<string, unknown>) => void) => void) {
  _liveStoreWriter = writer
}

function readStoreState(): Record<string, unknown> | null {
  // Prefer live Zustand state for real-time accuracy
  if (_liveStoreAccessor) {
    try {
      return _liveStoreAccessor()
    } catch {
      // live accessor failed — do NOT fall through to stale file cache;
      // return null so callers know state is unavailable.
      return null
    }
  }
  // No live accessor registered yet (initial boot) — read from persisted cache
  try {
    const raw = readCached(STORE_KEY)
    if (!raw) return null
    const parsed = safeParse<{ state?: Record<string, unknown> }>(raw)
    return parsed.state || null
  } catch {
    return null
  }
}

/**
 * Public accessor for live store state — used by modules that need real-time
 * state without importing appStore directly (e.g. agentCommunication.ts).
 */
export { readStoreState as readLiveStoreState }

function writeStoreState(updater: (state: Record<string, unknown>) => void): boolean {
  if (_liveStoreWriter) {
    try {
      _liveStoreWriter(updater)
      return true
    } catch {
      return false
    }
  }

  try {
    const raw = readCached(STORE_KEY)
    if (!raw) return false
    const store = safeParse<{ state: Record<string, unknown> }>(raw)
    updater(store.state)
    const serialized = safeStringify(store)
    writeCached(STORE_KEY, serialized)
    window.dispatchEvent(new StorageEvent('storage', { key: STORE_KEY, newValue: serialized }))
    return true
  } catch {
    return false
  }
}

/**
 * Resolve and normalize a file path for safe comparison.
 * Uses the same logic as Node path.resolve — resolves '..' segments
 * and produces an absolute, lower-cased, forward-slash path to prevent
 * directory-traversal bypasses.
 */
function normalizePath(input: string): string {
  // Resolve '..' and '.' segments to produce a clean absolute path.
  // We cannot import Node's `path` in the renderer, so we do it manually.
  const replaced = input.replace(/\\/g, '/')
  const parts = replaced.split('/')
  const resolved: string[] = []
  for (const part of parts) {
    if (part === '..') {
      resolved.pop()
    } else if (part !== '.' && part !== '') {
      resolved.push(part)
    }
  }
  // Preserve leading slash for Unix paths or drive letter for Windows (e.g. "C:")
  const leading = replaced.startsWith('/') ? '/' : ''
  return (leading + resolved.join('/')).toLowerCase()
}

function getPersistedSecuritySettings() {
  const liveState = readStoreState()
  const liveSecurity = liveState?.toolSecurity as Partial<ToolSecuritySettings> | undefined
  if (liveSecurity) {
    return {
      allowedDirectories: liveSecurity.allowedDirectories || [],
      blockedCommands: liveSecurity.blockedCommands || DEFAULT_BLOCKED_COMMANDS,
      requireConfirmation: liveSecurity.requireConfirmation ?? true,
      sandboxMode: liveSecurity.sandboxMode === 'relaxed' ? 'relaxed' as const : 'workspace' as const,
    }
  }

  try {
    const raw = readCached(STORE_KEY)
    if (!raw) {
      return {
        allowedDirectories: [] as string[],
        blockedCommands: DEFAULT_BLOCKED_COMMANDS,
        requireConfirmation: true,
        sandboxMode: 'workspace' as const,
      }
    }
    const parsed = safeParse<{ state?: { toolSecurity?: Partial<ToolSecuritySettings> } }>(raw)
    const sec = parsed.state?.toolSecurity
    return {
      allowedDirectories: sec?.allowedDirectories || [],
      blockedCommands: sec?.blockedCommands || DEFAULT_BLOCKED_COMMANDS,
      requireConfirmation: sec?.requireConfirmation ?? true,
      sandboxMode: sec?.sandboxMode === 'relaxed' ? 'relaxed' as const : 'workspace' as const,
    }
  } catch {
    return {
      allowedDirectories: [] as string[],
      blockedCommands: DEFAULT_BLOCKED_COMMANDS,
      requireConfirmation: true,
      sandboxMode: 'workspace' as const,
    }
  }
}

function getPersistedMarketplaceSettings() {
  try {
    const raw = readCached(STORE_KEY)
    if (!raw) {
      return {
        source: 'official' as const,
        privateUrl: '',
      }
    }
    const parsed = safeParse<{ state?: { marketplace?: { source?: 'official' | 'private'; privateUrl?: string } } }>(raw)
    const market = parsed.state?.marketplace
    return {
      source: market?.source ?? 'official',
      privateUrl: market?.privateUrl ?? '',
    }
  } catch {
    return {
      source: 'official' as const,
      privateUrl: '',
    }
  }
}

function resolveMarketplaceUrl() {
  const market = getPersistedMarketplaceSettings()
  if (market.source === 'private' && market.privateUrl.trim()) {
    return market.privateUrl.trim()
  }
  return OFFICIAL_MARKETPLACE_URL
}

/**
 * Get the effective list of allowed directories.
 * When the user has not explicitly configured allowedDirectories,
 * default to the workspace path so that agent operations are scoped
 * to the user-configured workspace.
 */
function getEffectiveAllowedDirectories(): string[] {
  const sec = getPersistedSecuritySettings()
  if (sec.sandboxMode === 'relaxed') return []
  if (sec.allowedDirectories.length > 0) return sec.allowedDirectories
  // Fall back to workspace path as the default sandbox boundary
  const { workspacePath } = getPersistedStoreState()
  return workspacePath ? [workspacePath] : []
}

function ensureAllowedPath(targetPath: string): string | null {
  const allowedDirs = getEffectiveAllowedDirectories()
  if (!allowedDirs.length) return null

  const normalizedTarget = normalizePath(targetPath)
  const inWhitelist = allowedDirs.some((allowed) => {
    const normalizedAllowed = normalizePath(allowed)
    // Ensure exact directory match or child path (with separator) to prevent
    // prefix-overlap attacks like "/home/user/projects-secret" matching
    // allowedDir "/home/user/projects".
    return normalizedTarget === normalizedAllowed ||
           normalizedTarget.startsWith(normalizedAllowed + '/')
  })

  if (!inWhitelist) {
    return `Path blocked by sandbox policy: ${targetPath}`
  }
  return null
}

function escapeRegExp(input: string): string {
  return input.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
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

function ensureCommandAllowed(command: string): string | null {
  const sec = getPersistedSecuritySettings()
  const trimmed = command.trim()
  if (!trimmed) return 'Empty command'
  // Mirror strict-mode main-process metacharacter rejection for fast UX feedback.
  // Relaxed mode intentionally lets the platform shell parse full shell syntax.
  if (sec.sandboxMode !== 'relaxed' && /[|;&`$<>(){}\n\r\\]/.test(trimmed)) {
    return 'Shell metacharacters are not allowed (| ; & $ ` < > ( ) { } \\ newline)'
  }
  const blocked = findBlockedCommandPattern(trimmed, sec.blockedCommands)
  if (blocked) {
    return `Command blocked by sandbox policy: ${blocked}`
  }
  return null
}

let sessionToolConfirmationAllowed = false
let toolConfirmationBypassDepth = 0

export async function runWithToolConfirmationBypass<T>(operation: () => Promise<T>): Promise<T> {
  toolConfirmationBypassDepth += 1
  try {
    return await operation()
  } finally {
    toolConfirmationBypassDepth -= 1
  }
}

async function confirmIfNeeded(action: string): Promise<boolean> {
  if (toolConfirmationBypassDepth > 0 || sessionToolConfirmationAllowed) return true
  const sec = getPersistedSecuritySettings()
  if (!sec.requireConfirmation) return true
  const [title, ...rest] = action.split('\n')
  const choice = await confirmChoice({
    title: `Tool confirmation: ${title}`,
    body: rest.join('\n') || 'This tool call requires your approval before executing.',
    danger: true,
    cancelText: 'Deny',
    choices: [
      { value: 'allow_session', label: 'Allow this session', variant: 'secondary' },
      { value: 'allow_all', label: 'Allow all', variant: 'secondary' },
      { value: 'allow', label: 'Allow', variant: 'primary' },
    ],
  })
  if (choice === 'allow_session') {
    sessionToolConfirmationAllowed = true
    return true
  }
  if (choice === 'allow_all') {
    writeStoreState((state) => {
      const current = (state.toolSecurity ?? {}) as Partial<ToolSecuritySettings>
      state.toolSecurity = {
        allowedDirectories: current.allowedDirectories ?? [],
        blockedCommands: current.blockedCommands ?? DEFAULT_BLOCKED_COMMANDS,
        requireConfirmation: false,
        sandboxMode: current.sandboxMode === 'relaxed' ? 'relaxed' : 'workspace',
      }
    })
    return true
  }
  return choice === 'allow'
}

// ─── Platform detection ────────────────────────────────────────────

function detectPlatformShell(): string {
  // In Electron renderer, navigator.userAgent contains OS info
  const ua = typeof navigator !== 'undefined' ? navigator.userAgent || '' : ''
  if (ua.includes('Windows') || ua.includes('Win64') || ua.includes('Win32')) return 'Windows (PowerShell)'
  if (ua.includes('Mac')) return 'macOS (zsh/bash)'
  return 'Linux (bash)'
}

const PLATFORM_SHELL = detectPlatformShell()

// ─── Todo helpers ──────────────────────────────────────────────────

interface TodoItem {
  id: string
  title: string
  description: string
  status: 'pending' | 'in-progress' | 'done'
  priority: 'low' | 'medium' | 'high'
  createdAt: string
  updatedAt: string
  dueDate?: string
}

function resolveDocument(
  nodes: DocumentNode[],
  documentIdOrTitle: string,
): DocumentItem | null {
  const query = documentIdOrTitle.trim().toLowerCase()
  const docs = nodes.filter((node): node is DocumentItem => node.type === 'document')
  return docs.find((doc) => doc.id === documentIdOrTitle)
    ?? docs.find((doc) => doc.title.toLowerCase() === query)
    ?? docs.find((doc) => doc.title.toLowerCase().includes(query))
    ?? null
}

function resolveSkill(skills: Skill[], skillIdOrName: string): Skill | null {
  const query = skillIdOrName.trim().toLowerCase()
  return skills.find((skill) => skill.id === skillIdOrName)
    ?? skills.find((skill) => skill.name.toLowerCase() === query)
    ?? skills.find((skill) => skill.name.toLowerCase().includes(query))
    ?? null
}

function summarizeMarkdown(value: string, maxLength = 240): string {
  const compact = value.replace(/\s+/g, ' ').trim()
  return compact.length > maxLength ? `${compact.slice(0, maxLength)}...` : compact
}

function getSkillInstructionContent(skill: Skill): string {
  return skill.content ?? skill.prompt ?? ''
}

function getSkillSourceLabel(skill: Skill): string {
  return skill.source ?? skill.type ?? 'unknown'
}

function buildUpdatedSkillContent(
  skill: Skill,
  updates: {
    content: string
    name?: string
    description?: string
    whenToUse?: string
  },
): Skill {
  const nextName = updates.name ?? skill.name
  const nextDescription = updates.description ?? skill.description
  const frontmatter = skill.frontmatter ?? {
    name: nextName,
    description: nextDescription,
  }
  const metadataPatch = {
    ...(updates.name ? { name: updates.name } : {}),
    ...(updates.description !== undefined ? { description: updates.description } : {}),
    ...(updates.whenToUse !== undefined ? { whenToUse: updates.whenToUse } : {}),
  }
  const legacyPromptPatch = Object.prototype.hasOwnProperty.call(skill, 'prompt')
    ? { prompt: updates.content }
    : {}

  return {
    ...skill,
    ...metadataPatch,
    content: updates.content,
    ...legacyPromptPatch,
    frontmatter: {
      ...frontmatter,
      ...metadataPatch,
      name: updates.name ?? frontmatter.name ?? nextName,
      description: updates.description ?? frontmatter.description ?? nextDescription,
    },
  }
}

async function persistSkillFileIfPossible(skill: Skill): Promise<string> {
  if (!skill.filePath) return 'No SKILL.md file path is available; updated in app state only.'
  const blocked = ensureAllowedPath(skill.filePath)
  if (blocked) return `${blocked}; updated in app state only.`
  const result = await electronInvoke('fs:writeFile', skill.filePath, serializeSkillToMarkdown(skill))
  if (typeof result === 'object' && result && 'error' in result) {
    return `Failed to persist SKILL.md to disk: ${formatToolError((result as { error: unknown }).error)}`
  }
  return `Persisted SKILL.md to ${skill.filePath}.`
}

function getPersistedStoreState(): { workspacePath: string; activeSessionId: string } {
  try {
    const raw = readCached(STORE_KEY)
    if (!raw) return { workspacePath: '', activeSessionId: '' }
    const parsed = safeParse<{ state?: { workspacePath?: string; activeSessionId?: string } }>(raw)
    return {
      workspacePath: parsed.state?.workspacePath || '',
      activeSessionId: parsed.state?.activeSessionId || '',
    }
  } catch {
    return { workspacePath: '', activeSessionId: '' }
  }
}

function getSessionTodosKey(): { key: string; error?: string } {
  const { workspacePath, activeSessionId } = getPersistedStoreState()
  if (!workspacePath) return { key: '', error: 'Workspace path not set' }
  if (!activeSessionId) return { key: '', error: 'No active session — please open or create a chat session first' }
  return { key: `session-todos:${safePathSegment(activeSessionId, 'session')}` }
}

async function readTodos(key: string): Promise<TodoItem[]> {
  try {
    const result = await electronInvoke('db:loadPersistedStore', key) as { data?: unknown; error?: string }
    if (typeof result?.data === 'string' && result.data.trim()) {
      return safeParse<TodoItem[]>(result.data)
    }
    return []
  } catch {
    return []
  }
}

async function writeTodos(key: string, todos: TodoItem[]): Promise<void> {
  await electronInvoke('db:savePersistedStore', key, safeStringify(todos), 1)
}

// ─── AI SDK tool definitions ───────────────────────────────────────

export const builtinToolDefs: ToolSet = {
  list_dir: tool({
    description: 'List files and directories at the given path. Returns JSON array of entries with name, isDirectory, and path.',
    inputSchema: z.object({
      path: z.string().describe('Absolute path of the directory to list'),
    }),
    execute: async ({ path }) => {
      const blocked = ensureAllowedPath(path)
      if (blocked) return blocked
      if (!(await confirmIfNeeded(`list_dir\n${path}`))) return 'Cancelled by user confirmation policy.'
      const result = await electronInvoke('fs:listDir', path)
      return JSON.stringify(result)
    },
  }),

  read_file: tool({
    description: 'Read the text content of a file. Optionally specify a line range to read only a portion of the file.',
    inputSchema: z.object({
      path: z.string().describe('Absolute path of the file to read'),
      start_line: z.number().optional().describe('Starting line number (1-based). If omitted, reads from the beginning.'),
      end_line: z.number().optional().describe('Ending line number (inclusive). If omitted, reads to the end.'),
    }),
    execute: async ({ path, start_line, end_line }) => {
      const blocked = ensureAllowedPath(path)
      if (blocked) return blocked
      if (!(await confirmIfNeeded(`read_file\n${path}`))) return 'Cancelled by user confirmation policy.'
      if (start_line !== undefined || end_line !== undefined) {
        const result = await electronInvoke('fs:readFileRange', path, start_line, end_line)
        if (typeof result === 'object' && result && 'error' in result) {
          return `Error: ${(result as { error: string }).error}`
        }
        return String(result)
      }
      const result = await electronInvoke('fs:readFile', path)
      if (typeof result === 'object' && result && 'error' in result) {
        return `Error: ${(result as { error: string }).error}`
      }
      return String(result)
    },
  }),

  write_file: tool({
    description: 'Write text content to a file. Creates the file if it does not exist, overwrites if it does. Also creates missing parent directories.',
    inputSchema: z.object({
      path: z.string().describe('Absolute path of the file to write'),
      content: z.string().describe('Text content to write to the file'),
    }),
    execute: async ({ path, content }) => {
      const blocked = ensureAllowedPath(path)
      if (blocked) return blocked
      if (!(await confirmIfNeeded(`write_file\n${path}`))) return 'Cancelled by user confirmation policy.'
      const result = await electronInvoke('fs:writeFile', path, content)
      if (typeof result === 'object' && result && 'error' in result) {
        return `Error: ${(result as { error: string }).error}`
      }
      return `Successfully wrote ${content.length} characters to ${path}`
    },
  }),

  shell: tool({
    description: `Execute a shell command and return stdout/stderr. Current platform: ${PLATFORM_SHELL}. IMPORTANT: Always use commands appropriate for the current shell — on Windows use PowerShell cmdlets (Get-ChildItem, Get-Content, Select-String, Copy-Item, etc.) instead of Unix commands (ls, cat, grep, cp, etc.). On macOS/Linux use standard Unix commands.`,
    inputSchema: z.object({
      command: z.string().describe('The shell command to execute (must match the current OS shell syntax)'),
    }),
    execute: async ({ command }) => {
      const blocked = ensureCommandAllowed(command)
      if (blocked) return blocked
      if (!(await confirmIfNeeded(`shell\n${command}`))) return 'Cancelled by user confirmation policy.'
      const result = (await electronInvoke('shell:exec', command)) as {
        stdout?: string
        stderr?: string
        error?: string
      }
      if (result.error) {
        return `Error: ${result.error}\nStdout: ${result.stdout || ''}\nStderr: ${result.stderr || ''}`
      }
      return result.stdout || '(no output)'
    },
  }),

  web_search: tool({
    description: 'Search the web using DuckDuckGo. Returns an instant answer (if any) plus up to 8 search results with titles, URLs, and snippets. Use fetch_webpage to read the full content of a specific result.',
    inputSchema: z.object({
      query: z.string().describe('The search query'),
    }),
    execute: async ({ query }) => {
      const result = (await electronInvoke('web:search', query)) as {
        query: string
        instant_answer?: string
        instant_answer_type?: string
        instant_answer_source?: string
        instant_answer_url?: string
        results?: { title: string; url: string; snippet: string }[]
        error?: string
      }
      if (result.error) return `Search error: ${result.error}`

      const lines: string[] = []

      if (result.instant_answer) {
        const src = result.instant_answer_source ? ` (${result.instant_answer_source})` : ''
        const url = result.instant_answer_url ? `\nSource: ${result.instant_answer_url}` : ''
        lines.push(`[Instant Answer${src}]: ${result.instant_answer}${url}`)
      }

      const results = result.results ?? []
      if (results.length > 0) {
        lines.push(`\nSearch results for "${query}":`)
        results.forEach((r, i) => {
          lines.push(`\n${i + 1}. ${r.title}\n   URL: ${r.url}\n   ${r.snippet}`)
        })
      }

      if (lines.length === 0) {
        return `No results found for "${query}". Try rephrasing your query.`
      }

      return lines.join('\n')
    },
  }),

  fetch_webpage: tool({
    description: 'Fetch and read the text content of a webpage. Strips HTML tags and returns readable text (up to 8000 characters). Use this after web_search to read specific pages.',
    inputSchema: z.object({
      url: z.string().url().describe('The URL to fetch (must be http or https)'),
    }),
    execute: async ({ url }) => {
      if (!(await confirmIfNeeded(`fetch_webpage\n${url}`))) return 'Cancelled by user confirmation policy.'
      const result = (await electronInvoke('web:fetch', url)) as {
        content?: string
        url?: string
        truncated?: boolean
        error?: string
      }
      if (result.error) return `Fetch error: ${result.error}`
      const truncNote = result.truncated ? '\n\n[Content truncated at 8000 characters]' : ''
      return `${result.content ?? ''}${truncNote}`
    },
  }),

  get_current_time: tool({
    description: 'Get the current date, time, and timezone information.',
    inputSchema: z.object({}),
    execute: async () => {
      const now = new Date()
      return JSON.stringify({
        iso: now.toISOString(),
        local: now.toLocaleString(),
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        timestamp: now.getTime(),
      })
    },
  }),

  edit_file: tool({
    description: 'Edit a file by replacing a specific text snippet with new text. Use this for surgical edits instead of rewriting entire files.',
    inputSchema: z.object({
      path: z.string().describe('Absolute path of the file to edit'),
      old_text: z.string().describe('The exact text to find and replace (must match exactly)'),
      new_text: z.string().describe('The replacement text'),
    }),
    execute: async ({ path, old_text, new_text }) => {
      const blocked = ensureAllowedPath(path)
      if (blocked) return blocked
      if (!(await confirmIfNeeded(`edit_file\n${path}\nReplace: ${old_text.slice(0, 80)}…`))) return 'Cancelled by user confirmation policy.'
      const result = await electronInvoke('fs:editFile', path, old_text, new_text)
      if (typeof result === 'object' && result && 'error' in result) {
        return `Error: ${(result as { error: string }).error}`
      }
      return `Successfully edited ${path}`
    },
  }),

  search_files: tool({
    description: 'Search for a text pattern in files recursively under a directory. Supports plain text and regex. Returns matching file paths, line numbers, and content.',
    inputSchema: z.object({
      path: z.string().describe('Absolute path of the directory to search in'),
      pattern: z.string().describe('The text pattern to search for'),
      file_pattern: z.string().optional().describe('Optional filename filter (e.g. "*.ts", "*.py")'),
      regex: z.boolean().optional().describe('If true, treat the pattern as a regular expression (default: false)'),
      case_sensitive: z.boolean().optional().describe('If false, perform case-insensitive matching (default: true)'),
      context_lines: z.number().optional().describe('Number of context lines to show before and after each match (0-5, default: 0)'),
      exclude_pattern: z.string().optional().describe('Glob pattern for files/directories to exclude (e.g. "*.test.*", "build")'),
    }),
    execute: async ({ path, pattern, file_pattern, regex, case_sensitive, context_lines, exclude_pattern }) => {
      const blocked = ensureAllowedPath(path)
      if (blocked) return blocked
      const result = await electronInvoke('fs:searchFiles', path, pattern, {
        maxResults: 50,
        filePattern: file_pattern || '',
        regex: regex ?? false,
        caseSensitive: case_sensitive ?? true,
        contextLines: context_lines ?? 0,
        excludePattern: exclude_pattern || '',
      })
      if (typeof result === 'object' && result && 'error' in result) {
        return `Error: ${(result as { error: string }).error}`
      }
      const matches = result as { file: string; line: number; content: string; context?: string[] }[]
      if (!matches.length) return `No matches found for "${pattern}" in ${path}`
      return matches.map((m) => {
        if (m.context?.length) {
          return `${m.file}:${m.line}:\n${m.context.join('\n')}`
        }
        return `${m.file}:${m.line}: ${m.content}`
      }).join('\n')
    },
  }),

  glob_files: tool({
    description: 'Find files matching a glob pattern recursively. Returns file paths matching the pattern. Use this for file discovery by extension or naming convention. Examples: "**/*.ts", "src/**/*.test.*", "**/package.json".',
    inputSchema: z.object({
      pattern: z.string().describe('Glob pattern to match files (e.g. "**/*.ts", "src/**/*.json")'),
      path: z.string().describe('Base directory to search from (absolute path)'),
      exclude: z.string().optional().describe('Glob patterns to exclude, comma-separated (default: "node_modules,dist,.git")'),
    }),
    execute: async ({ pattern, path, exclude }) => {
      const blocked = ensureAllowedPath(path)
      if (blocked) return blocked
      const excludePattern = exclude || 'node_modules,dist,.git,build'
      const result = await electronInvoke('fs:glob', path, pattern, excludePattern)
      if (typeof result === 'object' && result && 'error' in result) {
        return `Error: ${(result as { error: string }).error}`
      }
      const files = result as string[]
      if (!files.length) return `No files matching "${pattern}" in ${path}`
      return `Found ${files.length} file(s):\n${files.join('\n')}`
    },
  }),

  open_url: tool({
    description: 'Open a URL in the user\'s default web browser. Only http and https URLs are allowed.',
    inputSchema: z.object({
      url: z.string().url().describe('The URL to open (must be http or https)'),
    }),
    execute: async ({ url }) => {
      if (!(await confirmIfNeeded(`open_url\n${url}`))) return 'Cancelled by user confirmation policy.'
      const result = await electronInvoke('shell:openUrl', url)
      if (typeof result === 'object' && result && 'error' in result) {
        return `Error: ${(result as { error: string }).error}`
      }
      return `Opened ${url} in browser`
    },
  }),

  // ─── Browser Automation Tools ────────────────────────────────────

  browser_navigate: tool({
    description: 'Navigate a headless browser to a URL and return the page title and text content. Use this for pages that require JavaScript rendering.',
    inputSchema: z.object({
      url: z.string().url().describe('The URL to navigate to (must be http or https)'),
    }),
    execute: async ({ url }) => {
      if (!(await confirmIfNeeded(`browser_navigate\n${url}`))) return 'Cancelled by user confirmation policy.'
      const result = (await electronInvoke('browser:navigate', url)) as {
        title?: string
        content?: string
        url?: string
        error?: string
      }
      if (result.error) return `Error: ${result.error}`
      return `Title: ${result.title}\n\n${result.content ?? ''}`
    },
  }),

  browser_screenshot: tool({
    description: 'Take a screenshot of a web page. Returns a base64-encoded PNG image. If no URL is provided, screenshots the currently loaded page.',
    inputSchema: z.object({
      url: z.string().url().optional().describe('URL to screenshot. If omitted, screenshots the current page.'),
    }),
    execute: async ({ url }) => {
      if (url && !(await confirmIfNeeded(`browser_screenshot\n${url}`))) return 'Cancelled by user confirmation policy.'
      const result = (await electronInvoke('browser:screenshot', url)) as {
        image?: string
        format?: string
        error?: string
      }
      if (result.error) return `Error: ${result.error}`
      return `Screenshot captured (base64 PNG, ${(result.image ?? '').length} chars)`
    },
  }),

  browser_evaluate: tool({
    description: 'Run a safe, predefined read-only browser evaluation on a web page and return the result. Use browser_extract_text or browser_extract_links for general page reading.',
    inputSchema: z.object({
      url: z.string().url().describe('The URL to navigate to before executing the script'),
      expression: z.enum(['title', 'location', 'text', 'links', 'headings']).describe('Safe read-only expression to evaluate'),
    }),
    execute: async ({ url, expression }) => {
      if (!(await confirmIfNeeded(`browser_evaluate\n${url}\n${expression}`))) return 'Cancelled by user confirmation policy.'
      const result = (await electronInvoke('browser:evaluate', url, expression)) as {
        result?: string
        error?: string
      }
      if (result.error) return `Error: ${result.error}`
      return result.result ?? ''
    },
  }),

  browser_extract_links: tool({
    description: 'Extract all links (anchor tags) from a web page. Returns an array of objects with text and href.',
    inputSchema: z.object({
      url: z.string().url().describe('The URL to extract links from'),
    }),
    execute: async ({ url }) => {
      if (!(await confirmIfNeeded(`browser_extract_links\n${url}`))) return 'Cancelled by user confirmation policy.'
      const result = (await electronInvoke('browser:extractLinks', url)) as {
        links?: { text: string; href: string }[]
        count?: number
        error?: string
      }
      if (result.error) return `Error: ${result.error}`
      if (!result.links?.length) return 'No links found on the page.'
      return JSON.stringify(result.links, null, 2)
    },
  }),

  browser_extract_text: tool({
    description: 'Extract all visible text content from a web page. Useful for pages that require JavaScript rendering.',
    inputSchema: z.object({
      url: z.string().url().describe('The URL to extract text from'),
    }),
    execute: async ({ url }) => {
      if (!(await confirmIfNeeded(`browser_extract_text\n${url}`))) return 'Cancelled by user confirmation policy.'
      const result = (await electronInvoke('browser:extractText', url)) as {
        text?: string
        truncated?: boolean
        error?: string
      }
      if (result.error) return `Error: ${result.error}`
      const truncNote = result.truncated ? '\n\n[Content truncated at 16000 characters]' : ''
      return `${result.text ?? ''}${truncNote}`
    },
  }),

  browser_fill_form: tool({
    description: 'Fill a form field on a web page by CSS selector. Navigates to the URL first, then sets the value.',
    inputSchema: z.object({
      url: z.string().url().describe('The URL containing the form'),
      selector: z.string().describe('CSS selector for the form field (e.g. "#username", "input[name=email]")'),
      value: z.string().describe('The value to fill into the form field'),
    }),
    execute: async ({ url, selector, value }) => {
      if (!(await confirmIfNeeded(`browser_fill_form\n${url}\n${selector} = ${value.slice(0, PREVIEW_LENGTH)}`))) return 'Cancelled by user confirmation policy.'
      const result = (await electronInvoke('browser:fillForm', url, selector, value)) as {
        success?: boolean
        tag?: string
        type?: string
        error?: string
      }
      if (result.error) return `Error: ${result.error}`
      return `Filled ${result.tag ?? 'element'}${result.type ? `[type=${result.type}]` : ''} with value`
    },
  }),

  browser_click: tool({
    description: 'Click an element on a web page by CSS selector. Navigates to the URL first, then clicks the element.',
    inputSchema: z.object({
      url: z.string().url().describe('The URL of the page'),
      selector: z.string().describe('CSS selector of the element to click (e.g. "#submit-btn", "button.primary")'),
    }),
    execute: async ({ url, selector }) => {
      if (!(await confirmIfNeeded(`browser_click\n${url}\n${selector}`))) return 'Cancelled by user confirmation policy.'
      const result = (await electronInvoke('browser:click', url, selector)) as {
        success?: boolean
        tag?: string
        text?: string
        error?: string
      }
      if (result.error) return `Error: ${result.error}`
      return `Clicked ${result.tag ?? 'element'}${result.text ? `: "${result.text}"` : ''}`
    },
  }),

  get_system_info: tool({
    description: 'Get system information including OS, CPU, memory, and runtime versions.',
    inputSchema: z.object({}),
    execute: async () => {
      const result = await electronInvoke('system:info')
      if (typeof result === 'object' && result && 'error' in result) {
        return `Error: ${(result as { error: string }).error}`
      }
      return JSON.stringify(result, null, 2)
    },
  }),

  // ─── Todo / Planning tools ─────────────────────────────────────────

  todo_list: tool({
    description: 'List todo items for the current chat session with optional status filter. Each session has its own todo list.',
    inputSchema: z.object({
      status: z.enum(['all', 'pending', 'in-progress', 'done']).default('all').describe('Filter by status'),
    }),
    execute: async ({ status }) => {
      const { key: todosKey, error } = getSessionTodosKey()
      if (error) return `Error: ${error}`
      const todos = await readTodos(todosKey)
      const filtered = status === 'all' ? todos : todos.filter((t) => t.status === status)
      if (filtered.length === 0) return status === 'all' ? 'No todos found in this session.' : `No todos with status "${status}" in this session.`
      return filtered.map((t) =>
        `[${t.status.toUpperCase()}] ${t.title} (id: ${t.id}, priority: ${t.priority}${t.dueDate ? ', due: ' + t.dueDate : ''})`
      ).join('\n')
    },
  }),

  todo_add: tool({
    description: 'Add a new todo item to the current chat session. Returns the created todo.',
    inputSchema: z.object({
      title: z.string().describe('Title of the todo item'),
      description: z.string().optional().default('').describe('Detailed description'),
      priority: z.enum(['low', 'medium', 'high']).optional().default('medium').describe('Priority level'),
      dueDate: z.string().optional().describe('Due date as ISO string'),
    }),
    execute: async ({ title, description, priority, dueDate }) => {
      const { key: todosKey, error } = getSessionTodosKey()
      if (error) return `Error: ${error}`
      const todos = await readTodos(todosKey)
      const now = new Date().toISOString()
      const item: TodoItem = {
        id: `todo-${crypto.randomUUID()}`,
        title,
        description,
        status: 'pending',
        priority,
        createdAt: now,
        updatedAt: now,
        ...(dueDate ? { dueDate } : {}),
      }
      todos.push(item)
      await writeTodos(todosKey, todos)
      return `Added todo: ${item.title} (id: ${item.id})`
    },
  }),

  todo_update: tool({
    description: 'Update an existing todo item by ID in the current chat session. Only provided fields are changed.',
    inputSchema: z.object({
      id: z.string().describe('ID of the todo to update'),
      title: z.string().optional().describe('New title'),
      description: z.string().optional().describe('New description'),
      status: z.enum(['pending', 'in-progress', 'done']).optional().describe('New status'),
      priority: z.enum(['low', 'medium', 'high']).optional().describe('New priority'),
    }),
    execute: async ({ id, title, description, status, priority }) => {
      const { key: todosKey, error } = getSessionTodosKey()
      if (error) return `Error: ${error}`
      const todos = await readTodos(todosKey)
      const idx = todos.findIndex((t) => t.id === id)
      if (idx === -1) return `Error: todo with id "${id}" not found in this session`
      const existing = todos[idx]
      todos[idx] = {
        ...existing,
        ...(title !== undefined ? { title } : {}),
        ...(description !== undefined ? { description } : {}),
        ...(status !== undefined ? { status } : {}),
        ...(priority !== undefined ? { priority } : {}),
        updatedAt: new Date().toISOString(),
      }
      await writeTodos(todosKey, todos)
      return `Updated todo: ${todos[idx].title} (id: ${id})`
    },
  }),

  todo_remove: tool({
    description: 'Remove a todo item by ID from the current chat session.',
    inputSchema: z.object({
      id: z.string().describe('ID of the todo to remove'),
    }),
    execute: async ({ id }) => {
      const { key: todosKey, error } = getSessionTodosKey()
      if (error) return `Error: ${error}`
      const todos = await readTodos(todosKey)
      const idx = todos.findIndex((t) => t.id === id)
      if (idx === -1) return `Error: todo with id "${id}" not found in this session`
      const removed = todos.splice(idx, 1)[0]
      await writeTodos(todosKey, todos)
      return `Removed todo: ${removed.title} (id: ${id})`
    },
  }),

  // ─── Timer / Scheduled task tools ────────────────────────────────────

  timer_list: tool({
    description: 'List all timers/scheduled tasks. Each timer has an id, name, type (once/interval/cron), schedule, action (notify/prompt/pipeline), enabled status, and next run time.',
    inputSchema: z.object({
      enabled_only: z.boolean().optional().default(false).describe('If true, only show enabled timers'),
    }),
    execute: async ({ enabled_only }) => {
      const result = (await electronInvoke('timer:list')) as { timers?: Array<{ id: string; name: string; type: string; schedule: string; action: string; prompt?: string; enabled: boolean; nextRun?: number; lastRun?: number }>; error?: string }
      if (result.error) return `Error: ${result.error}`
      const timers = result.timers ?? []
      const filtered = enabled_only ? timers.filter((t) => t.enabled) : timers
      if (filtered.length === 0) return enabled_only ? 'No enabled timers.' : 'No timers found.'
      return filtered.map((t) => {
        const next = t.nextRun ? new Date(t.nextRun).toLocaleString() : 'N/A'
        const last = t.lastRun ? new Date(t.lastRun).toLocaleString() : 'never'
        const pipeline = 'pipelineId' in t && typeof t.pipelineId === 'string' ? `, pipeline: ${t.pipelineId}` : ''
        return `[${t.enabled ? 'ON' : 'OFF'}] ${t.name} (id: ${t.id}, type: ${t.type}, schedule: ${t.schedule}, action: ${t.action}${pipeline}, next: ${next}, last: ${last})`
      }).join('\n')
    },
  }),

  timer_add: tool({
    description: 'Create a new timer/scheduled task. Use type "once" with an ISO date string for a one-time reminder. Use type "interval" with a number (minutes) for recurring tasks. Actions can notify, enqueue an agent prompt, or run a saved pipeline.',
    inputSchema: z.object({
      name: z.string().describe('Name/title of the timer'),
      type: z.enum(['once', 'interval']).describe('"once" for a one-time timer, "interval" for repeating'),
      schedule: z.string().describe('For "once": ISO date string (e.g. "2025-03-26T14:30:00"). For "interval": number of minutes between repeats (e.g. "30" for every 30 minutes).'),
      action: z.enum(['notify', 'prompt', 'pipeline']).optional().default('notify').describe('Action when timer fires: "notify" for desktop notification, "prompt" for agent prompt, "pipeline" to run a saved pipeline'),
      prompt: z.string().optional().describe('Notification body text or the prompt to send to the agent'),
      pipeline_id: z.string().optional().describe('Saved pipeline ID to run when action="pipeline"'),
    }),
    execute: async ({ name, type, schedule, action, prompt, pipeline_id }) => {
      const result = (await electronInvoke('timer:create', { name, type, schedule, action, prompt, pipelineId: pipeline_id, enabled: true })) as { timer?: { id: string; name: string; nextRun?: number }; error?: string }
      if (result.error) return `Error: ${result.error}`
      if (!result.timer) return 'Error: No timer returned'
      const t = result.timer
      const next = t.nextRun ? new Date(t.nextRun).toLocaleString() : 'N/A'
      return `Created timer: ${t.name} (id: ${t.id}, next fire: ${next})`
    },
  }),

  timer_update: tool({
    description: 'Update an existing timer by ID. Only provided fields are changed.',
    inputSchema: z.object({
      id: z.string().describe('ID of the timer to update'),
      name: z.string().optional().describe('New name'),
      type: z.enum(['once', 'interval']).optional().describe('New type'),
      schedule: z.string().optional().describe('New schedule value'),
      action: z.enum(['notify', 'prompt', 'pipeline']).optional().describe('New action'),
      prompt: z.string().optional().describe('New prompt/body text'),
      pipeline_id: z.string().optional().describe('Saved pipeline ID to run when action="pipeline"'),
      enabled: z.boolean().optional().describe('Enable or disable the timer'),
    }),
    execute: async ({ id, name, type, schedule, action, prompt, pipeline_id, enabled }) => {
      const updates: Record<string, unknown> = {}
      if (name !== undefined) updates.name = name
      if (type !== undefined) updates.type = type
      if (schedule !== undefined) updates.schedule = schedule
      if (action !== undefined) updates.action = action
      if (prompt !== undefined) updates.prompt = prompt
      if (pipeline_id !== undefined) updates.pipelineId = pipeline_id
      if (enabled !== undefined) updates.enabled = enabled

      const result = (await electronInvoke('timer:update', id, updates)) as { timer?: { id: string; name: string; enabled: boolean; nextRun?: number }; error?: string }
      if (result.error) return `Error: ${result.error}`
      if (!result.timer) return 'Error: No timer returned'
      const t = result.timer
      const next = t.nextRun ? new Date(t.nextRun).toLocaleString() : 'N/A'
      return `Updated timer: ${t.name} (id: ${t.id}, enabled: ${t.enabled}, next fire: ${next})`
    },
  }),

  timer_remove: tool({
    description: 'Delete a timer by ID.',
    inputSchema: z.object({
      id: z.string().describe('ID of the timer to remove'),
    }),
    execute: async ({ id }) => {
      const result = (await electronInvoke('timer:delete', id)) as { success?: boolean; error?: string }
      if (result.error) return `Error: ${result.error}`
      return `Removed timer: ${id}`
    },
  }),

  // ─── File management tools ──────────────────────────────────────────

  delete_file: tool({
    description: 'Delete a file at the given path. Succeeds silently if the file does not exist.',
    inputSchema: z.object({
      path: z.string().describe('Absolute path of the file to delete'),
    }),
    execute: async ({ path }) => {
      const blocked = ensureAllowedPath(path)
      if (blocked) return blocked
      if (!(await confirmIfNeeded(`delete_file\n${path}`))) return 'Cancelled by user confirmation policy.'
      const result = await electronInvoke('fs:deleteFile', path)
      if (typeof result === 'object' && result && 'error' in result) {
        return `Error: ${(result as { error: string }).error}`
      }
      return `Deleted ${path}`
    },
  }),

  create_directory: tool({
    description: 'Create a directory (including any missing parent directories).',
    inputSchema: z.object({
      path: z.string().describe('Absolute path of the directory to create'),
    }),
    execute: async ({ path }) => {
      const blocked = ensureAllowedPath(path)
      if (blocked) return blocked
      if (!(await confirmIfNeeded(`create_directory\n${path}`))) return 'Cancelled by user confirmation policy.'
      const result = await electronInvoke('system:ensureDirectory', path) as { success?: boolean; error?: string }
      if (result.error) return `Error: ${result.error}`
      return `Created directory ${path}`
    },
  }),

  move_file: tool({
    description: 'Move or rename a file or directory from one path to another.',
    inputSchema: z.object({
      source: z.string().describe('Absolute path of the source file or directory'),
      destination: z.string().describe('Absolute path of the destination'),
    }),
    execute: async ({ source, destination }) => {
      const blockedSrc = ensureAllowedPath(source)
      if (blockedSrc) return blockedSrc
      const blockedDest = ensureAllowedPath(destination)
      if (blockedDest) return blockedDest
      if (!(await confirmIfNeeded(`move_file\n${source} → ${destination}`))) return 'Cancelled by user confirmation policy.'
      const result = await electronInvoke('fs:moveFile', source, destination)
      if (typeof result === 'object' && result && 'error' in result) {
        return `Error: ${(result as { error: string }).error}`
      }
      return `Moved ${source} → ${destination}`
    },
  }),

  copy_file: tool({
    description: 'Copy a file from one path to another. Creates missing parent directories for the destination.',
    inputSchema: z.object({
      source: z.string().describe('Absolute path of the source file'),
      destination: z.string().describe('Absolute path of the destination file'),
    }),
    execute: async ({ source, destination }) => {
      const blockedSrc = ensureAllowedPath(source)
      if (blockedSrc) return blockedSrc
      const blockedDest = ensureAllowedPath(destination)
      if (blockedDest) return blockedDest
      if (!(await confirmIfNeeded(`copy_file\n${source} → ${destination}`))) return 'Cancelled by user confirmation policy.'
      const result = await electronInvoke('fs:copyFile', source, destination)
      if (typeof result === 'object' && result && 'error' in result) {
        return `Error: ${(result as { error: string }).error}`
      }
      return `Copied ${source} → ${destination}`
    },
  }),

  file_info: tool({
    description: 'Get metadata about a file or directory (size, type, timestamps, permissions).',
    inputSchema: z.object({
      path: z.string().describe('Absolute path of the file or directory'),
    }),
    execute: async ({ path }) => {
      const blocked = ensureAllowedPath(path)
      if (blocked) return blocked
      const result = await electronInvoke('fs:stat', path)
      if (typeof result === 'object' && result && 'error' in result) {
        return `Error: ${(result as { error: string }).error}`
      }
      return JSON.stringify(result, null, 2)
    },
  }),

  // ─── Clipboard tools ────────────────────────────────────────────────

  clipboard_read: tool({
    description: 'Read the current text content from the system clipboard.',
    inputSchema: z.object({}),
    execute: async () => {
      if (!(await confirmIfNeeded('clipboard_read'))) return 'Cancelled by user confirmation policy.'
      const result = await electronInvoke('clipboard:read') as { text?: string; error?: string }
      if (result.error) return `Error: ${result.error}`
      return result.text ?? ''
    },
  }),

  clipboard_write: tool({
    description: 'Write text content to the system clipboard.',
    inputSchema: z.object({
      text: z.string().describe('Text to copy to the clipboard'),
    }),
    execute: async ({ text }) => {
      if (!(await confirmIfNeeded(`clipboard_write\n${text.slice(0, PREVIEW_LENGTH)}...`))) return 'Cancelled by user confirmation policy.'
      const result = await electronInvoke('clipboard:write', text) as { success?: boolean; error?: string }
      if (result.error) return `Error: ${result.error}`
      return `Copied ${text.length} characters to clipboard`
    },
  }),

  // ─── System notification ────────────────────────────────────────────

  notify: tool({
    description: 'Send a system desktop notification to the user.',
    inputSchema: z.object({
      title: z.string().describe('Notification title'),
      body: z.string().optional().describe('Notification body text'),
    }),
    execute: async ({ title, body }) => {
      const result = await electronInvoke('system:notify', title, body ?? '') as { success?: boolean; error?: string }
      if (result.error) return `Error: ${result.error}`
      return `Notification sent: ${title}`
    },
  }),

  take_screenshot: tool({
    description: 'Take a screenshot of the desktop screen. Returns a base64-encoded PNG image.',
    inputSchema: z.object({}),
    execute: async () => {
      try {
        const result = await electronInvoke('system:screenshot') as { data?: string; mimeType?: string; error?: string }
        if (result.error) return `Error: ${result.error}`
        if (!result.data) return 'Error: No screenshot data returned'
        return `Screenshot captured (${Math.round(result.data.length * 0.75 / 1024)}KB PNG). Base64 data: ${result.data.slice(0, 100)}...`
      } catch (err) {
        return `Error taking screenshot: ${err instanceof Error ? err.message : String(err)}`
      }
    },
  }),

  // ─── Memory management tools ────────────────────────────────────────

  memory_store: tool({
    description: 'Store a fact, preference, or insight into memory for future reference. Use scope="global" for facts that apply across all sessions (e.g. user preferences, project knowledge). Use scope="session" for context specific to the current conversation.',
    inputSchema: z.object({
      content: z.string().describe('The fact or insight to remember'),
      type: z.enum(['insight', 'preference', 'correction', 'knowledge']).describe('Category of the memory'),
      scope: z.enum(['session', 'global']).default('session').describe('Memory scope: "session" for current conversation only, "global" for cross-session persistent memory'),
    }),
    execute: async ({ content, type, scope }) => {
      try {
        const state = readStoreState()
        if (!state) return 'Error: Store not available'
        const agentId = (state.selectedAgent as { id?: string } | undefined)?.id
        if (!agentId) return 'Error: No active agent \u2014 cannot store memory'

        const memory: PersistedMemoryEntry = {
          id: `memory-${crypto.randomUUID()}`,
          content,
          type,
          scope,
          createdAt: Date.now(),
          source: (state.activeSessionId as string) || 'unknown',
        }

        if (scope === 'global') {
          writeStoreState((s) => {
            if (!s.globalMemories) s.globalMemories = []
            ;(s.globalMemories as PersistedMemoryEntry[]).push(memory)
          })
        } else {
          writeStoreState((s) => {
            const agents = s.agents as PersistedAgentEntry[] | undefined
            const agent = agents?.find(a => a.id === agentId)
            if (agent) {
              if (!agent.memories) agent.memories = []
              agent.memories.push(memory)
            }
          })
        }
        // Update the vector index with the new memory
        addToIndex(getIndex(), { id: memory.id, content: memory.content })
        const preview = content.length > PREVIEW_LENGTH ? `${content.slice(0, PREVIEW_LENGTH)}...` : content
        return `Stored ${scope} ${type} memory: ${preview}`
      } catch (err) {
        return `Error storing memory: ${err instanceof Error ? err.message : String(err)}`
      }
    },
  }),

  memory_search: tool({
    description: 'Search memories for relevant information. Can search session-level, global-level, or both scopes. Supports semantic search via TF-IDF similarity.',
    inputSchema: z.object({
      query: z.string().describe('Search query to match against memory content'),
      type: z.enum(['insight', 'preference', 'correction', 'knowledge', 'all']).optional().describe('Filter by memory type (default: all)'),
      scope: z.enum(['session', 'global', 'all']).default('all').describe('Which memory scope to search: "session", "global", or "all"'),
      semantic: z.boolean().default(true).describe('Use semantic (TF-IDF) search when true, substring matching when false'),
    }),
    execute: async ({ query, type, scope, semantic }) => {
      try {
        const state = readStoreState()
        if (!state) return 'Error: Store not available'
        const agentId = (state.selectedAgent as { id?: string } | undefined)?.id
        if (!agentId) return 'Error: No active agent'

        let allMemories: PersistedMemoryEntry[] = []

        if (scope === 'session' || scope === 'all') {
          const agents = state.agents as PersistedAgentEntry[] | undefined
          const agent = agents?.find(a => a.id === agentId)
          if (agent?.memories?.length) {
            allMemories.push(...agent.memories.map(m => ({ ...m, scope: (m.scope || 'session') as 'session' | 'global' })))
          }
        }
        if (scope === 'global' || scope === 'all') {
          const globalMemories = state.globalMemories as PersistedMemoryEntry[] | undefined
          if (globalMemories?.length) {
            allMemories.push(...globalMemories.map(m => ({ ...m, scope: 'global' as const })))
          }
        }

        if (!allMemories.length) return 'No memories found.'

        if (type && type !== 'all') {
          allMemories = allMemories.filter(m => m.type === type)
        }

        if (semantic) {
          // Ensure the index is built
          let index = getIndex()
          if (index.size === 0) {
            index = rebuildIndexFromStore()
          }

          const results = searchSimilar(index, query, 20)
          const memoryIds = new Set(allMemories.map(m => m.id))
          // Filter results to only memories in scope, then take top matches
          const scoped = results.filter(r => memoryIds.has(r.id))
          if (!scoped.length) return `No memories semantically matching "${query}"`
          return scoped.map(r => {
            const mem = allMemories.find(m => m.id === r.id)
            const tag = mem ? `[${mem.scope}/${mem.type}]` : '[unknown]'
            return `${tag} (id: ${r.id}, score: ${r.score.toFixed(3)}) ${r.content}`
          }).join('\n')
        }

        // Fallback: substring matching
        const queryLower = query.toLowerCase()
        const matches = allMemories.filter(m => m.content.toLowerCase().includes(queryLower))

        if (!matches.length) return `No memories matching "${query}"`
        return matches.map(m =>
          `[${m.scope}/${m.type}] (id: ${m.id}) ${m.content}`
        ).join('\n')
      } catch (err) {
        return `Error searching memories: ${err instanceof Error ? err.message : String(err)}`
      }
    },
  }),

  memory_list: tool({
    description: 'List memories, optionally filtered by type and scope.',
    inputSchema: z.object({
      type: z.enum(['insight', 'preference', 'correction', 'knowledge', 'all']).optional().describe('Filter by memory type (default: all)'),
      scope: z.enum(['session', 'global', 'all']).default('all').describe('Which memory scope to list: "session", "global", or "all"'),
    }),
    execute: async ({ type, scope }) => {
      try {
        const state = readStoreState()
        if (!state) return 'Error: Store not available'
        const agentId = (state.selectedAgent as { id?: string } | undefined)?.id
        if (!agentId) return 'Error: No active agent'

        let allMemories: PersistedMemoryEntry[] = []

        if (scope === 'session' || scope === 'all') {
          const agents = state.agents as PersistedAgentEntry[] | undefined
          const agent = agents?.find(a => a.id === agentId)
          if (agent?.memories?.length) {
            allMemories.push(...agent.memories.map(m => ({ ...m, scope: (m.scope || 'session') as 'session' | 'global' })))
          }
        }
        if (scope === 'global' || scope === 'all') {
          const globalMemories = state.globalMemories as PersistedMemoryEntry[] | undefined
          if (globalMemories?.length) {
            allMemories.push(...globalMemories.map(m => ({ ...m, scope: 'global' as const })))
          }
        }

        if (!allMemories.length) return 'No memories found.'

        if (type && type !== 'all') {
          allMemories = allMemories.filter(m => m.type === type)
        }

        if (!allMemories.length) return type ? `No ${type} memories found.` : 'No memories found.'
        return allMemories.map(m =>
          `[${m.scope}/${m.type}] (id: ${m.id}, ${new Date(m.createdAt).toLocaleDateString()}) ${m.content}`
        ).join('\n')
      } catch (err) {
        return `Error listing memories: ${err instanceof Error ? err.message : String(err)}`
      }
    },
  }),

  memory_delete: tool({
    description: 'Delete a specific memory entry by its ID. Searches both session and global scopes.',
    inputSchema: z.object({
      id: z.string().describe('ID of the memory to delete'),
    }),
    execute: async ({ id }) => {
      try {
        const state = readStoreState()
        if (!state) return 'Error: Store not available'
        const agentId = (state.selectedAgent as { id?: string } | undefined)?.id
        if (!agentId) return 'Error: No active agent \u2014 cannot delete memory'

        let found = false

        // Try session memories
        writeStoreState((s) => {
          const agents = s.agents as PersistedAgentEntry[] | undefined
          const agent = agents?.find(a => a.id === agentId)
          if (agent?.memories) {
            const before = agent.memories.length
            agent.memories = agent.memories.filter(m => m.id !== id)
            if (agent.memories.length < before) found = true
          }

          // Try global memories
          if (!found) {
            const globalMemories = s.globalMemories as PersistedMemoryEntry[] | undefined
            if (globalMemories) {
              const before = globalMemories.length
              s.globalMemories = globalMemories.filter(m => m.id !== id)
              if ((s.globalMemories as PersistedMemoryEntry[]).length < before) found = true
            }
          }
        })

        if (found) {
          // Remove from vector index
          removeFromIndex(getIndex(), id)
          return `Deleted memory: ${id}`
        }
        return `Memory not found: ${id}`
      } catch (err) {
        return `Error deleting memory: ${err instanceof Error ? err.message : String(err)}`
      }
    },
  }),

  // ─── Agent Communication Tools ───────────────────────────────────

  agent_delegate: tool({
    description:
      'Delegate a task to another agent by name. The target agent will process the task using its own model, system prompt, and tools, then return the result. Use this when a task is better handled by a specialised agent.',
    inputSchema: z.object({
      agent_name: z.string().describe('Name (or partial name) of the target agent'),
      task: z.string().describe('The task description to delegate'),
      context: z.string().optional().describe('Optional additional context for the target agent'),
    }),
    execute: async ({ agent_name, task, context }) => {
      try {
        const raw = readCached(STORE_KEY)
        if (!raw) return 'Error: Store not available'
        const parsed = safeParse<PersistedStoreShape>(raw)
        const fromAgentId = parsed.state?.selectedAgent?.id ?? 'unknown'
        const agentList = parsed.state?.agents
        if (!agentList?.length) return 'Error: No agents available'

        // Fuzzy match by name (case-insensitive substring)
        const needle = agent_name.toLowerCase()
        const target = agentList.find(
          (a) => a.enabled && a.name?.toLowerCase() === needle,
        ) ?? agentList.find(
          (a) => a.enabled && a.name?.toLowerCase().includes(needle),
        )
        if (!target) return `Error: No enabled agent matching "${agent_name}" found. Use agent_list to see available agents.`
        if (target.id === fromAgentId) return 'Error: An agent cannot delegate to itself.'

        const result = await delegateToAgent(fromAgentId, target.id, task, context)
        return result || '(empty response from delegated agent)'
      } catch (err) {
        return `Error delegating task: ${err instanceof Error ? err.message : String(err)}`
      }
    },
  }),

  agent_list: tool({
    description: 'List all available agents with their names, skills, model, and status. Shows which agent is currently selected. Use this to discover agents available for delegation.',
    inputSchema: z.object({
      enabled_only: z.boolean().optional().default(false).describe('If true, only show enabled agents'),
    }),
    execute: async ({ enabled_only }) => {
      try {
        const state = readStoreState()
        if (!state) return 'Error: Store not available'
        const agents = (state.agents || []) as Array<{ id: string; name: string; enabled: boolean; systemPrompt?: string; skills?: string[]; modelId?: string }>
        if (agents.length === 0) return 'No agents configured.'
        const selectedId = (state.selectedAgent as { id: string } | undefined)?.id
        const filtered = enabled_only ? agents.filter((a) => a.enabled) : agents
        if (filtered.length === 0) return enabled_only ? 'No enabled agents.' : 'No agents configured.'

        return filtered.map((a) => {
          const prompt = a.systemPrompt ?? ''
          const excerpt = prompt.length > 100 ? prompt.slice(0, 100) + '...' : prompt
          const marker = a.id === selectedId ? '> ' : '  '
          return `${marker}[${a.enabled ? 'ON' : 'OFF'}] ${a.name} (id: ${a.id})\n  Skills: ${a.skills?.join(', ') || 'none'}\n  Model: ${a.modelId || '(global default)'}\n  Description: ${excerpt}`
        }).join('\n\n')
      } catch (err) {
        return `Error listing agents: ${err instanceof Error ? err.message : String(err)}`
      }
    },
  }),

  agent_notify: tool({
    description: 'Send a notification message to another agent by storing a knowledge memory entry in its memory. The receiving agent will see this note in its memory context on subsequent interactions.',
    inputSchema: z.object({
      agent_name: z.string().describe('Name (or partial name) of the target agent'),
      message: z.string().describe('Notification message to send'),
    }),
    execute: async ({ agent_name, message }) => {
      try {
        const raw = readCached(STORE_KEY)
        if (!raw) return 'Error: Store not available'
        const parsed = safeParse<PersistedStoreShape>(raw)
        if (!parsed.state?.agents?.length) return 'Error: No agents available'

        const needle = agent_name.toLowerCase()
        const target = parsed.state.agents.find(
          (a) => a.name?.toLowerCase() === needle,
        ) ?? parsed.state.agents.find(
          (a) => a.name?.toLowerCase().includes(needle),
        )
        if (!target) return `Error: No agent matching "${agent_name}" found.`

        const memory: PersistedMemoryEntry = {
          id: `memory-${crypto.randomUUID()}`,
          content: `[Notification from agent] ${message}`,
          type: 'knowledge',
          scope: 'global',
          createdAt: Date.now(),
          source: parsed.state.activeSessionId || 'agent-comm',
        }

        if (!target.memories) target.memories = []
        target.memories.push(memory)
        writeCached(STORE_KEY, safeStringify(parsed))

        const preview = message.length > PREVIEW_LENGTH ? `${message.slice(0, PREVIEW_LENGTH)}...` : message
        return `Notification sent to "${target.name ?? agent_name}": ${preview}`
      } catch (err) {
        return `Error sending notification: ${err instanceof Error ? err.message : String(err)}`
      }
    },
  }),

  // ─── Event Automation tools ──────────────────────────────────────

  event_list_triggers: tool({
    description: 'List all event automation triggers configured in the system.',
    inputSchema: z.object({}),
    execute: async () => {
      try {
        const raw = readCached(EVENTS_STORAGE_KEY)
        if (!raw) return 'No event triggers configured.'
        const triggers = safeParse<Array<{ id: string; name: string; type: string; enabled: boolean; agentId: string; pattern?: string }>>(raw)
        if (triggers.length === 0) return 'No event triggers configured.'
        return triggers.map((t) =>
          `- ${t.name} (${t.type}, ${t.enabled ? 'enabled' : 'disabled'}) → agent: ${t.agentId}${t.pattern ? `, pattern: ${t.pattern}` : ''}`
        ).join('\n')
      } catch (err) {
        return `Error listing triggers: ${err instanceof Error ? err.message : String(err)}`
      }
    },
  }),

  event_create_trigger: tool({
    description: 'Create a new event automation trigger. Types: file_change, clipboard_change, schedule, app_start.',
    inputSchema: z.object({
      name: z.string().describe('Trigger name'),
      type: z.enum(['file_change', 'clipboard_change', 'schedule', 'app_start']).describe('Event type'),
      pattern: z.string().optional().describe('Pattern (glob for file_change, cron for schedule)'),
      agent_id: z.string().describe('Agent ID to handle the event'),
      prompt_template: z.string().describe('Prompt template with {{file}}, {{content}} placeholders'),
    }),
    execute: async ({ name, type, pattern, agent_id, prompt_template }) => {
      try {
        const raw = readCached(EVENTS_STORAGE_KEY)
        const triggers = raw ? safeParse<Array<Record<string, unknown>>>(raw) : []
        const trigger = {
          id: `evt-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
          name,
          type,
          pattern,
          agentId: agent_id,
          promptTemplate: prompt_template,
          enabled: true,
          createdAt: Date.now(),
        }
        triggers.push(trigger)
        writeCached(EVENTS_STORAGE_KEY, safeStringify(triggers))
        return `Created event trigger: "${name}" (${type})`
      } catch (err) {
        return `Error creating trigger: ${err instanceof Error ? err.message : String(err)}`
      }
    },
  }),

  event_delete_trigger: tool({
    description: 'Delete an event automation trigger by ID.',
    inputSchema: z.object({
      id: z.string().describe('Trigger ID to delete'),
    }),
    execute: async ({ id }) => {
      try {
        const raw = readCached(EVENTS_STORAGE_KEY)
        if (!raw) return `Trigger not found: ${id}`
        const triggers = safeParse<Array<{ id: string }>>(raw)
        const filtered = triggers.filter((t) => t.id !== id)
        if (filtered.length === triggers.length) return `Trigger not found: ${id}`
        writeCached(EVENTS_STORAGE_KEY, safeStringify(filtered))
        return `Deleted trigger: ${id}`
      } catch (err) {
        return `Error deleting trigger: ${err instanceof Error ? err.message : String(err)}`
      }
    },
  }),

  // ─── Agent Self-Evolution tools ──────────────────────────────────

  skill_create: tool({
    description: 'Create a new custom skill with tools and/or custom code. Enables the agent to evolve by creating new capabilities.',
    inputSchema: z.object({
      name: z.string().describe('Skill name'),
      description: z.string().describe('Skill description'),
      custom_code: z.string().optional().describe('TypeScript custom tool code using defineCustomTool()'),
      prompt: z.string().optional().describe('Instructions for how the skill should be used'),
      reason: z.string().describe('Why this skill is being created'),
    }),
    execute: async ({ name, description, custom_code, prompt, reason }) => {
      try {
        const raw = readCached(STORE_KEY)
        if (!raw) return 'Error: Store not available'
        const parsed = safeParse<{ state?: { skills?: Array<Record<string, unknown>> } }>(raw)
        if (!parsed.state) return 'Error: Store state not available'

        // Check for duplicate name
        if (parsed.state.skills?.some((s) => (s.name as string)?.toLowerCase() === name.toLowerCase())) {
          return `Error: A skill with name "${name}" already exists`
        }

        const skillId = `evolved-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
        const newSkill = {
          id: skillId,
          name,
          description,
          type: 'custom',
          enabled: true,
          config: {},
          tools: [],
          customCode: custom_code || '',
          prompt: prompt || '',
          icon: 'lucide:sparkles#A855F7',
          author: 'self-evolved',
          version: '1.0.0',
        }

        if (!parsed.state.skills) parsed.state.skills = []
        parsed.state.skills.push(newSkill)
        writeCached(STORE_KEY, safeStringify(parsed))

        return `Created new skill "${name}" (${skillId}). Reason: ${reason}`
      } catch (err) {
        return `Error creating skill: ${err instanceof Error ? err.message : String(err)}`
      }
    },
  }),

  skill_improve: tool({
    description: 'Improve an existing skill by updating its code, prompt, or description.',
    inputSchema: z.object({
      skill_id: z.string().describe('ID of the skill to improve'),
      updates: z.string().describe('JSON object with fields to update (description, customCode, prompt)'),
      reason: z.string().describe('Why this improvement is being made'),
    }),
    execute: async ({ skill_id, updates, reason }) => {
      try {
        const raw = readCached(STORE_KEY)
        if (!raw) return 'Error: Store not available'
        const parsed = safeParse<{ state?: { skills?: Array<Record<string, unknown>> } }>(raw)
        if (!parsed.state?.skills) return 'Error: No skills found'

        const idx = parsed.state.skills.findIndex((s) => s.id === skill_id)
        if (idx === -1) return `Skill not found: ${skill_id}`

        // Don't allow modifying built-in skills
        if (parsed.state.skills[idx].type === 'builtin') {
          return 'Error: Cannot modify built-in skills'
        }

        let updateObj: Record<string, unknown>
        try {
          updateObj = safeParse(updates)
        } catch {
          return 'Error: Invalid JSON in updates'
        }

        // Only allow safe fields
        const allowed = ['description', 'customCode', 'prompt', 'name']
        for (const key of Object.keys(updateObj)) {
          if (allowed.includes(key)) {
            parsed.state.skills[idx][key] = updateObj[key]
          }
        }

        writeCached(STORE_KEY, safeStringify(parsed))
        return `Improved skill "${parsed.state.skills[idx].name}". Reason: ${reason}`
      } catch (err) {
        return `Error improving skill: ${err instanceof Error ? err.message : String(err)}`
      }
    },
  }),

  skill_suggest_improvements: tool({
    description: 'Get improvement suggestions for an existing skill.',
    inputSchema: z.object({
      skill_id: z.string().describe('Skill ID to analyze'),
    }),
    execute: async ({ skill_id }) => {
      try {
        const raw = readCached(STORE_KEY)
        if (!raw) return 'Error: Store not available'
        const parsed = safeParse<{ state?: { skills?: Array<{ id: string; name: string; description?: string; prompt?: string; customCode?: string; tools?: Array<unknown> }> } }>(raw)
        if (!parsed.state?.skills) return 'Error: No skills found'

        const skill = parsed.state.skills.find((s) => s.id === skill_id)
        if (!skill) return `Skill not found: ${skill_id}`

        const suggestions: string[] = []
        if (!skill.description || skill.description.length < 20) {
          suggestions.push('Add a more detailed description')
        }
        if (!skill.prompt) {
          suggestions.push('Add usage instructions/prompt')
        }
        if (!skill.customCode && (!skill.tools || skill.tools.length === 0)) {
          suggestions.push('Add custom code or tool definitions')
        }
        if (skill.tools && skill.tools.length > 10) {
          suggestions.push('Consider splitting into smaller skills')
        }

        if (suggestions.length === 0) return `Skill "${skill.name}" looks good! No improvements needed.`
        return `Suggestions for "${skill.name}":\n${suggestions.map((s) => `- ${s}`).join('\n')}`
      } catch (err) {
        return `Error analyzing skill: ${err instanceof Error ? err.message : String(err)}`
      }
    },
  }),

  // ─── File Attachment tool ─────────────────────────────────────────

  read_attachment: tool({
    description: 'Read a file and return its content as base64, suitable for attaching to messages or processing.',
    inputSchema: z.object({
      path: z.string().describe('File path to read'),
    }),
    execute: async ({ path }) => {
      const blocked = ensureAllowedPath(path)
      if (blocked) return blocked
      try {
        const content = await electronInvoke('fs:readFile', path) as string | { error: string }
        if (typeof content !== 'string') return `Error: ${(content as { error: string }).error}`
        // For text files, return content directly
        if (content.length < 100000) return content
        return `File content (${content.length} chars, truncated): ${content.slice(0, 5000)}...`
      } catch (err) {
        return `Error reading file: ${err instanceof Error ? err.message : String(err)}`
      }
    },
  }),

  // ─── Enhanced User Interaction Tools ───────────────────────────────

  ask_user_question: tool({
    description: 'Ask the user a question and wait for their response. Use this when you need clarification, confirmation, or additional input from the user.',
    inputSchema: z.object({
      question: z.string().describe('The question to ask the user'),
      context: z.string().optional().describe('Optional context to help the user understand the question'),
    }),
    execute: async ({ question, context }) => {
      const prompt = context ? `${context}\n\n${question}` : question
      return `[USER INPUT REQUIRED] ${prompt}\n\nNote: This tool requires user interaction. In a real implementation, this would pause execution and prompt the user for input.`
    },
  }),

  // ─── Loop Control Tools ────────────────────────────────────────────

  loop_execute: tool({
    description: 'Execute a sequence of actions multiple times with iteration control. Useful for batch processing or repetitive tasks.',
    inputSchema: z.object({
      iterations: z.number().describe('Number of times to iterate (1-100)'),
      action_description: z.string().describe('Description of what action to perform in each iteration'),
      variables: z.string().optional().describe('Optional JSON object of variables that change per iteration'),
    }),
    execute: async ({ iterations, action_description, variables }) => {
      if (iterations < 1 || iterations > 100) {
        return 'Error: Iterations must be between 1 and 100.'
      }
      const vars = variables ? safeParse(variables) : {}
      return `Loop configured: ${iterations} iterations of "${action_description}"\nVariables: ${safeStringify(vars)}\n\nNote: In practice, you should break down the loop into individual tool calls for better control and error handling.`
    },
  }),

  // ─── Git Operations Tools ───────────────────────────────────────────

  git_status: tool({
    description: 'Get the current Git status of a repository, showing modified, staged, and untracked files.',
    inputSchema: z.object({
      repo_path: z.string().describe('Path to the Git repository'),
    }),
    execute: async ({ repo_path }) => {
      const blocked = ensureAllowedPath(repo_path)
      if (blocked) return blocked
      const result = await electronInvoke('git:status', repo_path) as { stdout?: string; stderr?: string; error?: string }
      if (result.error) return `Error: ${result.error}`
      return result.stdout || 'No changes detected'
    },
  }),

  git_diff: tool({
    description: 'Show the diff of changes in a Git repository.',
    inputSchema: z.object({
      repo_path: z.string().describe('Path to the Git repository'),
      file_path: z.string().optional().describe('Optional specific file to diff'),
    }),
    execute: async ({ repo_path, file_path }) => {
      const blocked = ensureAllowedPath(repo_path)
      if (blocked) return blocked
      const result = await electronInvoke('git:diff', repo_path, file_path) as { stdout?: string; stderr?: string; error?: string }
      if (result.error) return `Error: ${result.error}`
      return result.stdout || 'No differences found'
    },
  }),

  git_log: tool({
    description: 'Show the commit history of a Git repository.',
    inputSchema: z.object({
      repo_path: z.string().describe('Path to the Git repository'),
      max_count: z.number().optional().describe('Maximum number of commits to show (default: 10)'),
    }),
    execute: async ({ repo_path, max_count = 10 }) => {
      const blocked = ensureAllowedPath(repo_path)
      if (blocked) return blocked
      const result = await electronInvoke('git:log', repo_path, max_count) as { stdout?: string; stderr?: string; error?: string }
      if (result.error) return `Error: ${result.error}`
      return result.stdout || 'No commits found'
    },
  }),

  git_commit: tool({
    description: 'Create a Git commit with a message. Files must be staged first using git_add.',
    inputSchema: z.object({
      repo_path: z.string().describe('Path to the Git repository'),
      message: z.string().describe('Commit message'),
    }),
    execute: async ({ repo_path, message }) => {
      const blocked = ensureAllowedPath(repo_path)
      if (blocked) return blocked
      if (!(await confirmIfNeeded(`git_commit\n${repo_path}\nMessage: ${message}`))) return 'Cancelled by user confirmation policy.'
      const result = await electronInvoke('git:commit', repo_path, message) as { stdout?: string; stderr?: string; error?: string }
      if (result.error) return `Error: ${result.error}`
      return result.stdout || 'Commit created successfully'
    },
  }),

  git_add: tool({
    description: 'Stage files for commit in a Git repository.',
    inputSchema: z.object({
      repo_path: z.string().describe('Path to the Git repository'),
      file_pattern: z.string().describe('File pattern to add (e.g., "." for all, "*.ts" for TypeScript files)'),
    }),
    execute: async ({ repo_path, file_pattern }) => {
      const blocked = ensureAllowedPath(repo_path)
      if (blocked) return blocked
      const pathspecs = splitGitPathspecInput(file_pattern)
      const result = await electronInvoke('git:add', repo_path, pathspecs.length > 0 ? pathspecs : ['.']) as {
        stdout?: string
        stderr?: string
        error?: string
      }
      if (result.error) return `Error: ${result.error}`
      return `Files staged: ${file_pattern}`
    },
  }),

  // ─── Code Analysis Tools ────────────────────────────────────────────

  analyze_code_structure: tool({
    description: 'Analyze the structure of a code file or directory, showing functions, classes, imports, and overall organization.',
    inputSchema: z.object({
      path: z.string().describe('Path to file or directory to analyze'),
      language: z.string().optional().describe('Programming language hint (js, ts, py, etc.)'),
    }),
    execute: async ({ path, language }) => {
      const blocked = ensureAllowedPath(path)
      if (blocked) return blocked
      try {
        const content = await electronInvoke('fs:readFile', path) as string | { error: string }
        if (typeof content !== 'string') return `Error: ${(content as { error: string }).error}`

        // Basic analysis
        const lines = content.split('\n')
        const imports = lines.filter(l => l.match(/^import\s|^from\s|^#include|^require\(/))
        const functions = lines.filter(l => l.match(/function\s+\w+|def\s+\w+|fn\s+\w+|func\s+\w+/))
        const classes = lines.filter(l => l.match(/class\s+\w+|interface\s+\w+|struct\s+\w+/))

        return `Code Structure Analysis:\n` +
          `- Total lines: ${lines.length}\n` +
          `- Imports/includes: ${imports.length}\n` +
          `- Functions: ${functions.length}\n` +
          `- Classes/interfaces: ${classes.length}\n` +
          `- Language: ${language || 'auto-detected'}\n\n` +
          `Imports:\n${imports.slice(0, 10).join('\n')}\n\n` +
          `Functions:\n${functions.slice(0, 10).join('\n')}`
      } catch (err) {
        return `Error analyzing code: ${err instanceof Error ? err.message : String(err)}`
      }
    },
  }),

  find_code_patterns: tool({
    description: 'Search for specific code patterns like TODO comments, FIXME notes, console.log statements, or custom patterns.',
    inputSchema: z.object({
      path: z.string().describe('Directory path to search'),
      pattern_type: z.string().describe('Pattern type: "todo", "fixme", "console", "debugger", or "custom"'),
      custom_pattern: z.string().optional().describe('Custom regex pattern if pattern_type is "custom"'),
    }),
    execute: async ({ path, pattern_type, custom_pattern }) => {
      const blocked = ensureAllowedPath(path)
      if (blocked) return blocked

      const patterns: Record<string, string> = {
        todo: 'TODO|FIXME|XXX|HACK',
        fixme: 'FIXME|BUG',
        console: 'console\\.log|console\\.debug|console\\.error',
        debugger: 'debugger;',
        custom: custom_pattern || '',
      }

      const pattern = patterns[pattern_type] || patterns.todo
      const result = await electronInvoke('fs:searchFiles', path, pattern, {
        maxResults: 50,
        filePattern: '',
        regex: true,
        caseSensitive: false,
        contextLines: 1,
        excludePattern: 'node_modules,dist,build,.git',
      })

      if (typeof result === 'object' && result && 'error' in result) {
        return `Error: ${(result as { error: string }).error}`
      }

      const matches = result as { file: string; line: number; content: string }[]
      if (!matches.length) return `No ${pattern_type} patterns found in ${path}`

      return `Found ${matches.length} ${pattern_type} patterns:\n` +
        matches.map(m => `${m.file}:${m.line}: ${m.content}`).join('\n')
    },
  }),

  // ─── Channel Integration Tools ──────────────────────────────────────

  channel_start_server: tool({
    description: 'Start the channel webhook server to receive messages from WeChat, Feishu, and DingTalk.',
    inputSchema: z.object({}),
    execute: async () => {
      try {
        const result = await electronInvoke('channel:start') as { success?: boolean; message?: string; error?: string }
        if (result.error) return `Error: ${result.error}`
        return result.message || 'Channel server started successfully'
      } catch (err) {
        return `Error: ${err instanceof Error ? err.message : String(err)}`
      }
    },
  }),

  channel_stop_server: tool({
    description: 'Stop the channel webhook server.',
    inputSchema: z.object({}),
    execute: async () => {
      try {
        const result = await electronInvoke('channel:stop') as { success?: boolean; error?: string }
        if (result.error) return `Error: ${result.error}`
        return 'Channel server stopped successfully'
      } catch (err) {
        return `Error: ${err instanceof Error ? err.message : String(err)}`
      }
    },
  }),

  channel_server_status: tool({
    description: 'Check if the channel webhook server is running.',
    inputSchema: z.object({}),
    execute: async () => {
      try {
        const result = await electronInvoke('channel:status') as { running: boolean }
        return result.running ? 'Channel server is running' : 'Channel server is stopped'
      } catch (err) {
        return `Error: ${err instanceof Error ? err.message : String(err)}`
      }
    },
  }),

  channel_send_message: tool({
    description: 'Send a message through a configured channel (WeChat, Feishu, or DingTalk).',
    inputSchema: z.object({
      channel_id: z.string().describe('Channel ID to send through'),
      chat_id: z.string().describe('Chat/conversation ID to send to'),
      content: z.string().describe('Message content to send'),
    }),
    execute: async ({ channel_id, chat_id, content }) => {
      try {
        const result = await electronInvoke('channel:sendMessage', channel_id, chat_id, content) as { success?: boolean; message?: string; error?: string }
        if (result.error) return `Error: ${result.error}`
        return result.message || 'Message sent successfully'
      } catch (err) {
        return `Error: ${err instanceof Error ? err.message : String(err)}`
      }
    },
  }),

  // ─── Email Tool ────────────────────────────────────────────────────

  send_email: tool({
    description: 'Send an email using the configured SMTP settings. The email config must be set up in Settings > Email first.',
    inputSchema: z.object({
      to: z.string().describe('Recipient email address(es), comma-separated for multiple'),
      subject: z.string().describe('Email subject line'),
      body: z.string().describe('Email body content'),
      cc: z.string().optional().describe('CC recipients, comma-separated'),
      bcc: z.string().optional().describe('BCC recipients, comma-separated'),
      isHtml: z.boolean().optional().describe('Whether the body is HTML (default: false, plain text)'),
    }),
    execute: async ({ to, subject, body, cc, bcc, isHtml }) => {
      const EMAIL_TIMEOUT = 30_000 // 30s total timeout for the entire operation
      try {
        const state = readStoreState()
        const cfg = (state?.emailConfig || {}) as { smtpHost?: string; smtpPort?: number; secure?: boolean; username?: string; password?: string; fromName?: string; fromAddress?: string; enabled?: boolean }

        logger.info('[send_email] Starting email send', {
          to, subject: subject.slice(0, 100), cc, bcc, isHtml: isHtml || false,
          config: cfg.smtpHost ? {
            host: cfg.smtpHost,
            port: cfg.smtpPort || 587,
            secure: cfg.secure || false,
            from: cfg.fromAddress,
            hasUsername: !!cfg.username,
            hasPassword: !!cfg.password,
            enabled: cfg.enabled,
          } : 'NOT CONFIGURED',
        })

        if (!cfg.enabled || !cfg.smtpHost || !cfg.fromAddress) {
          const reason = !cfg.enabled ? 'email is disabled' : !cfg.smtpHost ? 'SMTP host is empty' : 'from address is empty'
          logger.warn(`[send_email] Email not configured: ${reason}`)
          return `Error: Email not configured (${reason}). Please set up SMTP in Settings > Email.`
        }

        // Validate port/secure combination
        const port = cfg.smtpPort || 587
        if (port === 465 && !cfg.secure) {
          logger.warn('[send_email] Port 465 typically requires secure=true (SSL/TLS). Current config has secure=false.')
        }
        if (port === 587 && cfg.secure) {
          logger.warn('[send_email] Port 587 typically uses STARTTLS (secure=false). Current config has secure=true.')
        }

        const sendPromise = electronInvoke('email:send', {
          smtpHost: cfg.smtpHost,
          smtpPort: port,
          secure: cfg.secure || false,
          username: cfg.username || '',
          password: cfg.password || '',
          fromName: cfg.fromName || '',
          fromAddress: cfg.fromAddress,
        }, { to, subject, body, cc, bcc, isHtml: isHtml || false })

        // Race against a timeout so the tool never hangs forever
        let timeoutHandle: ReturnType<typeof setTimeout> | null = null
        const timeoutPromise = new Promise<never>((_, reject) => {
          timeoutHandle = setTimeout(() => reject(new Error(
            `Email send timed out after ${EMAIL_TIMEOUT / 1000}s. ` +
            `Check SMTP config: host=${cfg.smtpHost}, port=${port}, secure=${cfg.secure || false}. ` +
            `Common causes: wrong port, firewall blocking, or incorrect secure/TLS setting.`
          )), EMAIL_TIMEOUT)
        })

        if (timeoutHandle) {
          const handle = timeoutHandle
          sendPromise.finally(() => clearTimeout(handle))
        }
        const result = await Promise.race([sendPromise, timeoutPromise]) as { success: boolean; messageId?: string; error?: string }

        if (!result.success) {
          logger.error('[send_email] Server returned failure', { error: result.error, to })
          return `Error sending email: ${result.error}`
        }

        logger.info('[send_email] Email sent successfully', { messageId: result.messageId, to })
        return `Email sent successfully to ${to}. Message ID: ${result.messageId || 'N/A'}`
      } catch (err) {
        const errMsg = err instanceof Error ? err.message : String(err)
        logger.error('[send_email] Exception during email send', { error: errMsg, to, stack: err instanceof Error ? err.stack : undefined })
        return `Error: ${errMsg}`
      }
    },
  }),

  // ─── System Management Tools ───────────────────────────────────────

  switch_model: tool({
    description: 'Switch the currently selected AI model. Use list_models first to see available models.',
    inputSchema: z.object({
      model_id: z.string().describe('The model ID to switch to (e.g., "anthropic:claude-3-opus")'),
    }),
    execute: async ({ model_id }) => {
      try {
        const state = readStoreState()
        if (!state) return 'Error: Store not available'
        const models = (state.models || []) as Array<{ id: string; name: string; enabled: boolean }>
        const target = models.find((m) => m.id === model_id || m.name.toLowerCase().includes(model_id.toLowerCase()))
        if (!target) return `Model "${model_id}" not found. Available: ${models.map((m) => m.id).join(', ')}`
        if (!target.enabled) return `Model "${target.name}" is disabled. Enable it first.`
        writeStoreState((s) => { s.selectedModel = target })
        return `Switched to model: ${target.name} (${target.id})`
      } catch (err) {
        return `Error: ${err instanceof Error ? err.message : String(err)}`
      }
    },
  }),

  list_models: tool({
    description: 'List all available AI models and their status.',
    inputSchema: z.object({}),
    execute: async () => {
      try {
        const state = readStoreState()
        if (!state) return 'No models configured'
        const models = (state.models || []) as Array<{ id: string; name: string; enabled: boolean; provider: string }>
        const providerConfigs = (state.providerConfigs || []) as Array<{ id: string; name: string }>
        const selectedId = (state.selectedModel as { id: string } | undefined)?.id
        if (models.length === 0) return 'No models configured. Add a provider in Settings > Models first.'
        return models.map((m) => {
          const providerName = providerConfigs.find((p) => p.id === m.provider)?.name || m.provider
          return `${m.id === selectedId ? '> ' : '  '}[${m.enabled ? 'ON' : 'OFF'}] ${m.name} (${m.id}) — provider: ${providerName}`
        }).join('\n')
      } catch (err) {
        return `Error: ${err instanceof Error ? err.message : String(err)}`
      }
    },
  }),

  create_session: tool({
    description: 'Create a new chat session with an optional title and agent.',
    inputSchema: z.object({
      title: z.string().optional().describe('Session title (default: "New Chat")'),
      agent_id: z.string().optional().describe('Agent ID to use for this session'),
    }),
    execute: async ({ title, agent_id }) => {
      try {
        const sessionId = crypto.randomUUID()
        const now = Date.now()
        const newSession = {
          id: sessionId,
          title: title || 'New Chat',
          createdAt: now,
          updatedAt: now,
          agentId: agent_id,
          messages: [],
        }
        if (!writeStoreState((s) => {
          s.sessions = [newSession, ...((s.sessions || []) as unknown[])]
          s.activeSessionId = sessionId
        })) return 'Error: Store not available'
        return `Created new session "${title || 'New Chat'}" (ID: ${sessionId})${agent_id ? ` with agent ${agent_id}` : ''}`
      } catch (err) {
        return `Error: ${err instanceof Error ? err.message : String(err)}`
      }
    },
  }),

  list_sessions: tool({
    description: 'List all chat sessions.',
    inputSchema: z.object({}),
    execute: async () => {
      try {
        const state = readStoreState()
        if (!state) return 'No sessions'
        const sessions = (state.sessions || []) as Array<{ id: string; title: string; updatedAt: number; messages?: unknown[] }>
        const activeId = state.activeSessionId as string | undefined
        if (sessions.length === 0) return 'No chat sessions.'
        return sessions.slice(0, 20).map((s) => {
          const date = new Date(s.updatedAt).toLocaleString()
          const msgCount = (s.messages || []).length
          return `${s.id === activeId ? '> ' : '  '}${s.title} (${msgCount} msgs, ${date}) [${s.id}]`
        }).join('\n')
      } catch (err) {
        return `Error: ${err instanceof Error ? err.message : String(err)}`
      }
    },
  }),

  switch_session: tool({
    description: 'Switch to an existing chat session.',
    inputSchema: z.object({
      session_id: z.string().describe('Session ID to switch to'),
    }),
    execute: async ({ session_id }) => {
      try {
        const state = readStoreState()
        if (!state) return 'Error: Store not available'
        const sessions = (state.sessions || []) as Array<{ id: string; title: string }>
        const session = sessions.find((s) => s.id === session_id)
        if (!session) return `Session "${session_id}" not found.`
        writeStoreState((s) => { s.activeSessionId = session_id })
        return `Switched to session: ${session.title} (${session_id})`
      } catch (err) {
        return `Error: ${err instanceof Error ? err.message : String(err)}`
      }
    },
  }),

  add_provider: tool({
    description: 'Add a new AI provider configuration with API key and models.',
    inputSchema: z.object({
      name: z.string().describe('Display name for the provider (e.g., "My OpenAI")'),
      provider_type: z.string().describe('Provider type: anthropic, openai, google, ollama, deepseek, zhipu, minimax, groq, together, fireworks, perplexity, cohere, openai-compatible'),
      api_key: z.string().describe('API key for the provider'),
      base_url: z.string().optional().describe('Custom base URL (required for ollama, openai-compatible)'),
      models: z.string().describe('Comma-separated list of model IDs to add (e.g., "claude-3-opus,claude-3-sonnet")'),
    }),
    execute: async ({ name, provider_type, api_key, base_url, models }) => {
      try {
        const validTypes = ['anthropic', 'openai', 'google', 'ollama', 'deepseek', 'zhipu', 'minimax', 'groq', 'together', 'fireworks', 'perplexity', 'cohere', 'openai-compatible']
        if (!validTypes.includes(provider_type)) return `Invalid provider type. Must be one of: ${validTypes.join(', ')}`
        const providerId = `${provider_type}-${Date.now()}`
        const modelList = models.split(',').map((m) => m.trim()).filter(Boolean)
        if (modelList.length === 0) return 'Error: At least one model ID is required.'
        const providerConfig = {
          id: providerId,
          name,
          apiKey: api_key,
          baseUrl: base_url || '',
          providerType: provider_type,
          models: modelList.map((mid) => ({ modelId: mid, name: mid, enabled: true })),
        }
        const newModels = modelList.map((mid) => ({
          id: `${providerId}:${mid}`,
          name: mid,
          provider: providerId,
          providerType: provider_type,
          modelId: mid,
          apiKey: api_key,
          baseUrl: base_url || '',
          enabled: true,
        }))
        if (!writeStoreState((s) => {
          s.providerConfigs = [...((s.providerConfigs || []) as unknown[]), providerConfig]
          s.models = [...((s.models || []) as unknown[]), ...newModels]
        })) return 'Error: Store not available'
        return `Added provider "${name}" (${provider_type}) with models: ${modelList.join(', ')}`
      } catch (err) {
        return `Error: ${err instanceof Error ? err.message : String(err)}`
      }
    },
  }),

  list_providers: tool({
    description: 'List all configured AI providers and their models.',
    inputSchema: z.object({}),
    execute: async () => {
      try {
        const state = readStoreState()
        if (!state) return 'No providers configured'
        const providers = (state.providerConfigs || []) as Array<{ id: string; name: string; providerType: string; models: Array<{ modelId: string; enabled: boolean }> }>
        if (providers.length === 0) return 'No AI providers configured. Use add_provider to add one.'
        return providers.map((p) => {
          const modelSummary = p.models.map((m) => `${m.modelId}${m.enabled ? '' : ' (disabled)'}`).join(', ')
          return `[${p.providerType}] ${p.name} (${p.id})\n   Models: ${modelSummary}`
        }).join('\n\n')
      } catch (err) {
        return `Error: ${err instanceof Error ? err.message : String(err)}`
      }
    },
  }),

  update_settings: tool({
    description: 'Update application settings. Supports: theme (light/dark/system), fontSize (small/medium/large), locale (en/zh), bubbleStyle (default/minimal/bordered/glassmorphism), historyRetentionDays (number), autoSave (boolean).',
    inputSchema: z.object({
      setting: z.string().describe('Setting key to change'),
      value: z.string().describe('New value for the setting'),
    }),
    execute: async ({ setting, value }) => {
      try {
        const allowedSettings: Record<string, { validate: (v: string) => boolean; transform: (v: string) => unknown }> = {
          theme: { validate: (v) => ['light', 'dark', 'system'].includes(v), transform: (v) => v },
          fontSize: { validate: (v) => ['small', 'medium', 'large'].includes(v), transform: (v) => v },
          locale: { validate: (v) => ['en', 'zh'].includes(v), transform: (v) => v },
          bubbleStyle: { validate: (v) => ['default', 'minimal', 'bordered', 'glassmorphism'].includes(v), transform: (v) => v },
          historyRetentionDays: { validate: (v) => Number.isFinite(Number(v)) && Number(v) >= 0, transform: (v) => Number(v) },
          autoSave: { validate: (v) => ['true', 'false'].includes(v.toLowerCase()), transform: (v) => v.toLowerCase() === 'true' },
        }
        const handler = allowedSettings[setting]
        if (!handler) return `Unknown setting "${setting}". Available: ${Object.keys(allowedSettings).join(', ')}`
        if (!handler.validate(value)) return `Invalid value "${value}" for setting "${setting}".`
        if (!writeStoreState((s) => { s[setting] = handler.transform(value) })) return 'Error: Store not available'
        return `Setting "${setting}" updated to "${value}".`
      } catch (err) {
        return `Error: ${err instanceof Error ? err.message : String(err)}`
      }
    },
  }),

  get_settings: tool({
    description: 'Get current application settings.',
    inputSchema: z.object({}),
    execute: async () => {
      try {
        const state = readStoreState()
        if (!state) return 'Settings not available'
        const settings: Record<string, unknown> = {
          theme: state.theme,
          fontSize: state.fontSize,
          locale: state.locale,
          bubbleStyle: state.bubbleStyle,
          codeFont: state.codeFont,
          historyRetentionDays: state.historyRetentionDays,
          autoSave: state.autoSave,
          accentColor: state.accentColor,
          workspacePath: state.workspacePath,
        }
        return Object.entries(settings).map(([k, v]) => `${k}: ${JSON.stringify(v)}`).join('\n')
      } catch (err) {
        return `Error: ${err instanceof Error ? err.message : String(err)}`
      }
    },
  }),

  install_plugin: tool({
    description: 'Install a plugin by its ID from the marketplace or a URL.',
    inputSchema: z.object({
      plugin_id: z.string().describe('Plugin ID or URL to install'),
      name: z.string().optional().describe('Display name for the plugin'),
    }),
    execute: async ({ plugin_id, name }) => {
      try {
        const state = readStoreState()
        if (!state) return 'Error: Store not available'
        const existing = ((state.installedPlugins || []) as Array<{ id: string }>).find((p) => p.id === plugin_id)
        if (existing) return `Plugin "${plugin_id}" is already installed.`
        const newPlugin = {
          id: plugin_id,
          name: name || plugin_id,
          version: '1.0.0',
          author: 'unknown',
          description: `Plugin ${name || plugin_id}`,
          status: 'enabled',
          hooks: [],
          config: {},
          installedAt: Date.now(),
        }
        writeStoreState((s) => {
          s.installedPlugins = [...((s.installedPlugins || []) as unknown[]), newPlugin]
        })
        return `Plugin "${name || plugin_id}" installed successfully.`
      } catch (err) {
        return `Error: ${err instanceof Error ? err.message : String(err)}`
      }
    },
  }),

  list_plugins: tool({
    description: 'List all installed plugins and their status.',
    inputSchema: z.object({}),
    execute: async () => {
      try {
        const state = readStoreState()
        if (!state) return 'No plugins installed'
        const plugins = (state.installedPlugins || []) as Array<{ id: string; name: string; version: string; status: string }>
        if (plugins.length === 0) return 'No plugins installed.'
        return plugins.map((p) => `[${p.status}] ${p.name} v${p.version} (${p.id})`).join('\n')
      } catch (err) {
        return `Error: ${err instanceof Error ? err.message : String(err)}`
      }
    },
  }),

  remove_plugin: tool({
    description: 'Uninstall/remove a plugin by its ID.',
    inputSchema: z.object({
      plugin_id: z.string().describe('Plugin ID to remove'),
    }),
    execute: async ({ plugin_id }) => {
      try {
        const state = readStoreState()
        if (!state) return 'Error: Store not available'
        const plugins = (state.installedPlugins || []) as Array<{ id: string; name: string }>
        const target = plugins.find((p) => p.id === plugin_id)
        if (!target) return `Plugin "${plugin_id}" not found.`
        writeStoreState((s) => {
          s.installedPlugins = ((s.installedPlugins || []) as Array<{ id: string }>).filter((p) => p.id !== plugin_id)
        })
        return `Plugin "${target.name}" removed.`
      } catch (err) {
        return `Error: ${err instanceof Error ? err.message : String(err)}`
      }
    },
  }),

  switch_agent: tool({
    description: 'Switch to a different AI agent.',
    inputSchema: z.object({
      agent_id: z.string().describe('Agent ID or name to switch to'),
    }),
    execute: async ({ agent_id }) => {
      try {
        const state = readStoreState()
        if (!state) return 'Error: Store not available'
        const agents = (state.agents || []) as Array<{ id: string; name: string; enabled: boolean }>
        const target = agents.find((a) => a.id === agent_id || a.name.toLowerCase().includes(agent_id.toLowerCase()))
        if (!target) return `Agent "${agent_id}" not found. Available: ${agents.map((a) => `${a.name} (${a.id})`).join(', ')}`
        if (!target.enabled) return `Agent "${target.name}" is disabled.`
        writeStoreState((s) => { s.selectedAgent = target })
        return `Switched to agent: ${target.name} (${target.id})`
      } catch (err) {
        return `Error: ${err instanceof Error ? err.message : String(err)}`
      }
    },
  }),

  list_documents: tool({
    description: 'List editable Markdown documents stored in Suora before reading or updating documents.',
    inputSchema: z.object({
      query: z.string().optional().describe('Optional title/content search query'),
      group_id: z.string().optional().describe('Optional document group ID to filter by'),
    }),
    execute: async ({ query, group_id }) => {
      try {
        const state = readStoreState()
        if (!state) return 'Error: Store not available'
        const groups = (state.documentGroups || []) as DocumentGroup[]
        const nodes = (state.documentNodes || []) as DocumentNode[]
        const q = query?.trim().toLowerCase()
        const docs = nodes
          .filter((node): node is DocumentItem => node.type === 'document')
          .filter((doc) => !group_id || doc.groupId === group_id)
          .filter((doc) => !q || doc.title.toLowerCase().includes(q) || doc.markdown.toLowerCase().includes(q))
          .sort((a, b) => b.updatedAt - a.updatedAt)

        if (!docs.length) return query ? `No documents matching "${query}".` : 'No documents found.'
        return docs.slice(0, 30).map((doc) => {
          const groupName = groups.find((group) => group.id === doc.groupId)?.name || doc.groupId
          const selected = state.selectedDocumentId === doc.id ? '> ' : '  '
          return `${selected}${doc.title} (id: ${doc.id}, group: ${groupName}, updated: ${new Date(doc.updatedAt).toLocaleString()})\n  ${summarizeMarkdown(doc.markdown)}`
        }).join('\n\n')
      } catch (err) {
        return `Error listing documents: ${err instanceof Error ? err.message : String(err)}`
      }
    },
  }),

  read_document: tool({
    description: 'Read the full Markdown content of a Suora document by ID or title so an agent can inspect it before editing.',
    inputSchema: z.object({
      document_id: z.string().describe('Document ID or exact/partial title'),
    }),
    execute: async ({ document_id }) => {
      try {
        const state = readStoreState()
        if (!state) return 'Error: Store not available'
        const nodes = (state.documentNodes || []) as DocumentNode[]
        const doc = resolveDocument(nodes, document_id)
        if (!doc) return `Document not found: ${document_id}. Use list_documents to find available documents.`
        return JSON.stringify({
          id: doc.id,
          title: doc.title,
          groupId: doc.groupId,
          parentId: doc.parentId,
          updatedAt: doc.updatedAt,
          markdown: doc.markdown,
        }, null, 2)
      } catch (err) {
        return `Error reading document: ${err instanceof Error ? err.message : String(err)}`
      }
    },
  }),

  update_document: tool({
    description: 'Replace a Suora document with revised Markdown. Typically requires reading the document first and preserving user content unless asked to change it.',
    inputSchema: z.object({
      document_id: z.string().describe('Document ID or exact/partial title to update'),
      markdown: z.string().describe('Complete replacement Markdown content'),
      title: z.string().optional().describe('Optional new document title'),
      reason: z.string().describe('Short reason for the edit, shown in confirmation/tool output'),
    }),
    execute: async ({ document_id, markdown, title, reason }) => {
      try {
        const state = readStoreState()
        if (!state) return 'Error: Store not available'
        const nodes = (state.documentNodes || []) as DocumentNode[]
        const doc = resolveDocument(nodes, document_id)
        if (!doc) return `Document not found: ${document_id}. Use list_documents to find available documents.`
        if (!markdown.trim()) return 'Error: Refusing to replace document with empty Markdown.'
        if (!(await confirmIfNeeded(`document_update\n${doc.title} (${doc.id})\nReason: ${reason}\nNew length: ${markdown.length} characters`))) {
          return 'Cancelled by user confirmation policy.'
        }

        const now = Date.now()
        const nextTitle = title?.trim() || doc.title
        if (!writeStoreState((s) => {
          const arr = (s.documentNodes || []) as DocumentNode[]
          s.documentNodes = arr.map((node) => node.id === doc.id
            ? { ...node, title: nextTitle, markdown, updatedAt: now }
            : node)
          s.selectedDocumentId = doc.id
          s.selectedDocumentGroupId = doc.groupId
        })) return 'Error: Store not available'

        return `Updated document "${nextTitle}" (${doc.id}). Reason: ${reason}`
      } catch (err) {
        return `Error updating document: ${err instanceof Error ? err.message : String(err)}`
      }
    },
  }),

  list_skills: tool({
    description: 'List all available skills and their status. Use this before read_skill or update_skill_content when the user asks to modify a skill through chat.',
    inputSchema: z.object({}),
    execute: async () => {
      try {
        const state = readStoreState()
        if (!state) return 'No skills available'
        const skills = (state.skills || []) as Skill[]
        if (skills.length === 0) return 'No skills available.'
        return skills.map((s) =>
          `${s.name} [${s.enabled !== false ? 'ON' : 'OFF'}] (${s.id}) — ${getSkillSourceLabel(s)}${s.filePath ? `, file: ${s.filePath}` : ''}\n  ${s.description || '(no description)'}`
        ).join('\n')
      } catch (err) {
        return `Error: ${err instanceof Error ? err.message : String(err)}`
      }
    },
  }),

  read_skill: tool({
    description: 'Read a Suora skill definition and its instruction content by ID or name so an agent can inspect it before editing.',
    inputSchema: z.object({
      skill_id: z.string().describe('Skill ID or exact/partial skill name'),
    }),
    execute: async ({ skill_id }) => {
      try {
        const state = readStoreState()
        if (!state) return 'Error: Store not available'
        const skills = (state.skills || []) as Skill[]
        const skill = resolveSkill(skills, skill_id)
        if (!skill) return `Skill not found: ${skill_id}. Use list_skills to find available skills.`
        return JSON.stringify({
          id: skill.id,
          name: skill.name,
          description: skill.description,
          enabled: skill.enabled !== false,
          source: getSkillSourceLabel(skill),
          filePath: skill.filePath,
          whenToUse: skill.whenToUse,
          allowedTools: skill.allowedTools,
          context: skill.context,
          content: getSkillInstructionContent(skill),
        }, null, 2)
      } catch (err) {
        return `Error reading skill: ${err instanceof Error ? err.message : String(err)}`
      }
    },
  }),

  update_skill_content: tool({
    description: 'Replace a Suora skill instruction body with revised Markdown. Typically requires reading the skill first and returning the complete new instruction content.',
    inputSchema: z.object({
      skill_id: z.string().describe('Skill ID or exact/partial skill name to update'),
      content: z.string().describe('Complete replacement Markdown instruction body for the skill'),
      name: z.string().optional().describe('Optional new skill name'),
      description: z.string().optional().describe('Optional new skill description'),
      when_to_use: z.string().optional().describe('Optional updated when-to-use guidance'),
      reason: z.string().describe('Short reason for the edit, shown in confirmation/tool output'),
    }),
    execute: async ({ skill_id, content, name, description, when_to_use, reason }) => {
      try {
        const state = readStoreState()
        if (!state) return 'Error: Store not available'
        const skills = (state.skills || []) as Skill[]
        const skill = resolveSkill(skills, skill_id)
        if (!skill) return `Skill not found: ${skill_id}. Use list_skills to find available skills.`
        if (!content.trim()) return 'Error: Refusing to replace skill content with empty Markdown.'
        if (!(await confirmIfNeeded(`skill_update\n${skill.name} (${skill.id})\nReason: ${reason}\nNew length: ${content.length} characters`))) {
          return 'Cancelled by user confirmation policy.'
        }

        const nextSkill = buildUpdatedSkillContent(skill, {
          content,
          name: name?.trim() || undefined,
          description,
          whenToUse: when_to_use,
        })

        if (!writeStoreState((s) => {
          const arr = (s.skills || []) as Skill[]
          s.skills = arr.map((entry) => entry.id === skill.id ? nextSkill : entry)
        })) return 'Error: Store not available'

        const persistence = await persistSkillFileIfPossible(nextSkill)
        return `Updated skill "${nextSkill.name}" (${nextSkill.id}). Reason: ${reason}\n${persistence}`
      } catch (err) {
        return `Error updating skill: ${err instanceof Error ? err.message : String(err)}`
      }
    },
  }),

  toggle_skill: tool({
    description: 'Enable or disable a skill.',
    inputSchema: z.object({
      skill_id: z.string().describe('Skill ID to toggle'),
      enabled: z.boolean().describe('Whether to enable (true) or disable (false) the skill'),
    }),
    execute: async ({ skill_id, enabled }) => {
      try {
        const state = readStoreState()
        if (!state) return 'Error: Store not available'
        const skills = (state.skills || []) as Array<{ id: string; name: string; enabled: boolean }>
        const target = skills.find((s) => s.id === skill_id)
        if (!target) return `Skill "${skill_id}" not found.`
        writeStoreState((s) => {
          const arr = (s.skills || []) as Array<{ id: string; enabled: boolean }>
          const sk = arr.find((x) => x.id === skill_id)
          if (sk) sk.enabled = enabled
        })
        return `Skill "${target.name}" ${enabled ? 'enabled' : 'disabled'}.`
      } catch (err) {
        return `Error: ${err instanceof Error ? err.message : String(err)}`
      }
    },
  }),
}

// ─── Environment Variable Tools ────────────────────────────────────

const envVarTools: ToolSet = {
  env_get: tool({
    description: 'Get the value of an environment variable by key. Use this to retrieve stored credentials, tokens, or configuration values.',
    inputSchema: z.object({
      key: z.string().describe('Variable name to retrieve'),
    }),
    execute: async ({ key }) => {
      try {
        const state = readStoreState()
        if (!state) return 'Error: Store not available'
        const vars = (state.envVariables || []) as Array<{ key: string; value: string; description?: string; secret: boolean }>
        const v = vars.find((e) => e.key === key)
        if (!v) return `Variable "${key}" not found. Use env_list to see all variables.`
        return v.value
      } catch (err) {
        return `Error: ${err instanceof Error ? err.message : String(err)}`
      }
    },
  }),

  env_set: tool({
    description: 'Set or update an environment variable. Use for storing credentials, API keys, tokens, or any configuration value.',
    inputSchema: z.object({
      key: z.string().describe('Variable name (e.g., DB_PASSWORD, API_TOKEN)'),
      value: z.string().describe('Variable value'),
      description: z.string().optional().describe('Human-readable description'),
      secret: z.boolean().optional().describe('Whether this is a secret (masked in UI). Default: true'),
    }),
    execute: async ({ key, value, description, secret }) => {
      try {
        const isSecret = secret ?? true
        const now = Date.now()
        const state = readStoreState()
        if (!state) return 'Error: Store not available'
        const vars = ((state.envVariables || []) as Array<{ key: string }>)
        const exists = vars.some((e) => e.key === key)
        writeStoreState((s) => {
          const arr = (s.envVariables || []) as Array<{ key: string; value: string; description?: string; secret: boolean; createdAt: number; updatedAt: number }>
          if (exists) {
            const v = arr.find((e) => e.key === key)
            if (v) {
              v.value = value
              if (description !== undefined) v.description = description
              v.secret = isSecret
              v.updatedAt = now
            }
          } else {
            arr.push({ key, value, description, secret: isSecret, createdAt: now, updatedAt: now })
            s.envVariables = arr
          }
        })
        return exists
          ? `Variable "${key}" updated.`
          : `Variable "${key}" created.`
      } catch (err) {
        return `Error: ${err instanceof Error ? err.message : String(err)}`
      }
    },
  }),

  env_list: tool({
    description: 'List all environment variables. Secret values are masked.',
    inputSchema: z.object({}),
    execute: async () => {
      try {
        const state = readStoreState()
        if (!state) return 'Error: Store not available'
        const vars = (state.envVariables || []) as Array<{ key: string; value: string; description?: string; secret: boolean }>
        if (vars.length === 0) return 'No environment variables configured. Use env_set to add one.'
        return vars.map((v) =>
          `${v.key} = ${v.secret ? '********' : v.value}${v.description ? ` (${v.description})` : ''}`
        ).join('\n')
      } catch (err) {
        return `Error: ${err instanceof Error ? err.message : String(err)}`
      }
    },
  }),

  env_delete: tool({
    description: 'Delete an environment variable by key.',
    inputSchema: z.object({
      key: z.string().describe('Variable name to delete'),
    }),
    execute: async ({ key }) => {
      try {
        const state = readStoreState()
        if (!state) return 'Error: Store not available'
        const vars = (state.envVariables || []) as Array<{ key: string }>
        if (!vars.some((e) => e.key === key)) return `Variable "${key}" not found.`
        writeStoreState((s) => {
          s.envVariables = ((s.envVariables || []) as Array<{ key: string }>).filter((e) => e.key !== key)
        })
        return `Variable "${key}" deleted.`
      } catch (err) {
        return `Error: ${err instanceof Error ? err.message : String(err)}`
      }
    },
  }),
}

// Merge env var tools into main builtinToolDefs
Object.assign(builtinToolDefs, envVarTools)

/**
 * A map from tool ID to a short one-sentence description.
 * Used by component tool-picker UIs so the extraction logic lives in one place.
 */
export const BUILTIN_TOOL_DESCRIPTIONS: Record<string, string> = Object.fromEntries(
  Object.entries(builtinToolDefs).map(([id, def]) => [
    id,
    (def as { description?: string }).description?.split('.')[0] ?? id,
  ])
)

/**
 * Tool metadata registry — aligned with Claude Code's buildTool() pattern.
 * Each entry describes a tool's safety characteristics for the permission system.
 */
export const TOOL_META: Record<string, ToolMeta> = {
  // ── Read-only, concurrency-safe tools ──
  list_dir:              { userFacingName: 'List directory', isReadOnly: true, isDestructive: false, isConcurrencySafe: true, requiresConfirmation: false, searchHint: 'browse directory files' },
  read_file:             { userFacingName: 'Read file', isReadOnly: true, isDestructive: false, isConcurrencySafe: true, requiresConfirmation: false, searchHint: 'read file contents' },
  search_files:          { userFacingName: 'Search files', isReadOnly: true, isDestructive: false, isConcurrencySafe: true, requiresConfirmation: false, searchHint: 'grep search regex' },
  glob_files:            { userFacingName: 'Glob files', isReadOnly: true, isDestructive: false, isConcurrencySafe: true, requiresConfirmation: false, searchHint: 'glob find files pattern' },
  file_info:             { userFacingName: 'File info', isReadOnly: true, isDestructive: false, isConcurrencySafe: true, requiresConfirmation: false },
  get_current_time:      { userFacingName: 'Get time', isReadOnly: true, isDestructive: false, isConcurrencySafe: true, requiresConfirmation: false },
  get_system_info:       { userFacingName: 'System info', isReadOnly: true, isDestructive: false, isConcurrencySafe: true, requiresConfirmation: false },
  clipboard_read:        { userFacingName: 'Read clipboard', isReadOnly: true, isDestructive: false, isConcurrencySafe: true, requiresConfirmation: false },
  todo_list:             { userFacingName: 'List todos', isReadOnly: true, isDestructive: false, isConcurrencySafe: true, requiresConfirmation: false },
  timer_list:            { userFacingName: 'List timers', isReadOnly: true, isDestructive: false, isConcurrencySafe: true, requiresConfirmation: false },
  memory_search:         { userFacingName: 'Search memory', isReadOnly: true, isDestructive: false, isConcurrencySafe: true, requiresConfirmation: false },
  memory_list:           { userFacingName: 'List memories', isReadOnly: true, isDestructive: false, isConcurrencySafe: true, requiresConfirmation: false },
  agent_list:            { userFacingName: 'List agents', isReadOnly: true, isDestructive: false, isConcurrencySafe: true, requiresConfirmation: false },
  event_list_triggers:   { userFacingName: 'List triggers', isReadOnly: true, isDestructive: false, isConcurrencySafe: true, requiresConfirmation: false },
  read_attachment:       { userFacingName: 'Read attachment', isReadOnly: true, isDestructive: false, isConcurrencySafe: true, requiresConfirmation: false },
  analyze_code_structure:{ userFacingName: 'Analyze code', isReadOnly: true, isDestructive: false, isConcurrencySafe: true, requiresConfirmation: false, searchHint: 'code structure analysis' },
  find_code_patterns:    { userFacingName: 'Find patterns', isReadOnly: true, isDestructive: false, isConcurrencySafe: true, requiresConfirmation: false, searchHint: 'todo fixme console' },
  git_status:            { userFacingName: 'Git status', isReadOnly: true, isDestructive: false, isConcurrencySafe: true, requiresConfirmation: false },
  git_diff:              { userFacingName: 'Git diff', isReadOnly: true, isDestructive: false, isConcurrencySafe: true, requiresConfirmation: false },
  git_log:               { userFacingName: 'Git log', isReadOnly: true, isDestructive: false, isConcurrencySafe: true, requiresConfirmation: false },
  env_get:               { userFacingName: 'Get env var', isReadOnly: true, isDestructive: false, isConcurrencySafe: true, requiresConfirmation: false },
  env_list:              { userFacingName: 'List env vars', isReadOnly: true, isDestructive: false, isConcurrencySafe: true, requiresConfirmation: false },
  channel_server_status: { userFacingName: 'Channel status', isReadOnly: true, isDestructive: false, isConcurrencySafe: true, requiresConfirmation: false },
  list_models:           { userFacingName: 'List models', isReadOnly: true, isDestructive: false, isConcurrencySafe: true, requiresConfirmation: false },
  list_sessions:         { userFacingName: 'List sessions', isReadOnly: true, isDestructive: false, isConcurrencySafe: true, requiresConfirmation: false },
  list_providers:        { userFacingName: 'List providers', isReadOnly: true, isDestructive: false, isConcurrencySafe: true, requiresConfirmation: false },
  list_plugins:          { userFacingName: 'List plugins', isReadOnly: true, isDestructive: false, isConcurrencySafe: true, requiresConfirmation: false },
  list_documents:        { userFacingName: 'List documents', isReadOnly: true, isDestructive: false, isConcurrencySafe: true, requiresConfirmation: false, searchHint: 'document markdown notes' },
  read_document:         { userFacingName: 'Read document', isReadOnly: true, isDestructive: false, isConcurrencySafe: true, requiresConfirmation: false, searchHint: 'document markdown content' },
  list_skills:           { userFacingName: 'List skills', isReadOnly: true, isDestructive: false, isConcurrencySafe: true, requiresConfirmation: false },
  read_skill:            { userFacingName: 'Read skill', isReadOnly: true, isDestructive: false, isConcurrencySafe: true, requiresConfirmation: false, searchHint: 'skill instructions content' },
  get_settings:          { userFacingName: 'Get settings', isReadOnly: true, isDestructive: false, isConcurrencySafe: true, requiresConfirmation: false },
  skill_suggest_improvements: { userFacingName: 'Suggest improvements', isReadOnly: true, isDestructive: false, isConcurrencySafe: true, requiresConfirmation: false },

  // ── Write tools (not destructive) ──
  write_file:            { userFacingName: 'Write file', isReadOnly: false, isDestructive: false, isConcurrencySafe: false, requiresConfirmation: true, searchHint: 'create write file' },
  edit_file:             { userFacingName: 'Edit file', isReadOnly: false, isDestructive: false, isConcurrencySafe: false, requiresConfirmation: true, searchHint: 'edit replace text' },
  create_directory:      { userFacingName: 'Create dir', isReadOnly: false, isDestructive: false, isConcurrencySafe: false, requiresConfirmation: true },
  copy_file:             { userFacingName: 'Copy file', isReadOnly: false, isDestructive: false, isConcurrencySafe: false, requiresConfirmation: true },
  move_file:             { userFacingName: 'Move file', isReadOnly: false, isDestructive: false, isConcurrencySafe: false, requiresConfirmation: true },
  clipboard_write:       { userFacingName: 'Write clipboard', isReadOnly: false, isDestructive: false, isConcurrencySafe: false, requiresConfirmation: false },
  notify:                { userFacingName: 'Notify', isReadOnly: false, isDestructive: false, isConcurrencySafe: true, requiresConfirmation: false },
  take_screenshot:       { userFacingName: 'Screenshot', isReadOnly: false, isDestructive: false, isConcurrencySafe: true, requiresConfirmation: false },
  todo_add:              { userFacingName: 'Add todo', isReadOnly: false, isDestructive: false, isConcurrencySafe: false, requiresConfirmation: false },
  todo_update:           { userFacingName: 'Update todo', isReadOnly: false, isDestructive: false, isConcurrencySafe: false, requiresConfirmation: false },
  todo_remove:           { userFacingName: 'Remove todo', isReadOnly: false, isDestructive: false, isConcurrencySafe: false, requiresConfirmation: false },
  timer_add:             { userFacingName: 'Add timer', isReadOnly: false, isDestructive: false, isConcurrencySafe: false, requiresConfirmation: false },
  timer_update:          { userFacingName: 'Update timer', isReadOnly: false, isDestructive: false, isConcurrencySafe: false, requiresConfirmation: false },
  timer_remove:          { userFacingName: 'Remove timer', isReadOnly: false, isDestructive: false, isConcurrencySafe: false, requiresConfirmation: false },
  memory_store:          { userFacingName: 'Store memory', isReadOnly: false, isDestructive: false, isConcurrencySafe: false, requiresConfirmation: false },
  memory_delete:         { userFacingName: 'Delete memory', isReadOnly: false, isDestructive: false, isConcurrencySafe: false, requiresConfirmation: false },
  agent_notify:          { userFacingName: 'Notify agent', isReadOnly: false, isDestructive: false, isConcurrencySafe: false, requiresConfirmation: false },
  event_create_trigger:  { userFacingName: 'Create trigger', isReadOnly: false, isDestructive: false, isConcurrencySafe: false, requiresConfirmation: false },
  event_delete_trigger:  { userFacingName: 'Delete trigger', isReadOnly: false, isDestructive: false, isConcurrencySafe: false, requiresConfirmation: false },
  git_add:               { userFacingName: 'Git add', isReadOnly: false, isDestructive: false, isConcurrencySafe: false, requiresConfirmation: true },
  git_commit:            { userFacingName: 'Git commit', isReadOnly: false, isDestructive: false, isConcurrencySafe: false, requiresConfirmation: true },
  env_set:               { userFacingName: 'Set env var', isReadOnly: false, isDestructive: false, isConcurrencySafe: false, requiresConfirmation: false },
  env_delete:            { userFacingName: 'Delete env var', isReadOnly: false, isDestructive: false, isConcurrencySafe: false, requiresConfirmation: false },
  update_document:       { userFacingName: 'Update document', isReadOnly: false, isDestructive: false, isConcurrencySafe: false, requiresConfirmation: true, searchHint: 'edit document markdown note' },
  skill_create:          { userFacingName: 'Create skill', isReadOnly: false, isDestructive: false, isConcurrencySafe: false, requiresConfirmation: false },
  skill_improve:         { userFacingName: 'Improve skill', isReadOnly: false, isDestructive: false, isConcurrencySafe: false, requiresConfirmation: false },
  update_skill_content:  { userFacingName: 'Update skill content', isReadOnly: false, isDestructive: false, isConcurrencySafe: false, requiresConfirmation: true, searchHint: 'edit skill instructions markdown' },
  switch_model:          { userFacingName: 'Switch model', isReadOnly: false, isDestructive: false, isConcurrencySafe: false, requiresConfirmation: false },
  create_session:        { userFacingName: 'Create session', isReadOnly: false, isDestructive: false, isConcurrencySafe: false, requiresConfirmation: false },
  switch_session:        { userFacingName: 'Switch session', isReadOnly: false, isDestructive: false, isConcurrencySafe: false, requiresConfirmation: false },
  switch_agent:          { userFacingName: 'Switch agent', isReadOnly: false, isDestructive: false, isConcurrencySafe: false, requiresConfirmation: false },
  toggle_skill:          { userFacingName: 'Toggle skill', isReadOnly: false, isDestructive: false, isConcurrencySafe: false, requiresConfirmation: false },
  update_settings:       { userFacingName: 'Update settings', isReadOnly: false, isDestructive: false, isConcurrencySafe: false, requiresConfirmation: false },
  add_provider:          { userFacingName: 'Add provider', isReadOnly: false, isDestructive: false, isConcurrencySafe: false, requiresConfirmation: false },
  install_plugin:        { userFacingName: 'Install plugin', isReadOnly: false, isDestructive: false, isConcurrencySafe: false, requiresConfirmation: false },
  remove_plugin:         { userFacingName: 'Remove plugin', isReadOnly: false, isDestructive: false, isConcurrencySafe: false, requiresConfirmation: false },

  // ── Potentially destructive tools ──
  delete_file:           { userFacingName: 'Delete file', isReadOnly: false, isDestructive: true, isConcurrencySafe: false, requiresConfirmation: true },
  shell:                 { userFacingName: 'Run command', isReadOnly: false, isDestructive: true, isConcurrencySafe: false, requiresConfirmation: true, searchHint: 'execute shell command terminal' },

  // ── Network tools ──
  web_search:            { userFacingName: 'Web search', isReadOnly: true, isDestructive: false, isConcurrencySafe: true, requiresConfirmation: false, searchHint: 'search internet web' },
  fetch_webpage:         { userFacingName: 'Fetch page', isReadOnly: true, isDestructive: false, isConcurrencySafe: true, requiresConfirmation: false, searchHint: 'fetch read webpage url' },
  open_url:              { userFacingName: 'Open URL', isReadOnly: false, isDestructive: false, isConcurrencySafe: true, requiresConfirmation: true },
  browser_navigate:      { userFacingName: 'Navigate browser', isReadOnly: true, isDestructive: false, isConcurrencySafe: false, requiresConfirmation: false, searchHint: 'headless browser navigate' },
  browser_screenshot:    { userFacingName: 'Browser screenshot', isReadOnly: true, isDestructive: false, isConcurrencySafe: false, requiresConfirmation: false },
  browser_evaluate:      { userFacingName: 'Browser eval', isReadOnly: false, isDestructive: false, isConcurrencySafe: false, requiresConfirmation: true },
  browser_extract_links: { userFacingName: 'Extract links', isReadOnly: true, isDestructive: false, isConcurrencySafe: false, requiresConfirmation: false },
  browser_extract_text:  { userFacingName: 'Extract text', isReadOnly: true, isDestructive: false, isConcurrencySafe: false, requiresConfirmation: false },
  browser_fill_form:     { userFacingName: 'Fill form', isReadOnly: false, isDestructive: false, isConcurrencySafe: false, requiresConfirmation: true },
  browser_click:         { userFacingName: 'Click element', isReadOnly: false, isDestructive: false, isConcurrencySafe: false, requiresConfirmation: true },

  // ── Agent communication tools ──
  agent_delegate:        { userFacingName: 'Delegate to agent', isReadOnly: false, isDestructive: false, isConcurrencySafe: false, requiresConfirmation: false, searchHint: 'delegate agent subagent' },
  ask_user_question:     { userFacingName: 'Ask user', isReadOnly: false, isDestructive: false, isConcurrencySafe: true, requiresConfirmation: false },
  loop_execute:          { userFacingName: 'Loop execute', isReadOnly: false, isDestructive: false, isConcurrencySafe: false, requiresConfirmation: false },

  // ── Channel tools ──
  channel_start_server:  { userFacingName: 'Start channel', isReadOnly: false, isDestructive: false, isConcurrencySafe: false, requiresConfirmation: true },
  channel_stop_server:   { userFacingName: 'Stop channel', isReadOnly: false, isDestructive: false, isConcurrencySafe: false, requiresConfirmation: true },
  channel_send_message:  { userFacingName: 'Send channel msg', isReadOnly: false, isDestructive: false, isConcurrencySafe: false, requiresConfirmation: false },

  // ── Email ──
  send_email:            { userFacingName: 'Send email', isReadOnly: false, isDestructive: false, isConcurrencySafe: false, requiresConfirmation: true, searchHint: 'email smtp send' },
}

/**
 * Get the metadata for a tool by name.
 * Returns a safe default (non-destructive, requires confirmation) for unknown tools.
 */
export function getToolMeta(toolName: string): ToolMeta {
  return TOOL_META[toolName] ?? {
    userFacingName: toolName,
    isReadOnly: false,
    isDestructive: false,
    isConcurrencySafe: false,
    requiresConfirmation: true, // Fail-closed for unknown tools
  }
}

/**
 * Build a system-prompt section that tells the model which tools are
 * dangerous / read-only / require confirmation.
 *
 * Mirrors Claude Code's getToolsSection() pattern — the model receives
 * contextual hints about every tool in its active set so it can make
 * better decisions about which tool to invoke.
 */
export function buildToolHints(toolNames: string[]): string {
  if (toolNames.length === 0) return ''

  const destructive: string[] = []
  const readOnly: string[] = []
  const confirmRequired: string[] = []

  for (const name of toolNames) {
    const meta = getToolMeta(name)
    if (meta.isDestructive) destructive.push(name)
    else if (meta.isReadOnly) readOnly.push(name)
    if (meta.requiresConfirmation && !meta.isDestructive) confirmRequired.push(name)
  }

  const lines: string[] = []
  if (readOnly.length > 0) {
    lines.push(`Read-only tools (safe, no side effects): ${readOnly.join(', ')}`)
  }
  if (destructive.length > 0) {
    lines.push(`Destructive tools (use with care, can cause irreversible changes): ${destructive.join(', ')}`)
  }
  if (confirmRequired.length > 0) {
    lines.push(`Tools that may be gated by confirmation policy: ${confirmRequired.join(', ')}`)
  }

  if (lines.length === 0) return ''
  return `\n\nTool safety hints:\n${lines.join('\n')}`
}

/**
 * Format a tool execution error into a concise, LLM-friendly string.
 *
 * Mirrors Claude Code's formatError() — truncates large errors (10 KB limit)
 * and extracts structured info from known error types.
 */
export function formatToolError(error: unknown): string {
  if (!(error instanceof Error)) return String(error)

  const parts: string[] = [error.message]

  // Append stderr/stdout if available (shell errors)
  const anyErr = error as unknown as Record<string, unknown>
  if (typeof anyErr.stderr === 'string' && anyErr.stderr) parts.push(anyErr.stderr)
  if (typeof anyErr.stdout === 'string' && anyErr.stdout) parts.push(anyErr.stdout)
  if (typeof anyErr.code === 'number') parts.unshift(`Exit code ${anyErr.code}`)

  const full = parts.filter(Boolean).join('\n').trim()

  // Truncate if > 10 KB
  const MAX = 10_000
  if (full.length <= MAX) return full
  const half = MAX / 2
  return `${full.slice(0, half)}\n\n... [${full.length - MAX} characters truncated] ...\n\n${full.slice(-half)}`
}

// ─── System Prompt Builder ─────────────────────────────────────────

export interface SystemPromptOptions {
  /** Agent's base system prompt */
  agentPrompt?: string
  /** Response style hint (concise/detailed) */
  responseStyle?: string
  /** Agent's recent memories */
  memories?: Array<{ content: string }>
  /** Skill-generated system prompts (pre-resolved) */
  skillPrompts?: string
  /** Available tool names (for safety hints) */
  toolNames?: string[]
  /** Permission mode label */
  permissionMode?: string
}

const STYLE_HINTS: Record<string, string> = {
  concise: 'Be concise and to the point. Avoid unnecessary verbosity.',
  detailed: 'Be thorough and detailed. Explain reasoning step by step.',
}

/**
 * Build a structured system prompt with clear sections.
 *
 * Mirrors Claude Code's sectioned prompt architecture:
 * - Static sections (agent prompt, rules) are stable across turns
 * - Dynamic sections (time, memory, platform) change per request
 * - Sections are clearly delimited for readability
 */
export function buildSystemPrompt(opts: SystemPromptOptions): string | undefined {
  const sections: string[] = []

  // ── Static: agent identity & instructions ──
  if (opts.agentPrompt) {
    sections.push(opts.agentPrompt)
  }

  if (opts.responseStyle && STYLE_HINTS[opts.responseStyle]) {
    sections.push(`<response-style>\n${STYLE_HINTS[opts.responseStyle]}\n</response-style>`)
  }

  if (opts.permissionMode && opts.permissionMode !== 'default') {
    const modeDesc: Record<string, string> = {
      acceptEdits: 'You may perform file edits without explicit user confirmation. Be accurate and careful.',
      plan: 'You must present your plan before executing any actions. Wait for user approval.',
      bypassPermissions: 'All tool permissions are bypassed. You have full autonomy.',
    }
    if (modeDesc[opts.permissionMode]) {
      sections.push(`<permission-mode>\n${modeDesc[opts.permissionMode]}\n</permission-mode>`)
    }
  }

  // ── Static: skill prompts ──
  if (opts.skillPrompts) {
    sections.push(opts.skillPrompts)
  }

  // ── Static: tool safety hints ──
  if (opts.toolNames?.length) {
    const hints = buildToolHints(opts.toolNames)
    if (hints) sections.push(hints.trim())
  }

  // ── Dynamic: agent memory ──
  if (opts.memories?.length) {
    const memItems = opts.memories.slice(-8).map((m) => `- ${m.content}`).join('\n')
    sections.push(`<agent-memory>\n${memItems}\n</agent-memory>`)
  }

  // ── Dynamic: environment ──
  const platform = typeof navigator !== 'undefined' && navigator.userAgent?.includes('Windows')
    ? 'Windows (PowerShell)'
    : typeof navigator !== 'undefined' && navigator.userAgent?.includes('Mac')
      ? 'macOS'
      : 'Linux'
  sections.push(`<environment>\nSystem: ${platform}. When executing shell commands, use platform-native syntax.\nCurrent time: ${new Date().toLocaleString()} (${Intl.DateTimeFormat().resolvedOptions().timeZone})\n</environment>`)

  const result = sections.join('\n\n').trim()
  return result || undefined
}

// ─── Built-in skill definitions ────────────────────────────────────
// All built-in tools are always available to agents directly.
// Skills are now purely marketplace / custom add-ons (prompts + custom code).

export const BUILTIN_SKILLS: Skill[] = []


// ─── Marketplace skill catalog ─────────────────────────────────────

export const MARKETPLACE_CATALOG: Skill[] = [
  {
    id: 'mp-deep-research',
    name: 'Deep Research',
    description: 'Multi-step web research with source verification, cross-referencing, and structured report generation',
    enabled: true,
    source: 'registry',
    content: 'When conducting research, follow a systematic approach:\n1. Break the query into sub-questions\n2. Search multiple sources for each sub-question\n3. Cross-reference findings and identify contradictions\n4. Synthesize a structured report with citations\n5. Rate confidence level for each finding',
    frontmatter: { name: 'Deep Research', description: 'Multi-step web research with source verification' },
    context: 'inline',
    author: 'Suora',
    version: '2.1.0',
    downloads: 12800,
    rating: 4.9,
    icon: 'lucide:telescope#3B82F6',
    category: 'Research',
  },
  {
    id: 'mp-code-reviewer',
    name: 'Code Reviewer',
    description: 'Automated code review with security scanning, performance analysis, and best practice enforcement',
    enabled: true,
    source: 'registry',
    content: 'When reviewing code:\n1. Check for security vulnerabilities (OWASP Top 10)\n2. Analyze performance bottlenecks\n3. Verify error handling completeness\n4. Check naming conventions and code style\n5. Suggest specific improvements with examples',
    frontmatter: { name: 'Code Reviewer', description: 'Automated code review with security scanning' },
    context: 'inline',
    author: 'Suora',
    version: '3.0.0',
    downloads: 9500,
    rating: 4.8,
    icon: 'lucide:shield-check#10B981',
    category: 'Development',
  },
  {
    id: 'mp-git-workflow',
    name: 'Git Workflow',
    description: 'Automated git workflows: conventional commits, changelog generation, branch management, and PR descriptions',
    enabled: true,
    source: 'registry',
    content: 'Follow conventional commits format. When creating commits:\n- feat: new feature\n- fix: bug fix\n- docs: documentation\n- refactor: code refactoring\n- test: adding tests\nGenerate changelogs grouped by type. Write clear PR descriptions with context, changes, and testing notes.',
    frontmatter: { name: 'Git Workflow', description: 'Automated git workflows with conventional commits' },
    context: 'inline',
    author: 'Suora',
    version: '1.5.0',
    downloads: 7200,
    rating: 4.7,
    icon: 'lucide:git-pull-request#F43F5E',
    category: 'Development',
  },
  {
    id: 'mp-data-pipeline',
    name: 'Data Pipeline',
    description: 'Process CSV/JSON data files with cleaning, transformation, analysis, and visualization-ready output',
    enabled: true,
    source: 'registry',
    content: 'When processing data:\n1. Inspect the data structure and quality\n2. Identify and handle missing values, duplicates, outliers\n3. Apply transformations as requested\n4. Generate summary statistics\n5. Output clean data in the requested format',
    frontmatter: { name: 'Data Pipeline', description: 'Process CSV/JSON data files' },
    context: 'inline',
    author: 'Community',
    version: '2.0.0',
    downloads: 5400,
    rating: 4.6,
    icon: 'lucide:database#F59E0B',
    category: 'Data',
  },
  {
    id: 'mp-api-tester',
    name: 'API Tester',
    description: 'Test REST APIs with automated request generation, response validation, and documentation',
    enabled: true,
    source: 'registry',
    content: 'When testing APIs:\n1. Parse the API spec or URL\n2. Generate test requests for each endpoint\n3. Validate response status codes, headers, and body\n4. Check error handling with edge cases\n5. Generate a test report with results',
    frontmatter: { name: 'API Tester', description: 'Test REST APIs with automated request generation' },
    context: 'inline',
    author: 'Community',
    version: '1.3.0',
    downloads: 4200,
    rating: 4.5,
    icon: 'lucide:zap#8B5CF6',
    category: 'Development',
  },
  {
    id: 'mp-doc-writer',
    name: 'Doc Writer',
    description: 'Generate comprehensive documentation from code: README, API docs, architecture guides, and inline comments',
    enabled: true,
    source: 'registry',
    content: 'When generating documentation:\n1. Analyze the codebase structure\n2. Identify public interfaces and key abstractions\n3. Write clear descriptions with usage examples\n4. Include installation, configuration, and troubleshooting sections\n5. Follow the project\'s existing documentation style',
    frontmatter: { name: 'Doc Writer', description: 'Generate comprehensive documentation from code' },
    context: 'inline',
    author: 'Suora',
    version: '2.2.0',
    downloads: 8100,
    rating: 4.7,
    icon: 'lucide:book-open#06B6D4',
    category: 'Documentation',
  },
  {
    id: 'mp-prompt-engineer',
    name: 'Prompt Engineer',
    description: 'Craft, test, and optimize prompts for AI models with A/B testing and scoring framework',
    enabled: true,
    source: 'registry',
    content: 'Help craft effective prompts by:\n1. Understanding the desired output format and quality\n2. Applying prompt engineering techniques (few-shot, chain-of-thought, role-play)\n3. Testing variations and comparing outputs\n4. Iterating based on results\n5. Documenting the final prompt with rationale',
    frontmatter: { name: 'Prompt Engineer', description: 'Craft and optimize prompts for AI models' },
    context: 'inline',
    author: 'Community',
    version: '1.0.0',
    downloads: 6300,
    rating: 4.8,
    icon: 'lucide:sparkles#A855F7',
    category: 'AI',
  },
  {
    id: 'mp-i18n-translator',
    name: 'i18n Translator',
    description: 'Translate application strings, documents, and content between 20+ languages with context awareness',
    enabled: true,
    source: 'registry',
    content: 'When translating:\n1. Detect source language automatically\n2. Preserve technical terms and placeholders ({variable}, %s, etc.)\n3. Maintain consistent terminology across the project\n4. Provide natural, idiomatic translations\n5. For ambiguous terms, offer alternatives with context',
    frontmatter: { name: 'i18n Translator', description: 'Translate application strings between 20+ languages' },
    context: 'inline',
    author: 'Suora',
    version: '1.8.0',
    downloads: 5800,
    rating: 4.6,
    icon: 'lucide:languages#EC4899',
    category: 'Productivity',
  },
  {
    id: 'mp-devops-deploy',
    name: 'DevOps Deploy',
    description: 'Automate deployment workflows: Docker, CI/CD pipelines, server management, and monitoring setup',
    enabled: true,
    source: 'registry',
    content: 'When handling deployments:\n1. Verify environment prerequisites\n2. Run pre-deployment checks (tests, linting)\n3. Create backups before destructive operations\n4. Execute deployment steps with progress tracking\n5. Verify deployment success and rollback if needed\nAlways explain commands before executing them.',
    frontmatter: { name: 'DevOps Deploy', description: 'Automate deployment workflows' },
    context: 'inline',
    author: 'Community',
    version: '2.5.0',
    downloads: 3900,
    rating: 4.4,
    icon: 'lucide:rocket#F97316',
    category: 'DevOps',
  },
  {
    id: 'mp-project-scaffold',
    name: 'Project Scaffold',
    description: 'Generate project boilerplate: React, Vue, Node, Python, Go with best practices and CI/CD configs',
    enabled: true,
    source: 'registry',
    content: 'When scaffolding projects:\n1. Ask about target framework, language, and requirements\n2. Generate a clean directory structure\n3. Include essential configs (tsconfig, eslint, prettier, etc.)\n4. Set up testing infrastructure\n5. Add CI/CD pipeline configuration\n6. Create README with setup instructions',
    frontmatter: { name: 'Project Scaffold', description: 'Generate project boilerplate with best practices' },
    context: 'inline',
    author: 'Suora',
    version: '3.1.0',
    downloads: 7600,
    rating: 4.7,
    icon: 'lucide:folder-tree#14B8A6',
    category: 'Development',
  },
  {
    id: 'mp-security-audit',
    name: 'Security Audit',
    description: 'Comprehensive security auditing: dependency scanning, code analysis, and compliance checks',
    enabled: true,
    source: 'registry',
    content: 'When performing security audits:\n1. Scan dependencies for known vulnerabilities\n2. Analyze code for injection, XSS, CSRF, and other OWASP risks\n3. Check authentication and authorization patterns\n4. Review secrets management (no hardcoded keys)\n5. Generate a prioritized findings report with remediation steps',
    frontmatter: { name: 'Security Audit', description: 'Comprehensive security auditing' },
    context: 'inline',
    author: 'Suora',
    version: '1.4.0',
    downloads: 4700,
    rating: 4.8,
    icon: 'lucide:shield-alert#EF4444',
    category: 'Security',
  },
  {
    id: 'mp-test-generator',
    name: 'Test Generator',
    description: 'Auto-generate unit tests, integration tests, and E2E tests with coverage-driven approach',
    enabled: true,
    source: 'registry',
    content: 'When generating tests:\n1. Analyze the code under test (functions, classes, APIs)\n2. Identify edge cases, error paths, and boundary conditions\n3. Generate tests following the project\'s testing framework\n4. Include descriptive test names and assertions\n5. Aim for meaningful coverage, not just line count',
    frontmatter: { name: 'Test Generator', description: 'Auto-generate unit, integration, and E2E tests' },
    context: 'inline',
    author: 'Community',
    version: '2.0.0',
    downloads: 6900,
    rating: 4.6,
    icon: 'lucide:test-tubes#22C55E',
    category: 'Development',
  },
]

export async function fetchMarketplaceSkills(): Promise<Skill[]> {
  try {
    const url = resolveMarketplaceUrl()
    const res = await fetch(url, { cache: 'no-store' })
    if (!res.ok) throw new Error(`Failed to fetch marketplace: ${res.status}`)
    const data = (await res.json()) as Skill[]
    if (!Array.isArray(data) || data.length === 0) {
      throw new Error('Marketplace payload is empty')
    }
    return data
  } catch {
    return MARKETPLACE_CATALOG
  }
}

// ─── Tool execution instrumentation ──────────────────────────────

/**
 * Wrap every tool in a ToolSet with execution-level logging.
 * Logs input, output, errors, and duration to the file logger.
 * This is the ONLY place tool execution is instrumented — if a tool
 * returns an error string (not throws), it is still logged as a warning.
 */
function instrumentToolSet(tools: ToolSet, agentPermissionMode?: string): ToolSet {
  const wrapped: ToolSet = {}
  const runningCounts = new Map<string, number>()

  for (const [name, toolDef] of Object.entries(tools)) {
    const originalExecute = toolDef.execute
    if (!originalExecute) {
      wrapped[name] = toolDef
      continue
    }

    // Create a new tool with the same schema but instrumented execute
    wrapped[name] = tool({
      description: toolDef.description ?? name,
      inputSchema: toolDef.inputSchema,
      execute: async (args: Record<string, unknown>) => {
        const meta = getToolMeta(name)
        const running = runningCounts.get(name) ?? 0
        const effectiveMode = agentPermissionMode || 'default'

        // Permission mode-aware gating (Claude Code pattern)
        // 'bypassPermissions' → skip all checks
        // 'plan' → block destructive tools (agent must present plan first)
        // 'acceptEdits' → block only isDestructive tools
        // 'default' → use security.requireConfirmation setting
        if (effectiveMode === 'plan' && (meta.isDestructive || meta.requiresConfirmation) && !meta.isReadOnly) {
          logger.warn(`[ToolExec:PlanMode] ${name} blocked — plan mode requires approval`, { tool: name })
          return `Tool "${name}" is blocked in plan mode. Only read-only tools are allowed without explicit plan approval.`
        }

        // Prevent overlapping execution for tools that are not concurrency-safe.
        if (!meta.isConcurrencySafe && running > 0) {
          logger.warn(`[ToolExec:Busy] ${name} is not concurrency-safe`, { tool: name, running })
          return `Tool "${name}" is already running and does not support concurrent execution. Please wait for the current call to finish.`
        }

        runningCounts.set(name, running + 1)
        const startTime = performance.now()
        const inputPreview = JSON.stringify(args)
        const inputLog = inputPreview.length <= 4000 ? inputPreview : inputPreview.slice(0, 4000) + '...[truncated]'

        logger.info(`[ToolExec:Start] ${name}`, { tool: name, input: args })

        try {
          const shouldBypassNestedConfirm = effectiveMode === 'bypassPermissions' || (effectiveMode === 'acceptEdits' && !meta.isDestructive)
          const requiresWrapperConfirmation = effectiveMode === 'default' && meta.requiresConfirmation
          if (requiresWrapperConfirmation && !(await confirmIfNeeded(`${name}\n${inputLog}`))) {
            logger.warn(`[ToolExec:Cancelled] ${name} denied by confirmation policy`, { tool: name })
            return 'Cancelled by user confirmation policy.'
          }

          const executeOriginal = () => (originalExecute as (args: Record<string, unknown>) => Promise<string>)(args)
          const result = shouldBypassNestedConfirm || requiresWrapperConfirmation
            ? await runWithToolConfirmationBypass(executeOriginal)
            : await executeOriginal()
          const duration = (performance.now() - startTime).toFixed(0)
          const resultStr = typeof result === 'string' ? result : JSON.stringify(result)
          const isErrorResult = typeof result === 'string' && (
            result.startsWith('Error:') ||
            result.startsWith('[Custom tool error]') ||
            result.startsWith('Path blocked') ||
            result.startsWith('Command blocked') ||
            result.startsWith('Cancelled by')
          )

          if (isErrorResult) {
            logger.warn(`[ToolExec:Fail] ${name} | duration=${duration}ms | returned error`, {
              tool: name,
              durationMs: duration,
              input: inputLog,
              error: resultStr.slice(0, 4000),
            })
          } else {
            const outputLog = resultStr.length <= 4000 ? resultStr : resultStr.slice(0, 4000) + `...[truncated ${resultStr.length - 4000} chars]`
            logger.info(`[ToolExec:Done] ${name} | duration=${duration}ms | outputLen=${resultStr.length}`, {
              tool: name,
              durationMs: duration,
              output: outputLog,
            })
          }

          return result
        } catch (err) {
          const duration = (performance.now() - startTime).toFixed(0)
          const errorMsg = err instanceof Error ? err.message : String(err)
          const errorStack = err instanceof Error ? err.stack : undefined

          logger.error(`[ToolExec:Error] ${name} | duration=${duration}ms | THREW exception`, {
            tool: name,
            durationMs: duration,
            input: inputLog,
            error: errorMsg,
            stack: errorStack,
          })

          // Return formatted error instead of re-throwing so the model can recover
          // (Claude Code pattern: tool errors are surfaced as result strings)
          return `Error: ${formatToolError(err)}`
        } finally {
          const current = runningCounts.get(name) ?? 1
          if (current <= 1) {
            runningCounts.delete(name)
          } else {
            runningCounts.set(name, current - 1)
          }
        }
      },
    })
  }

  return wrapped
}

// ─── Tool resolver ─────────────────────────────────────────────────

/**
 * Get all available skills (backward compatible wrapper).
 * With the new prompt-based skill system, this simply returns all skills.
 */
export function mergeSkillsWithBuiltins(storeSkills: Skill[]): Skill[] {
  return storeSkills
}

/**
 * Resolve the set of AI SDK tools available to an agent.
 *
 * In the new prompt-based skill system, all built-in tools are always available.
 * Skills provide knowledge (prompts) not tools — agents decide tools autonomously.
 * Skills can optionally specify allowedTools in their frontmatter to hint
 * which tools are relevant, but this is advisory not restrictive.
 *
 * @param agentSkillIds   Skill IDs assigned to the agent (for allowed-tools hints)
 * @param allSkills       All available skills
 * @param options         Optional configuration:
 *   - includePluginTools: merge plugin-registered tools (default false)
 *   - allowedTools:       allowlist — if non-empty only these tool names are kept
 *   - disallowedTools:    denylist — these tool names are always removed
 *   - permissionMode:     agent-level permission override (Claude Code pattern)
 */
export function getToolsForAgent(
  agentSkillIds: string[],
  allSkills: Skill[],
  options: {
    includePluginTools?: boolean
    allowedTools?: string[]
    disallowedTools?: string[]
    permissionMode?: 'default' | 'acceptEdits' | 'plan' | 'bypassPermissions'
  } = {},
): ToolSet {
  const { includePluginTools = false, allowedTools, disallowedTools, permissionMode } = options
  let result: ToolSet = {}

  // Always include ALL built-in tools — agents decide which to use
  for (const [name, def] of Object.entries(builtinToolDefs)) {
    result[name] = def
  }

  // Merge plugin-registered tools only when explicitly requested
  if (includePluginTools) {
    const pluginTools = getPluginTools()
    for (const [name, def] of Object.entries(pluginTools)) {
      if (!(name in result)) {
        result[name] = def
      }
    }
  }

  // --- Permission filtering (Claude Code pattern) ---
  // Collect allowed tools from skills (advisory) and agent config (restrictive)
  const skillAllowedTools = new Set<string>()
  for (const skillId of agentSkillIds) {
    const skill = allSkills.find((s) => s.id === skillId)
    if (skill?.enabled && skill.allowedTools?.length) {
      for (const t of skill.allowedTools) skillAllowedTools.add(t)
    }
  }

  // 1. Agent-level allowedTools allowlist: if specified, keep only listed tools
  if (allowedTools && allowedTools.length > 0) {
    const allowed = new Set(allowedTools)
    result = Object.fromEntries(
      Object.entries(result).filter(([name]) => allowed.has(name))
    )
  }
  // 2. Agent-level disallowedTools denylist: always remove listed tools
  if (disallowedTools && disallowedTools.length > 0) {
    const denied = new Set(disallowedTools)
    result = Object.fromEntries(
      Object.entries(result).filter(([name]) => !denied.has(name))
    )
  }

  // Wrap every tool with execution-level logging & permission gating
  return instrumentToolSet(result, permissionMode)
}

/**
 * Build a system-prompt contribution from the skills assigned to an agent.
 *
 * In the new prompt-based skill system, each skill's `content` (markdown body)
 * is injected into the system prompt. Skills provide procedural knowledge
 * that helps agents accomplish tasks — no tool specification needed.
 *
 * Format: Each skill is wrapped in an XML-like tag for clarity.
 */
export async function getSkillSystemPrompts(
  agentSkillIds: string[],
  allSkills: Skill[],
): Promise<string> {
  const parts: string[] = []

  for (const skillId of agentSkillIds) {
    const skill = allSkills.find((s) => s.id === skillId)
    if (!skill?.enabled) continue

    const lines: string[] = []

    // 1. Skill content (markdown instructions)
    const content = skill.content ?? skill.prompt
    if (typeof content === 'string' && content.trim()) {
      lines.push(content.trim())
    }

    // 2. Reference files — read external files and append
    if (skill.referenceFiles?.length) {
      for (const ref of skill.referenceFiles) {
        try {
          const fileContent = await window.electron.invoke('fs:readFile', ref.path) as string | { error: string }
          if (typeof fileContent === 'string' && fileContent.trim()) {
            const label = ref.label || ref.path.split(/[/\\]/).pop() || 'Reference'
            lines.push(`### ${label}\n\n${fileContent.trim()}`)
          } else if (typeof fileContent === 'object' && 'error' in fileContent) {
            logger.warn(`[getSkillSystemPrompts] Failed to read reference: ${ref.path}: ${fileContent.error}`)
          }
        } catch {
          logger.warn(`[getSkillSystemPrompts] Failed to read reference: ${ref.path}`)
        }
      }
    }

    if (lines.length > 0) {
      const whenToUse = skill.whenToUse ? `\nUse when: ${skill.whenToUse}` : ''
      parts.push(`<skill name="${skill.name}">${whenToUse}\n${lines.join('\n\n')}\n</skill>`)
    }
  }

  if (parts.length === 0) return ''
  return `\n\n${parts.join('\n\n')}`
}
