// Built-in tool definitions and skill registry
//
// Architecture aligned with Claude Code source:
// - Tools have metadata (ToolMeta): isReadOnly, isDestructive, isConcurrencySafe, requiresConfirmation
// - Permission system: 3-level check (validate → checkPermissions → confirm)
// - Tools filtered by agent's allowedTools (allowlist) and disallowedTools (denylist)
// - Skills are tool groupings with optional system prompt

import { tool, type ToolSet } from 'ai'
import { z } from 'zod'
import type { Agent, AgentPipeline, AgentPipelineBudget, AgentPipelineStep, AgentPipelineVariable, DocumentFolder, DocumentGroup, DocumentItem, DocumentNode, MemoryScope, Model, Skill, ToolMeta, ToolSecuritySettings } from '@/types'
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
import { analyzeDocumentGraphInsights, buildDocumentGraph, queryDocumentGraph } from '@/services/documentGraph'
import { createDocument, createDocumentGroup, searchDocuments } from '@/services/documents'
import { deletePipelineFromDisk, loadPipelinesFromDisk, savePipelineToDisk } from '@/services/pipelineFiles'
import { validateAgentPipeline } from '@/services/pipelineValidation'
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
  scope: MemoryScope
  createdAt: number
  source?: string
  targetId?: string
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

interface PersistedSessionEntry {
  id: string
  memories?: PersistedMemoryEntry[]
}

interface PersistedSkillEntry {
  id: string
  name?: string
  enabled?: boolean
  memories?: PersistedMemoryEntry[]
}

const MEMORY_STORE_DESCRIPTION = [
  'Store a fact, preference, correction, or insight into memory for future reference.',
  'Proactively use this when auto-learning is enabled and the user shares durable preferences, corrections, reusable project knowledge, or skill-specific instructions; the user does not need to say "remember".',
  'Choose scope="session" for current-chat context, "agent" for the current or named agent, "skill" for knowledge tied to a named skill, and "global" for cross-session/cross-agent knowledge.',
].join(' ')

function normalizeMemoryScope(memory: PersistedMemoryEntry, fallbackScope: MemoryScope): MemoryScope {
  if (fallbackScope === 'agent' && memory.scope === 'session') return 'agent'
  return memory.scope || fallbackScope
}

function collectOwnerMemories<T extends { id: string; memories?: PersistedMemoryEntry[] }>(
  owners: T[] | undefined,
  fallbackScope: MemoryScope,
): PersistedMemoryEntry[] {
  return (owners ?? []).flatMap((owner) =>
    (owner.memories ?? []).map((memory) => ({
      ...memory,
      scope: normalizeMemoryScope(memory, fallbackScope),
      targetId: memory.targetId ?? owner.id,
    }))
  )
}

function collectScopedMemories(state: Record<string, unknown>, scope: MemoryScope | 'all'): PersistedMemoryEntry[] {
  const allMemories: PersistedMemoryEntry[] = []

  if (scope === 'session' || scope === 'all') {
    allMemories.push(...collectOwnerMemories(state.sessions as PersistedSessionEntry[] | undefined, 'session'))
  }
  if (scope === 'agent' || scope === 'all') {
    allMemories.push(...collectOwnerMemories(state.agents as PersistedAgentEntry[] | undefined, 'agent'))
  }
  if (scope === 'skill' || scope === 'all') {
    allMemories.push(...collectOwnerMemories(state.skills as PersistedSkillEntry[] | undefined, 'skill'))
  }
  if (scope === 'global' || scope === 'all') {
    const globalMemories = state.globalMemories as PersistedMemoryEntry[] | undefined
    allMemories.push(...(globalMemories ?? []).map((memory) => ({ ...memory, scope: 'global' as const })))
  }

  return allMemories
}

function formatMemoryTag(memory: PersistedMemoryEntry): string {
  return `[${memory.scope}/${memory.type}${memory.targetId ? `:${memory.targetId}` : ''}]`
}

function removeMemoryFromOwners<T extends { memories?: PersistedMemoryEntry[] }>(
  owners: T[],
  memoryId: string,
): { owners: T[]; found: boolean } {
  let found = false
  const nextOwners = owners.map((owner) => {
    if (!owner.memories) return owner
    const memories = owner.memories.filter((memory) => memory.id !== memoryId)
    if (memories.length < owner.memories.length) found = true
    return { ...owner, memories }
  })
  return { owners: nextOwners, found }
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
let _liveStoreAccessor: (() => Record<string, unknown> | null) | null = null
let _liveStoreWriter: ((updater: (state: Record<string, unknown>) => void) => void) | null = null

/**
 * Register a live store state accessor to avoid reading from the file cache.
 * Called once from appStore.ts after the store is created.
 */
export function setLiveStoreAccessor(accessor: () => Record<string, unknown> | null) {
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
  const liveState = readStoreState()
  const liveMarketplace = liveState?.marketplace as { source?: 'official' | 'private'; privateUrl?: string } | undefined
  if (liveMarketplace) {
    return {
      source: liveMarketplace.source ?? 'official',
      privateUrl: liveMarketplace.privateUrl ?? '',
    }
  }

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

function resolveDocumentGroup(
  groups: DocumentGroup[],
  groupIdOrName: string,
): DocumentGroup | null {
  const query = groupIdOrName.trim().toLowerCase()
  return groups.find((group) => group.id === groupIdOrName)
    ?? groups.find((group) => group.name.toLowerCase() === query)
    ?? groups.find((group) => group.name.toLowerCase().includes(query))
    ?? null
}

function resolveDocumentFolder(
  nodes: DocumentNode[],
  folderIdOrTitle: string,
  groupId?: string,
): DocumentFolder | null {
  const query = folderIdOrTitle.trim().toLowerCase()
  const folders = nodes.filter((node): node is DocumentFolder => node.type === 'folder' && (!groupId || node.groupId === groupId))
  return folders.find((folder) => folder.id === folderIdOrTitle)
    ?? folders.find((folder) => folder.title.toLowerCase() === query)
    ?? folders.find((folder) => folder.title.toLowerCase().includes(query))
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
  const liveState = readStoreState()
  if (liveState) {
    return {
      workspacePath: typeof liveState.workspacePath === 'string' ? liveState.workspacePath : '',
      activeSessionId: typeof liveState.activeSessionId === 'string' ? liveState.activeSessionId : '',
    }
  }

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

type BuiltinToolExecute = (args: Record<string, unknown>, options?: unknown) => Promise<unknown> | unknown

async function executeBuiltinTool(toolName: string, args: Record<string, unknown>, options?: unknown): Promise<string> {
  const execute = builtinToolDefs[toolName]?.execute as BuiltinToolExecute | undefined
  if (!execute) return `Error: Tool "${toolName}" is unavailable.`
  const result = await execute(args, options)
  return typeof result === 'string' ? result : JSON.stringify(result)
}

const todoManageInputSchema = z.object({
  action: z.enum(['list', 'add', 'update', 'remove']).describe('Todo action to perform'),
  id: z.string().optional().describe('Required for update/remove: ID of the todo item'),
  title: z.string().optional().describe('Required for add; optional for update: todo title'),
  description: z.string().optional().describe('Optional for add/update: detailed description'),
  status: z.enum(['all', 'pending', 'in-progress', 'done']).optional().describe('For list: filter by status. For update: new status, except "all" is not valid.'),
  priority: z.enum(['low', 'medium', 'high']).optional().describe('Optional for add/update: priority level'),
  dueDate: z.string().optional().describe('Optional for add: due date as ISO string'),
}).superRefine((input, ctx) => {
  if (input.action === 'add' && !input.title?.trim()) {
    ctx.addIssue({ code: 'custom', path: ['title'], message: 'title is required when action is add' })
  }
  if ((input.action === 'update' || input.action === 'remove') && !input.id?.trim()) {
    ctx.addIssue({ code: 'custom', path: ['id'], message: 'id is required when action is update or remove' })
  }
  if (input.action === 'update' && input.status === 'all') {
    ctx.addIssue({ code: 'custom', path: ['status'], message: 'status cannot be all when action is update' })
  }
})

const browserExtractInputSchema = z.object({
  url: z.string().url().describe('The URL to read with the headless browser'),
  mode: z.enum(['text', 'links', 'title', 'location', 'headings']).default('text').describe('What to extract from the page'),
})

const eventTriggerManageInputSchema = z.object({
  action: z.enum(['list', 'create', 'delete']).describe('Event trigger action to perform'),
  id: z.string().optional().describe('Required for delete: trigger ID to delete'),
  name: z.string().optional().describe('Required for create: trigger name'),
  type: z.enum(['file_change', 'clipboard_change', 'schedule', 'app_start']).optional().describe('Required for create: event type'),
  pattern: z.string().optional().describe('Optional for create: glob for file_change, cron for schedule'),
  agent_id: z.string().optional().describe('Required for create: agent ID to handle the event'),
  prompt_template: z.string().optional().describe('Required for create: prompt template with {{file}}, {{content}} placeholders'),
}).superRefine((input, ctx) => {
  if (input.action === 'create') {
    for (const key of ['name', 'type', 'agent_id', 'prompt_template'] as const) {
      if (!input[key]?.trim()) {
        ctx.addIssue({ code: 'custom', path: [key], message: `${key} is required when action is create` })
      }
    }
    if (input.type === 'schedule' && !input.pattern?.trim()) {
      ctx.addIssue({ code: 'custom', path: ['pattern'], message: 'pattern must be a cron expression when type is schedule' })
    }
  }
  if (input.action === 'delete' && !input.id?.trim()) {
    ctx.addIssue({ code: 'custom', path: ['id'], message: 'id is required when action is delete' })
  }
})

const envManageInputSchema = z.object({
  action: z.enum(['get', 'set', 'list', 'delete']).describe('Environment variable action to perform'),
  key: z.string().optional().describe('Required for get/set/delete: variable name'),
  value: z.string().optional().describe('Required for set: variable value'),
  description: z.string().optional().describe('Optional for set: human-readable description'),
  secret: z.boolean().optional().describe('Optional for set: whether this is a secret (masked in UI). Default: true'),
}).superRefine((input, ctx) => {
  if ((input.action === 'get' || input.action === 'set' || input.action === 'delete') && !input.key?.trim()) {
    ctx.addIssue({ code: 'custom', path: ['key'], message: 'key is required when action is get, set, or delete' })
  }
  if (input.action === 'set' && input.value === undefined) {
    ctx.addIssue({ code: 'custom', path: ['value'], message: 'value is required when action is set' })
  }
})

const pipelineToolStepSchema = z.object({
  agent_id: z.string().describe('Agent ID for this pipeline step'),
  task: z.string().describe('Prompt/task for the step'),
  name: z.string().optional().describe('Optional step name'),
  enabled: z.boolean().optional().describe('Whether the step is enabled'),
  continue_on_error: z.boolean().optional().describe('Continue running later steps if this step fails'),
  retry_count: z.number().int().min(0).max(10).optional().describe('How many retries to allow'),
  retry_backoff_ms: z.number().int().min(0).optional().describe('Delay between retries in milliseconds'),
  retry_backoff_strategy: z.enum(['fixed', 'exponential']).optional().describe('Retry spacing strategy'),
  timeout_ms: z.number().int().positive().optional().describe('Step timeout in milliseconds'),
  max_input_chars: z.number().int().positive().optional().describe('Maximum input size'),
  max_output_chars: z.number().int().positive().optional().describe('Maximum output size'),
  output_type: z.enum(['text', 'json', 'file', 'table']).optional().describe('Expected output type'),
  model_id: z.string().optional().describe('Optional model override for the step'),
  output_transform: z.enum(['trim', 'first-line', 'last-line', 'json-path']).optional().describe('Optional output transform'),
  output_transform_path: z.string().optional().describe('Path used when output_transform is json-path'),
  export_var: z.string().optional().describe('Pipeline variable name to store the step output into'),
  run_if: z.string().optional().describe('Optional conditional expression for whether the step runs'),
})

const pipelineToolVariableSchema = z.object({
  name: z.string().describe('Variable name'),
  label: z.string().optional().describe('Optional human-friendly label'),
  description: z.string().optional().describe('Optional description'),
  default_value: z.string().optional().describe('Optional default value'),
  required: z.boolean().optional().describe('Whether the variable must be supplied'),
})

const pipelineToolBudgetSchema = z.object({
  max_total_duration_ms: z.number().int().min(0).optional().describe('Whole-pipeline duration budget in milliseconds'),
  max_total_tokens: z.number().int().min(0).optional().describe('Whole-pipeline token budget'),
  max_step_count: z.number().int().min(0).optional().describe('Maximum number of enabled steps that may execute'),
})

type PipelineToolStepInput = z.infer<typeof pipelineToolStepSchema>
type PipelineToolVariableInput = z.infer<typeof pipelineToolVariableSchema>
type PipelineToolBudgetInput = z.infer<typeof pipelineToolBudgetSchema>

function parseStructuredToolInput(value: unknown): unknown {
  if (typeof value !== 'string') return value

  const trimmed = value.trim()
  if (!trimmed) return value

  if (trimmed !== 'null' && !trimmed.startsWith('[') && !trimmed.startsWith('{')) {
    return value
  }

  try {
    return JSON.parse(trimmed)
  } catch {
    return value
  }
}

function allowJsonStringInput<TSchema extends z.ZodTypeAny>(schema: TSchema) {
  return z.preprocess(parseStructuredToolInput, schema)
}

function sanitizeOptionalText(value?: string | null): string | undefined {
  if (value === undefined || value === null) return undefined
  const trimmed = value.trim()
  return trimmed || undefined
}

function mapPipelineToolStep(step: PipelineToolStepInput): AgentPipelineStep {
  return {
    agentId: step.agent_id.trim(),
    task: step.task,
    ...(sanitizeOptionalText(step.name) ? { name: sanitizeOptionalText(step.name) } : {}),
    ...(step.enabled !== undefined ? { enabled: step.enabled } : {}),
    ...(step.continue_on_error !== undefined ? { continueOnError: step.continue_on_error } : {}),
    ...(step.retry_count !== undefined ? { retryCount: step.retry_count } : {}),
    ...(step.retry_backoff_ms !== undefined ? { retryBackoffMs: step.retry_backoff_ms } : {}),
    ...(step.retry_backoff_strategy !== undefined ? { retryBackoffStrategy: step.retry_backoff_strategy } : {}),
    ...(step.timeout_ms !== undefined ? { timeoutMs: step.timeout_ms } : {}),
    ...(step.max_input_chars !== undefined ? { maxInputChars: step.max_input_chars } : {}),
    ...(step.max_output_chars !== undefined ? { maxOutputChars: step.max_output_chars } : {}),
    ...(step.output_type !== undefined ? { outputType: step.output_type } : {}),
    ...(sanitizeOptionalText(step.model_id) ? { modelId: sanitizeOptionalText(step.model_id) } : {}),
    ...(step.output_transform !== undefined ? { outputTransform: step.output_transform } : {}),
    ...(sanitizeOptionalText(step.output_transform_path) ? { outputTransformPath: sanitizeOptionalText(step.output_transform_path) } : {}),
    ...(sanitizeOptionalText(step.export_var) ? { exportVar: sanitizeOptionalText(step.export_var) } : {}),
    ...(sanitizeOptionalText(step.run_if) ? { runIf: sanitizeOptionalText(step.run_if) } : {}),
  }
}

function mapPipelineToolVariable(variable: PipelineToolVariableInput): AgentPipelineVariable {
  return {
    name: variable.name.trim(),
    ...(sanitizeOptionalText(variable.label) ? { label: sanitizeOptionalText(variable.label) } : {}),
    ...(sanitizeOptionalText(variable.description) ? { description: sanitizeOptionalText(variable.description) } : {}),
    ...(variable.default_value !== undefined ? { defaultValue: variable.default_value } : {}),
    ...(variable.required !== undefined ? { required: variable.required } : {}),
  }
}

function mapPipelineToolBudget(budget?: PipelineToolBudgetInput | null): AgentPipelineBudget | undefined {
  if (!budget) return undefined

  const nextBudget: AgentPipelineBudget = {
    ...(budget.max_total_duration_ms !== undefined ? { maxTotalDurationMs: budget.max_total_duration_ms } : {}),
    ...(budget.max_total_tokens !== undefined ? { maxTotalTokens: budget.max_total_tokens } : {}),
    ...(budget.max_step_count !== undefined ? { maxStepCount: budget.max_step_count } : {}),
  }

  return Object.keys(nextBudget).length > 0 ? nextBudget : undefined
}

function getPipelineToolContext(): { workspacePath: string; state: Record<string, unknown>; agents: Agent[]; models: Model[] } | { error: string } {
  const { workspacePath } = getPersistedStoreState()
  if (!workspacePath) return { error: 'Workspace path not set' }

  const state = readStoreState()
  if (!state) return { error: 'Store not available' }

  return {
    workspacePath,
    state,
    agents: Array.isArray(state.agents) ? state.agents as Agent[] : [],
    models: Array.isArray(state.models) ? state.models as Model[] : [],
  }
}

async function getAvailablePipelinesForTools(workspacePath: string, state: Record<string, unknown>): Promise<AgentPipeline[]> {
  const persisted = await loadPipelinesFromDisk(workspacePath)
  if (persisted.length > 0) return persisted
  return Array.isArray(state.agentPipelines) ? state.agentPipelines as AgentPipeline[] : []
}

function resolvePipelineReference(
  pipelines: AgentPipeline[],
  pipelineId?: string,
  pipelineName?: string,
): { pipeline?: AgentPipeline; error?: string } {
  const trimmedId = pipelineId?.trim()
  const trimmedName = pipelineName?.trim()

  if (trimmedId) {
    const byId = pipelines.find((pipeline) => pipeline.id === trimmedId)
    if (byId) return { pipeline: byId }
    return { error: `Pipeline not found: ${trimmedId}` }
  }

  if (!trimmedName) {
    return { error: 'Provide pipeline_id or pipeline_name.' }
  }

  const lowerName = trimmedName.toLowerCase()
  const exactMatches = pipelines.filter((pipeline) => pipeline.name.toLowerCase() === lowerName)
  if (exactMatches.length === 1) return { pipeline: exactMatches[0] }
  if (exactMatches.length > 1) {
    return { error: `Multiple pipelines match the name "${trimmedName}". Use pipeline_id instead.` }
  }

  const partialMatches = pipelines.filter((pipeline) => pipeline.name.toLowerCase().includes(lowerName))
  if (partialMatches.length === 1) return { pipeline: partialMatches[0] }
  if (partialMatches.length > 1) {
    return { error: `Multiple pipelines partially match "${trimmedName}". Use pipeline_id instead.` }
  }

  return { error: `Pipeline not found: ${trimmedName}` }
}

function formatPipelineIssues(pipeline: Pick<AgentPipeline, 'name' | 'steps' | 'variables' | 'budget'>, agents: Agent[], models: Model[]): string | null {
  const validation = validateAgentPipeline(pipeline, agents, models)
  if (validation.valid) return null

  return validation.errors
    .map((issue) => `${issue.stepIndex !== undefined ? `Step ${issue.stepIndex + 1}: ` : ''}${issue.message}`)
    .join('\n')
}

function summarizePipelineForTool(pipeline: AgentPipeline) {
  return {
    id: pipeline.id,
    name: pipeline.name,
    description: pipeline.description ?? null,
    createdAt: pipeline.createdAt,
    updatedAt: pipeline.updatedAt,
    lastRunAt: pipeline.lastRunAt ?? null,
    variables: (pipeline.variables ?? []).map((variable) => ({
      name: variable.name,
      label: variable.label ?? null,
      description: variable.description ?? null,
      defaultValue: variable.defaultValue ?? null,
      required: variable.required ?? false,
    })),
    budget: pipeline.budget ?? null,
    steps: pipeline.steps.map((step, index) => ({
      index: index + 1,
      name: step.name ?? null,
      agentId: step.agentId,
      task: step.task,
      enabled: step.enabled !== false,
      continueOnError: step.continueOnError ?? false,
      retryCount: step.retryCount ?? 0,
      timeoutMs: step.timeoutMs ?? null,
      modelId: step.modelId ?? null,
      runIf: step.runIf ?? null,
      exportVar: step.exportVar ?? null,
    })),
  }
}

function syncPipelinesIntoStore(nextPipelines: AgentPipeline[], selectedPipelineId?: string | null): boolean {
  return writeStoreState((state) => {
    state.agentPipelines = nextPipelines
    if (selectedPipelineId !== undefined) {
      state.selectedAgentPipelineId = selectedPipelineId
    }
  })
}

const agentToolResponseStyleSchema = z.enum(['concise', 'detailed', 'balanced'])
const agentToolPermissionModeSchema = z.enum(['default', 'acceptEdits', 'plan', 'bypassPermissions'])

const agentToolMutationSchema = {
  avatar: z.string().nullable().optional().describe('Optional avatar/icon id; null clears it'),
  color: z.string().nullable().optional().describe('Optional hex color; null clears it'),
  model_id: z.string().nullable().optional().describe('Optional model id; null clears it back to the default model fallback'),
  skills: allowJsonStringInput(z.array(z.string()).nullable()).optional().describe('Assigned skill ids; pass [] to clear or null to remove all skills'),
  temperature: z.number().min(0).max(2).optional().describe('Sampling temperature between 0 and 2'),
  max_tokens: z.number().int().positive().optional().describe('Maximum output tokens'),
  max_turns: z.number().int().min(2).nullable().optional().describe('Maximum agentic turns; null clears the override'),
  enabled: z.boolean().optional().describe('Whether the agent is enabled'),
  greeting: z.string().nullable().optional().describe('Optional greeting shown when starting a chat; null clears it'),
  response_style: agentToolResponseStyleSchema.nullable().optional().describe('Response style; null clears the override'),
  when_to_use: z.string().nullable().optional().describe('Optional hint for when this agent should be selected; null clears it'),
  allowed_tools: allowJsonStringInput(z.array(z.string()).nullable()).optional().describe('Allowlist of tool names; [] or null removes the allowlist restriction'),
  disallowed_tools: allowJsonStringInput(z.array(z.string()).nullable()).optional().describe('Denylist of tool names; [] or null clears the denylist'),
  permission_mode: agentToolPermissionModeSchema.nullable().optional().describe('Permission mode override; null clears it'),
  auto_learn: z.boolean().optional().describe('Whether the agent may store durable memories automatically'),
}

type AgentToolResponseStyleInput = z.infer<typeof agentToolResponseStyleSchema>
type AgentToolPermissionModeInput = z.infer<typeof agentToolPermissionModeSchema>
type AgentToolMutationInput = {
  name?: string
  avatar?: string | null
  color?: string | null
  system_prompt?: string
  model_id?: string | null
  skills?: string[] | null
  temperature?: number
  max_tokens?: number
  max_turns?: number | null
  enabled?: boolean
  greeting?: string | null
  response_style?: AgentToolResponseStyleInput | null
  when_to_use?: string | null
  allowed_tools?: string[] | null
  disallowed_tools?: string[] | null
  permission_mode?: AgentToolPermissionModeInput | null
  auto_learn?: boolean
}

function sanitizeStringList(values?: string[] | string | null): string[] | undefined {
  if (values === undefined || values === null) return undefined

  const normalized = parseStructuredToolInput(values)
  if (!Array.isArray(normalized)) return undefined

  const nextValues = Array.from(new Set(
    normalized
      .map((value) => value.trim())
      .filter(Boolean),
  ))

  return nextValues.length > 0 ? nextValues : []
}

function summarizeAgentForTool(agent: Agent) {
  return {
    id: agent.id,
    name: agent.name,
    avatar: agent.avatar ?? null,
    color: agent.color ?? null,
    systemPrompt: agent.systemPrompt,
    modelId: agent.modelId || null,
    skills: [...agent.skills],
    temperature: agent.temperature ?? null,
    maxTokens: agent.maxTokens ?? null,
    maxTurns: agent.maxTurns ?? null,
    enabled: agent.enabled !== false,
    greeting: agent.greeting ?? null,
    responseStyle: agent.responseStyle ?? null,
    whenToUse: agent.whenToUse ?? null,
    allowedTools: [...(agent.allowedTools ?? [])],
    disallowedTools: [...(agent.disallowedTools ?? [])],
    permissionMode: agent.permissionMode ?? null,
    autoLearn: agent.autoLearn,
    memoryCount: agent.memories?.length ?? 0,
  }
}

function resolveAgentReference(
  agents: Agent[],
  agentId?: string,
  agentName?: string,
): { agent?: Agent; error?: string } {
  const trimmedId = agentId?.trim()
  const trimmedName = agentName?.trim()

  if (trimmedId) {
    const byId = agents.find((agent) => agent.id === trimmedId)
    if (byId) return { agent: byId }
    return { error: `Agent not found: ${trimmedId}` }
  }

  if (!trimmedName) {
    return { error: 'Provide agent_id or agent_name.' }
  }

  const lowered = trimmedName.toLowerCase()
  const exactMatches = agents.filter((agent) => agent.name.toLowerCase() === lowered)
  if (exactMatches.length === 1) return { agent: exactMatches[0] }
  if (exactMatches.length > 1) {
    return { error: `Multiple agents match the name "${trimmedName}". Use agent_id instead.` }
  }

  const partialMatches = agents.filter((agent) => agent.name.toLowerCase().includes(lowered))
  if (partialMatches.length === 1) return { agent: partialMatches[0] }
  if (partialMatches.length > 1) {
    return { error: `Multiple agents partially match "${trimmedName}". Use agent_id instead.` }
  }

  return { error: `Agent not found: ${trimmedName}` }
}

function snapshotAgentVersion(agent: Agent): Omit<Agent, 'memories'> {
  const { memories: _memories, ...snapshot } = agent
  return snapshot
}

function appendAgentVersionToStore(state: Record<string, unknown>, agent: Agent, source: 'manual' | 'import' | 'marketplace' | 'migration' | 'rollback' = 'manual') {
  const existingVersions = Array.isArray(state.agentVersions) ? state.agentVersions as Array<{ agentId?: string }> : []
  const nextVersion = {
    id: `aver-${crypto.randomUUID()}`,
    agentId: agent.id,
    version: existingVersions.filter((item) => item.agentId === agent.id).length + 1,
    snapshot: snapshotAgentVersion(agent),
    createdAt: Date.now(),
    source,
  }
  state.agentVersions = [...existingVersions, nextVersion].slice(-200)
}

function validateAgentForTool(agent: Agent, models: Model[], skills: Skill[]): string | null {
  const issues: string[] = []

  if (!agent.name.trim()) issues.push('Agent name cannot be empty.')
  if (agent.modelId && !models.some((model) => model.id === agent.modelId)) {
    issues.push(`Selected model does not exist: ${agent.modelId}`)
  }

  const missingSkillIds = agent.skills.filter((skillId) => !skills.some((skill) => skill.id === skillId))
  if (missingSkillIds.length > 0) {
    issues.push(`Assigned skill ids are missing: ${missingSkillIds.join(', ')}`)
  }

  const conflictingTools = (agent.allowedTools ?? []).filter((toolName) => agent.disallowedTools?.includes(toolName))
  if (conflictingTools.length > 0) {
    issues.push(`Tool is both allowed and disallowed: ${conflictingTools.join(', ')}`)
  }

  return issues.length > 0 ? issues.join('\n') : null
}

function buildAgentFromToolInput(input: Required<Pick<AgentToolMutationInput, 'name' | 'system_prompt'>> & AgentToolMutationInput): Agent {
  const trimmedName = input.name.trim()
  const skills = sanitizeStringList(input.skills) ?? []
  const allowedTools = sanitizeStringList(input.allowed_tools) ?? []
  const disallowedTools = sanitizeStringList(input.disallowed_tools) ?? []
  const nextGreeting = sanitizeOptionalText(input.greeting)
  const nextWhenToUse = sanitizeOptionalText(input.when_to_use)
  const nextModelId = sanitizeOptionalText(input.model_id) ?? ''
  const nextAvatar = sanitizeOptionalText(input.avatar)
  const nextColor = sanitizeOptionalText(input.color)

  return {
    id: `agent-${crypto.randomUUID()}`,
    name: trimmedName,
    ...(nextAvatar ? { avatar: nextAvatar } : {}),
    ...(nextColor ? { color: nextColor } : {}),
    systemPrompt: input.system_prompt,
    modelId: nextModelId,
    skills,
    temperature: input.temperature ?? 0.7,
    maxTokens: input.max_tokens ?? 4096,
    ...(input.max_turns !== undefined && input.max_turns !== null ? { maxTurns: input.max_turns } : {}),
    enabled: input.enabled ?? true,
    ...(nextGreeting ? { greeting: nextGreeting } : {}),
    ...(input.response_style ? { responseStyle: input.response_style } : { responseStyle: 'balanced' }),
    ...(nextWhenToUse ? { whenToUse: nextWhenToUse } : {}),
    allowedTools,
    disallowedTools,
    ...(input.permission_mode ? { permissionMode: input.permission_mode } : {}),
    memories: [],
    autoLearn: input.auto_learn ?? false,
  }
}

function applyAgentToolPatch(agent: Agent, patch: AgentToolMutationInput): Agent {
  const nextAllowedTools = patch.allowed_tools === undefined
    ? agent.allowedTools ?? []
    : sanitizeStringList(patch.allowed_tools) ?? []
  const nextDisallowedTools = patch.disallowed_tools === undefined
    ? agent.disallowedTools ?? []
    : sanitizeStringList(patch.disallowed_tools) ?? []
  const nextSkills = patch.skills === undefined
    ? agent.skills
    : sanitizeStringList(patch.skills) ?? []
  const nextName = patch.name !== undefined ? patch.name.trim() : agent.name

  return {
    ...agent,
    name: nextName,
    ...(patch.avatar !== undefined ? { avatar: sanitizeOptionalText(patch.avatar) } : {}),
    ...(patch.color !== undefined ? { color: sanitizeOptionalText(patch.color) } : {}),
    ...(patch.system_prompt !== undefined ? { systemPrompt: patch.system_prompt } : {}),
    ...(patch.model_id !== undefined ? { modelId: sanitizeOptionalText(patch.model_id) ?? '' } : {}),
    skills: nextSkills,
    ...(patch.temperature !== undefined ? { temperature: patch.temperature } : {}),
    ...(patch.max_tokens !== undefined ? { maxTokens: patch.max_tokens } : {}),
    ...(patch.max_turns !== undefined
      ? (patch.max_turns === null ? { maxTurns: undefined } : { maxTurns: patch.max_turns })
      : {}),
    ...(patch.enabled !== undefined ? { enabled: patch.enabled } : {}),
    ...(patch.greeting !== undefined ? { greeting: sanitizeOptionalText(patch.greeting) } : {}),
    ...(patch.response_style !== undefined
      ? (patch.response_style === null ? { responseStyle: undefined } : { responseStyle: patch.response_style })
      : {}),
    ...(patch.when_to_use !== undefined ? { whenToUse: sanitizeOptionalText(patch.when_to_use) } : {}),
    allowedTools: nextAllowedTools,
    disallowedTools: nextDisallowedTools,
    ...(patch.permission_mode !== undefined
      ? (patch.permission_mode === null ? { permissionMode: undefined } : { permissionMode: patch.permission_mode })
      : {}),
    ...(patch.auto_learn !== undefined ? { autoLearn: patch.auto_learn } : {}),
  }
}

function getAgentToolContext(): { state: Record<string, unknown>; agents: Agent[]; models: Model[]; skills: Skill[] } | { error: string } {
  const state = readStoreState()
  if (!state) return { error: 'Store not available' }

  return {
    state,
    agents: Array.isArray(state.agents) ? state.agents as Agent[] : [],
    models: Array.isArray(state.models) ? state.models as Model[] : [],
    skills: Array.isArray(state.skills) ? state.skills as Skill[] : [],
  }
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
    description: 'Write text content to a file. Creates the file if it does not exist, overwrites if it does, and creates missing parent directories. For long files, write the first chunk with write_file, then continue with append_file instead of sending the entire body in one call.',
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

  append_file: tool({
    description: 'Append text content to the end of a file. Creates the file if it does not exist and also creates missing parent directories. Use this for chunked writes when a full file would be too large for one write_file call.',
    inputSchema: z.object({
      path: z.string().describe('Absolute path of the file to append to'),
      content: z.string().describe('Text content to append'),
    }),
    execute: async ({ path, content }) => {
      const blocked = ensureAllowedPath(path)
      if (blocked) return blocked
      if (!(await confirmIfNeeded(`append_file\n${path}`))) return 'Cancelled by user confirmation policy.'
      const result = await electronInvoke('fs:appendFile', path, content)
      if (typeof result === 'object' && result && 'error' in result) {
        return `Error: ${(result as { error: string }).error}`
      }
      return `Successfully appended ${content.length} characters to ${path}`
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
    description: 'Search the public web using DuckDuckGo for external, current, or public internet information. Do not use this for facts likely stored in the user\'s Suora documents, workspace files, or notes until you have checked those local sources. Returns an instant answer (if any) plus up to 8 search results with titles, URLs, and snippets. Use fetch_webpage to read the full content of a specific result.',
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

  browser_extract: tool({
    description: 'Extract readable information from a JavaScript-rendered web page. Replaces browser_extract_text, browser_extract_links, and simple browser_evaluate read modes.',
    inputSchema: browserExtractInputSchema,
    execute: async ({ url, mode }, options) => {
      if (mode === 'text') return executeBuiltinTool('browser_extract_text', { url }, options)
      if (mode === 'links') return executeBuiltinTool('browser_extract_links', { url }, options)
      return executeBuiltinTool('browser_evaluate', { url, expression: mode }, options)
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

  todo_manage: tool({
    description: 'Manage todo items for the current chat session with one action field: list, add, update, or remove. Prefer this over the legacy todo_* tools.',
    inputSchema: todoManageInputSchema,
    execute: async (input, options) => {
      switch (input.action) {
        case 'list':
          return executeBuiltinTool('todo_list', { status: input.status ?? 'all' }, options)
        case 'add':
          return executeBuiltinTool('todo_add', {
            title: input.title,
            description: input.description ?? '',
            priority: input.priority ?? 'medium',
            dueDate: input.dueDate,
          }, options)
        case 'update':
          return executeBuiltinTool('todo_update', {
            id: input.id,
            title: input.title,
            description: input.description,
            status: input.status,
            priority: input.priority,
          }, options)
        case 'remove':
          return executeBuiltinTool('todo_remove', { id: input.id }, options)
      }
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
    description: 'Create a new timer/scheduled task. Use type "once" with an ISO date string for a one-time reminder. Use type "interval" with a number (minutes) for recurring tasks. Use type "cron" with a cron expression for calendar-style schedules. Actions can notify, enqueue an agent prompt, or run a saved pipeline.',
    inputSchema: z.object({
      name: z.string().describe('Name/title of the timer'),
      type: z.enum(['once', 'interval', 'cron']).describe('"once" for a one-time timer, "interval" for repeating every N minutes, "cron" for a cron-expression schedule'),
      schedule: z.string().describe('For "once": ISO date string (e.g. "2025-03-26T14:30:00"). For "interval": number of minutes between repeats (e.g. "30" for every 30 minutes). For "cron": cron expression (e.g. "0 9 * * 1-5").'),
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
      type: z.enum(['once', 'interval', 'cron']).optional().describe('New type: "once", "interval", or "cron"'),
      schedule: z.string().optional().describe('New schedule value. For "once": ISO date string. For "interval": minutes. For "cron": cron expression.'),
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

  pipeline_list: tool({
    description: 'List saved pipelines available in the current workspace. Use this before updating or deleting a pipeline when you need the exact id or want to inspect the current saved steps.',
    inputSchema: z.object({
      query: z.string().optional().describe('Optional case-insensitive filter applied to pipeline id, name, and description'),
      include_steps: z.boolean().optional().default(true).describe('Whether to include step details in the output'),
    }),
    execute: async ({ query, include_steps }) => {
      const context = getPipelineToolContext()
      if ('error' in context) return `Error: ${context.error}`

      const pipelines = await getAvailablePipelinesForTools(context.workspacePath, context.state)
      const keyword = query?.trim().toLowerCase()
      const filtered = keyword
        ? pipelines.filter((pipeline) => {
          const haystack = [pipeline.id, pipeline.name, pipeline.description ?? ''].join(' ').toLowerCase()
          return haystack.includes(keyword)
        })
        : pipelines

      if (filtered.length === 0) {
        return keyword ? `No pipelines found matching "${query}".` : 'No saved pipelines found.'
      }

      const payload = filtered.map((pipeline) => {
        const summary = summarizePipelineForTool(pipeline)
        if (!include_steps) {
          return {
            id: summary.id,
            name: summary.name,
            description: summary.description,
            createdAt: summary.createdAt,
            updatedAt: summary.updatedAt,
            lastRunAt: summary.lastRunAt,
            variableCount: summary.variables.length,
            stepCount: summary.steps.length,
          }
        }
        return summary
      })

      return JSON.stringify(payload, null, 2)
    },
  }),

  pipeline_add: tool({
    description: 'Create a new saved pipeline in the current workspace. Provide the full step list you want saved. The tool validates the pipeline against available agents and models before saving.',
    inputSchema: z.object({
      name: z.string().describe('Pipeline name'),
      description: z.string().optional().describe('Optional pipeline description'),
      steps: allowJsonStringInput(z.array(pipelineToolStepSchema).min(1)).describe('Complete ordered list of pipeline steps'),
      variables: allowJsonStringInput(z.array(pipelineToolVariableSchema)).optional().describe('Optional declared pipeline variables'),
      budget: allowJsonStringInput(pipelineToolBudgetSchema).optional().describe('Optional whole-pipeline budget caps'),
    }),
    execute: async ({ name, description, steps, variables, budget }) => {
      const context = getPipelineToolContext()
      if ('error' in context) return `Error: ${context.error}`

      const trimmedName = name.trim()
      if (!trimmedName) return 'Error: Pipeline name cannot be empty.'

      const mappedSteps = steps.map(mapPipelineToolStep)
      const mappedVariables = variables?.map(mapPipelineToolVariable)
      const mappedBudget = mapPipelineToolBudget(budget)
      const now = Date.now()
      const nextPipeline: AgentPipeline = {
        id: `pipeline-${crypto.randomUUID()}`,
        name: trimmedName,
        ...(sanitizeOptionalText(description) ? { description: sanitizeOptionalText(description) } : {}),
        steps: mappedSteps,
        ...(mappedVariables && mappedVariables.length > 0 ? { variables: mappedVariables } : {}),
        ...(mappedBudget ? { budget: mappedBudget } : {}),
        createdAt: now,
        updatedAt: now,
      }

      const validationError = formatPipelineIssues(nextPipeline, context.agents, context.models)
      if (validationError) {
        return `Error: Pipeline validation failed.\n${validationError}`
      }

      const saved = await savePipelineToDisk(context.workspacePath, nextPipeline)
      if (!saved) return 'Error: Failed to save pipeline to disk.'

      const currentPipelines = await getAvailablePipelinesForTools(context.workspacePath, context.state)
      const nextPipelines = [nextPipeline, ...currentPipelines.filter((pipeline) => pipeline.id !== nextPipeline.id)]
      const synced = syncPipelinesIntoStore(nextPipelines, nextPipeline.id)

      return JSON.stringify({
        message: `Created pipeline "${nextPipeline.name}".`,
        pipeline: summarizePipelineForTool(nextPipeline),
        storeSynced: synced,
      }, null, 2)
    },
  }),

  pipeline_update: tool({
    description: 'Update an existing saved pipeline. Prefer pipeline_id when available. Any provided steps replace the full saved step list. Set description to an empty string or null to clear it. Set variables or budget to null to remove them.',
    inputSchema: z.object({
      pipeline_id: z.string().optional().describe('Exact pipeline id to update'),
      pipeline_name: z.string().optional().describe('Exact or partial pipeline name when id is unknown'),
      name: z.string().optional().describe('New pipeline name'),
      description: z.string().nullable().optional().describe('New description; null or empty clears it'),
      steps: allowJsonStringInput(z.array(pipelineToolStepSchema).min(1)).optional().describe('Complete replacement step list'),
      variables: allowJsonStringInput(z.array(pipelineToolVariableSchema).nullable()).optional().describe('Replacement variable list; null clears variables'),
      budget: allowJsonStringInput(pipelineToolBudgetSchema.nullable()).optional().describe('Replacement budget; null clears budget'),
    }),
    execute: async ({ pipeline_id, pipeline_name, name, description, steps, variables, budget }) => {
      const context = getPipelineToolContext()
      if ('error' in context) return `Error: ${context.error}`

      const pipelines = await getAvailablePipelinesForTools(context.workspacePath, context.state)
      const resolved = resolvePipelineReference(pipelines, pipeline_id, pipeline_name)
      if (!resolved.pipeline) return `Error: ${resolved.error}`

      if (name === undefined && description === undefined && steps === undefined && variables === undefined && budget === undefined) {
        return 'Error: No updates were provided.'
      }

      const nextName = name !== undefined ? name.trim() : resolved.pipeline.name
      if (!nextName) return 'Error: Pipeline name cannot be empty.'

      const nextDescription = description === undefined ? resolved.pipeline.description : sanitizeOptionalText(description)
      const nextSteps = steps ? steps.map(mapPipelineToolStep) : resolved.pipeline.steps
      const nextVariables = variables === undefined
        ? resolved.pipeline.variables
        : variables === null
          ? undefined
          : variables.map(mapPipelineToolVariable)
      const nextBudget = budget === undefined ? resolved.pipeline.budget : mapPipelineToolBudget(budget)

      const updatedPipeline: AgentPipeline = {
        ...resolved.pipeline,
        name: nextName,
        ...(nextDescription ? { description: nextDescription } : {}),
        ...(!nextDescription ? { description: undefined } : {}),
        steps: nextSteps,
        ...(nextVariables && nextVariables.length > 0 ? { variables: nextVariables } : { variables: undefined }),
        ...(nextBudget ? { budget: nextBudget } : { budget: undefined }),
        updatedAt: Date.now(),
      }

      const validationError = formatPipelineIssues(updatedPipeline, context.agents, context.models)
      if (validationError) {
        return `Error: Pipeline validation failed.\n${validationError}`
      }

      const saved = await savePipelineToDisk(context.workspacePath, updatedPipeline)
      if (!saved) return `Error: Failed to save pipeline "${resolved.pipeline.name}".`

      const nextPipelines = [updatedPipeline, ...pipelines.filter((pipeline) => pipeline.id !== updatedPipeline.id)]
      const synced = syncPipelinesIntoStore(nextPipelines, updatedPipeline.id)

      return JSON.stringify({
        message: `Updated pipeline "${updatedPipeline.name}".`,
        pipeline: summarizePipelineForTool(updatedPipeline),
        storeSynced: synced,
      }, null, 2)
    },
  }),

  pipeline_remove: tool({
    description: 'Delete a saved pipeline from the current workspace. Prefer pipeline_id when available.',
    inputSchema: z.object({
      pipeline_id: z.string().optional().describe('Exact pipeline id to remove'),
      pipeline_name: z.string().optional().describe('Exact or partial pipeline name when id is unknown'),
    }),
    execute: async ({ pipeline_id, pipeline_name }) => {
      const context = getPipelineToolContext()
      if ('error' in context) return `Error: ${context.error}`

      const pipelines = await getAvailablePipelinesForTools(context.workspacePath, context.state)
      const resolved = resolvePipelineReference(pipelines, pipeline_id, pipeline_name)
      if (!resolved.pipeline) return `Error: ${resolved.error}`

      const deleted = await deletePipelineFromDisk(context.workspacePath, resolved.pipeline.id)
      if (!deleted) return `Error: Failed to delete pipeline "${resolved.pipeline.name}".`

      const nextPipelines = pipelines.filter((pipeline) => pipeline.id !== resolved.pipeline?.id)
      const currentSelectedId = typeof context.state.selectedAgentPipelineId === 'string' ? context.state.selectedAgentPipelineId : null
      const nextSelectedId = currentSelectedId === resolved.pipeline.id ? null : currentSelectedId
      const synced = syncPipelinesIntoStore(nextPipelines, nextSelectedId)

      return JSON.stringify({
        message: `Removed pipeline "${resolved.pipeline.name}".`,
        pipelineId: resolved.pipeline.id,
        storeSynced: synced,
      }, null, 2)
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

  // ─── Memory management tools ────────────────────────────────────────

  memory_store: tool({
    description: MEMORY_STORE_DESCRIPTION,
    inputSchema: z.object({
      content: z.string().describe('The concise fact or insight to remember'),
      type: z.enum(['insight', 'preference', 'correction', 'knowledge']).describe('Category of the memory'),
      scope: z.enum(['session', 'agent', 'skill', 'global']).default('session').describe('Memory scope: "session" for current conversation, "agent" for a specific agent, "skill" for a specific skill, "global" for cross-session persistent memory'),
      target_id: z.string().optional().describe('Optional target session, agent, or skill ID. Defaults to the active session/agent when applicable.'),
      target_name: z.string().optional().describe('Optional target agent or skill name when target_id is unknown.'),
    }),
    execute: async ({ content, type, scope, target_id, target_name }) => {
      try {
        const state = readStoreState()
        if (!state) return 'Error: Store not available'

        const activeSessionId = typeof state.activeSessionId === 'string' ? state.activeSessionId : undefined
        const sessions = Array.isArray(state.sessions) ? state.sessions as PersistedSessionEntry[] : []
        const agents = Array.isArray(state.agents) ? state.agents as PersistedAgentEntry[] : []
        const skills = Array.isArray(state.skills) ? state.skills as PersistedSkillEntry[] : []
        const activeSession = activeSessionId ? sessions.find((session) => session.id === activeSessionId) : undefined
        const selectedAgentId = (state.selectedAgent as { id?: string } | undefined)?.id
        const activeAgentId = (activeSession as { agentId?: string } | undefined)?.agentId || selectedAgentId || 'default-assistant'

        const targetId = (() => {
          if (scope === 'global') return undefined
          if (target_id?.trim()) return target_id.trim()
          if (scope === 'session') return activeSessionId
          if (scope === 'agent') {
            const query = target_name?.trim().toLowerCase()
            if (query) return agents.find((agent) => agent.name?.toLowerCase() === query || agent.name?.toLowerCase().includes(query))?.id
            return activeAgentId
          }
          if (scope === 'skill') {
            const query = target_name?.trim().toLowerCase()
            if (query) return skills.find((skill) => skill.name?.toLowerCase() === query || skill.name?.toLowerCase().includes(query))?.id
          }
          return undefined
        })()

        if (scope !== 'global' && !targetId) {
          return `Error: No target ${scope} available — provide target_id${scope === 'skill' ? ' or target_name' : ''}`
        }

        const memory: PersistedMemoryEntry = {
          id: `memory-${crypto.randomUUID()}`,
          content,
          type,
          scope,
          createdAt: Date.now(),
          source: activeSessionId || 'unknown',
          ...(targetId ? { targetId } : {}),
        }

        const wrote = writeStoreState((s) => {
          if (scope === 'global') {
            s.globalMemories = [...((s.globalMemories ?? []) as PersistedMemoryEntry[]), memory]
            return
          }

          if (scope === 'session') {
            const existingSessions = (s.sessions ?? []) as PersistedSessionEntry[]
            s.sessions = existingSessions.map((session) => session.id === targetId
              ? { ...session, memories: [...(session.memories ?? []), memory] }
              : session)
            return
          }

          if (scope === 'skill') {
            const existingSkills = (s.skills ?? []) as PersistedSkillEntry[]
            s.skills = existingSkills.map((skill) => skill.id === targetId
              ? { ...skill, memories: [...(skill.memories ?? []), memory] }
              : skill)
            return
          }

          const existingAgents = (s.agents ?? []) as PersistedAgentEntry[]
          s.agents = existingAgents.map((agent) => agent.id === targetId
            ? { ...agent, memories: [...(agent.memories ?? []), memory] }
            : agent)
        })

        if (!wrote) return 'Error: Failed to write memory'
        addToIndex(getIndex(), { id: memory.id, content: memory.content })
        const preview = content.length > PREVIEW_LENGTH ? `${content.slice(0, PREVIEW_LENGTH)}...` : content
        return `Stored ${scope} ${type} memory${targetId ? ` for ${targetId}` : ''}: ${preview}`
      } catch (err) {
        return `Error storing memory: ${err instanceof Error ? err.message : String(err)}`
      }
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

  memory_search: tool({
    description: 'Search memories for relevant information across session, agent, skill, and global scopes. Supports semantic search via TF-IDF similarity.',
    inputSchema: z.object({
      query: z.string().describe('Search query to match against memory content'),
      type: z.enum(['insight', 'preference', 'correction', 'knowledge', 'all']).optional().describe('Filter by memory type (default: all)'),
      scope: z.enum(['session', 'agent', 'skill', 'global', 'all']).default('all').describe('Which memory scope to search'),
      semantic: z.boolean().default(true).describe('Use semantic (TF-IDF) search when true, substring matching when false'),
    }),
    execute: async ({ query, type, scope, semantic }) => {
      try {
        const state = readStoreState()
        if (!state) return 'Error: Store not available'

        let allMemories = collectScopedMemories(state, scope)

        if (!allMemories.length) return 'No memories found.'

        if (type && type !== 'all') {
          allMemories = allMemories.filter(m => m.type === type)
        }

        if (semantic) {
          let index = getIndex()
          if (index.size === 0) {
            index = rebuildIndexFromStore()
          }

          const results = searchSimilar(index, query, 20)
          const memoryIds = new Set(allMemories.map(m => m.id))
          const scoped = results.filter(r => memoryIds.has(r.id))
          if (!scoped.length) return `No memories semantically matching "${query}"`
          return scoped.map(r => {
            const mem = allMemories.find(m => m.id === r.id)
            const tag = mem ? formatMemoryTag(mem) : '[unknown]'
            return `${tag} (id: ${r.id}, score: ${r.score.toFixed(3)}) ${r.content}`
          }).join('\n')
        }

        const queryLower = query.toLowerCase()
        const matches = allMemories.filter(m => m.content.toLowerCase().includes(queryLower))

        if (!matches.length) return `No memories matching "${query}"`
        return matches.map(m =>
          `${formatMemoryTag(m)} (id: ${m.id}) ${m.content}`
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
      scope: z.enum(['session', 'agent', 'skill', 'global', 'all']).default('all').describe('Which memory scope to list'),
    }),
    execute: async ({ type, scope }) => {
      try {
        const state = readStoreState()
        if (!state) return 'Error: Store not available'

        let allMemories = collectScopedMemories(state, scope)

        if (!allMemories.length) return 'No memories found.'

        if (type && type !== 'all') {
          allMemories = allMemories.filter(m => m.type === type)
        }

        if (!allMemories.length) return type ? `No ${type} memories found.` : 'No memories found.'
        return allMemories.map(m =>
          `${formatMemoryTag(m)} (id: ${m.id}, ${new Date(m.createdAt).toLocaleDateString()}) ${m.content}`
        ).join('\n')
      } catch (err) {
        return `Error listing memories: ${err instanceof Error ? err.message : String(err)}`
      }
    },
  }),

  memory_delete: tool({
    description: 'Delete a specific memory entry by its ID. Searches session, agent, skill, and global scopes.',
    inputSchema: z.object({
      id: z.string().describe('ID of the memory to delete'),
    }),
    execute: async ({ id }) => {
      try {
        const state = readStoreState()
        if (!state) return 'Error: Store not available'

        let found = false

        writeStoreState((s) => {
          const sessionResult = removeMemoryFromOwners((s.sessions ?? []) as PersistedSessionEntry[], id)
          const agentResult = removeMemoryFromOwners((s.agents ?? []) as PersistedAgentEntry[], id)
          const skillResult = removeMemoryFromOwners((s.skills ?? []) as PersistedSkillEntry[], id)
          s.sessions = sessionResult.owners
          s.agents = agentResult.owners
          s.skills = skillResult.owners
          found = sessionResult.found || agentResult.found || skillResult.found

          const globalMemories = s.globalMemories as PersistedMemoryEntry[] | undefined
          if (globalMemories) {
            const before = globalMemories.length
            s.globalMemories = globalMemories.filter(m => m.id !== id)
            if ((s.globalMemories as PersistedMemoryEntry[]).length < before) found = true
          }
        })

        if (found) {
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
        const state = readStoreState()
        if (!state) return 'Error: Store not available'
        const selectedAgent = state.selectedAgent as { id?: string } | undefined
        const fromAgentId = selectedAgent?.id ?? 'unknown'
        const agentList = Array.isArray(state.agents) ? state.agents as PersistedAgentEntry[] : []
        if (!agentList.length) return 'Error: No agents available'

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
    description: 'List all available agents with their names, skills, model, and status. Shows which agent is currently selected. Use this before updating or deleting an agent when you need the exact id.',
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

  agent_add: tool({
    description: 'Create a new saved agent profile in the current workspace. Provide the system prompt and any optional routing, tool, or skill settings you want persisted.',
    inputSchema: z.object({
      name: z.string().describe('Agent name'),
      system_prompt: z.string().describe('System prompt for the new agent'),
      ...agentToolMutationSchema,
    }),
    execute: async ({ name, system_prompt, ...rest }) => {
      const context = getAgentToolContext()
      if ('error' in context) return `Error: ${context.error}`

      const trimmedName = name.trim()
      if (!trimmedName) return 'Error: Agent name cannot be empty.'
      if (!system_prompt.trim()) return 'Error: System prompt cannot be empty.'

      const nextAgent = buildAgentFromToolInput({ name: trimmedName, system_prompt, ...rest })
      const validationError = validateAgentForTool(nextAgent, context.models, context.skills)
      if (validationError) {
        return `Error: Agent validation failed.\n${validationError}`
      }

      const synced = writeStoreState((state) => {
        const currentAgents = Array.isArray(state.agents) ? state.agents as Agent[] : []
        state.agents = [...currentAgents, nextAgent]
        state.selectedAgent = nextAgent
        appendAgentVersionToStore(state, nextAgent, 'manual')
      })
      if (!synced) return 'Error: Store not available'

      return JSON.stringify({
        message: `Created agent "${nextAgent.name}".`,
        agent: summarizeAgentForTool(nextAgent),
        storeSynced: synced,
      }, null, 2)
    },
  }),

  agent_update: tool({
    description: 'Update an existing saved agent profile. Prefer agent_id when available. Any provided lists replace the full saved list. Set optional text fields to null or an empty string to clear them.',
    inputSchema: z.object({
      agent_id: z.string().optional().describe('Exact agent id to update'),
      agent_name: z.string().optional().describe('Exact or partial agent name when id is unknown'),
      name: z.string().optional().describe('New agent name'),
      system_prompt: z.string().optional().describe('New system prompt for the agent'),
      ...agentToolMutationSchema,
    }),
    execute: async ({ agent_id, agent_name, ...updates }) => {
      const context = getAgentToolContext()
      if ('error' in context) return `Error: ${context.error}`

      const resolved = resolveAgentReference(context.agents, agent_id, agent_name)
      if (!resolved.agent) return `Error: ${resolved.error}`

      if (Object.values(updates).every((value) => value === undefined)) {
        return 'Error: No updates were provided.'
      }

      const updatedAgent = applyAgentToolPatch(resolved.agent, updates)
      if (!updatedAgent.name.trim()) return 'Error: Agent name cannot be empty.'

      const validationError = validateAgentForTool(updatedAgent, context.models, context.skills)
      if (validationError) {
        return `Error: Agent validation failed.\n${validationError}`
      }

      const synced = writeStoreState((state) => {
        const currentAgents = Array.isArray(state.agents) ? state.agents as Agent[] : []
        state.agents = currentAgents.map((agent) => agent.id === updatedAgent.id ? updatedAgent : agent)
        if ((state.selectedAgent as Agent | undefined)?.id === updatedAgent.id) {
          state.selectedAgent = updatedAgent
        }
        appendAgentVersionToStore(state, updatedAgent, 'manual')
      })
      if (!synced) return 'Error: Store not available'

      return JSON.stringify({
        message: `Updated agent "${updatedAgent.name}".`,
        agent: summarizeAgentForTool(updatedAgent),
        storeSynced: synced,
      }, null, 2)
    },
  }),

  agent_remove: tool({
    description: 'Delete a saved agent profile from the current workspace. Prefer agent_id when available.',
    inputSchema: z.object({
      agent_id: z.string().optional().describe('Exact agent id to remove'),
      agent_name: z.string().optional().describe('Exact or partial agent name when id is unknown'),
    }),
    execute: async ({ agent_id, agent_name }) => {
      const context = getAgentToolContext()
      if ('error' in context) return `Error: ${context.error}`

      const resolved = resolveAgentReference(context.agents, agent_id, agent_name)
      if (!resolved.agent) return `Error: ${resolved.error}`
      if (resolved.agent.id === 'default-assistant') {
        return 'Error: The default assistant cannot be removed.'
      }

      const synced = writeStoreState((state) => {
        const currentAgents = Array.isArray(state.agents) ? state.agents as Agent[] : []
        state.agents = currentAgents.filter((agent) => agent.id !== resolved.agent?.id)
        if ((state.selectedAgent as Agent | undefined)?.id === resolved.agent?.id) {
          state.selectedAgent = null
        }
        if (Array.isArray(state.sessions)) {
          state.sessions = (state.sessions as Array<Record<string, unknown>>).map((session) =>
            session.agentId === resolved.agent?.id
              ? { ...session, agentId: undefined }
              : session,
          )
        }
      })
      if (!synced) return 'Error: Store not available'

      return JSON.stringify({
        message: `Removed agent "${resolved.agent.name}".`,
        agentId: resolved.agent.id,
        storeSynced: synced,
      }, null, 2)
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
        const state = readStoreState()
        if (!state) return 'Error: Store not available'
        const agents = Array.isArray(state.agents) ? state.agents as PersistedAgentEntry[] : []
        if (!agents.length) return 'Error: No agents available'

        const needle = agent_name.toLowerCase()
        const target = agents.find(
          (a) => a.name?.toLowerCase() === needle,
        ) ?? agents.find(
          (a) => a.name?.toLowerCase().includes(needle),
        )
        if (!target) return `Error: No agent matching "${agent_name}" found.`

        const memory: PersistedMemoryEntry = {
          id: `memory-${crypto.randomUUID()}`,
          content: `[Notification from agent] ${message}`,
          type: 'knowledge',
          scope: 'global',
          createdAt: Date.now(),
          source: typeof state.activeSessionId === 'string' && state.activeSessionId ? state.activeSessionId : 'agent-comm',
        }

        const synced = writeStoreState((nextState) => {
          const currentAgents = Array.isArray(nextState.agents) ? nextState.agents as PersistedAgentEntry[] : []
          nextState.agents = currentAgents.map((agent) => {
            if (agent.id !== target.id) return agent
            return {
              ...agent,
              memories: [...(agent.memories ?? []), memory],
            }
          })
        })
        if (!synced) return 'Error: Store not available'

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
    }).superRefine((input, ctx) => {
      if (input.type === 'schedule' && !input.pattern?.trim()) {
        ctx.addIssue({ code: 'custom', path: ['pattern'], message: 'pattern must be a cron expression when type is schedule' })
      }
    }),
    execute: async ({ name, type, pattern, agent_id, prompt_template }) => {
      try {
        if (type === 'schedule' && !pattern?.trim()) {
          return 'Error: schedule triggers require pattern to be a cron expression.'
        }
        const raw = readCached(EVENTS_STORAGE_KEY)
        const triggers = raw ? safeParse<Array<Record<string, unknown>>>(raw) : []
        const trigger = {
          id: `evt-${crypto.randomUUID()}`,
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


  event_trigger_manage: tool({
    description: 'Manage event automation triggers with one action field: list, create, or delete. Prefer this over the legacy event_* trigger tools.',
    inputSchema: eventTriggerManageInputSchema,
    execute: async (input, options) => {
      switch (input.action) {
        case 'list':
          return executeBuiltinTool('event_list_triggers', {}, options)
        case 'create':
          return executeBuiltinTool('event_create_trigger', {
            name: input.name,
            type: input.type,
            pattern: input.pattern,
            agent_id: input.agent_id,
            prompt_template: input.prompt_template,
          }, options)
        case 'delete':
          return executeBuiltinTool('event_delete_trigger', { id: input.id }, options)
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
        const state = readStoreState()
        if (!state) return 'Error: Store not available'
        const skills = Array.isArray(state.skills) ? state.skills as Array<Record<string, unknown>> : []

        // Check for duplicate name
        if (skills.some((s) => (s.name as string)?.toLowerCase() === name.toLowerCase())) {
          return `Error: A skill with name "${name}" already exists`
        }

        const skillId = `evolved-${crypto.randomUUID()}`
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

        const synced = writeStoreState((nextState) => {
          const currentSkills = Array.isArray(nextState.skills) ? nextState.skills as Array<Record<string, unknown>> : []
          nextState.skills = [...currentSkills, newSkill]
        })
        if (!synced) return 'Error: Store not available'

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
        const state = readStoreState()
        if (!state) return 'Error: Store not available'
        const skills = Array.isArray(state.skills) ? state.skills as Array<Record<string, unknown>> : []
        if (!skills.length) return 'Error: No skills found'

        const idx = skills.findIndex((s) => s.id === skill_id)
        if (idx === -1) return `Skill not found: ${skill_id}`

        // Don't allow modifying built-in skills
        if (skills[idx].type === 'builtin') {
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
        const patch = Object.fromEntries(
          Object.entries(updateObj).filter(([key]) => allowed.includes(key)),
        )

        const synced = writeStoreState((nextState) => {
          const currentSkills = Array.isArray(nextState.skills) ? nextState.skills as Array<Record<string, unknown>> : []
          nextState.skills = currentSkills.map((skill) => skill.id === skill_id ? { ...skill, ...patch } : skill)
        })
        if (!synced) return 'Error: Store not available'

        const nextName = typeof patch.name === 'string' ? patch.name : skills[idx].name
        return `Improved skill "${nextName}". Reason: ${reason}`
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
        const state = readStoreState()
        if (!state) return 'Error: Store not available'
        const skills = Array.isArray(state.skills) ? state.skills as Array<{ id: string; name: string; description?: string; prompt?: string; customCode?: string; tools?: Array<unknown> }> : []
        if (!skills.length) return 'Error: No skills found'

        const skill = skills.find((s) => s.id === skill_id)
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
    description: 'Search and list editable Markdown documents stored in Suora. Use this first for questions about local notes, project plans, specs, budgets, schedules, people, or any knowledge likely stored in the user\'s documents before using web_search.',
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
        const groupNameById = new Map(groups.map((group) => [group.id, group.name]))
        const q = query?.trim()

        const docs = q
          ? searchDocuments(nodes, group_id ?? null, q).slice(0, 30).map((result) => ({
            doc: result.node,
            preview: result.excerpt || summarizeMarkdown(result.node.markdown),
          }))
          : nodes
            .filter((node): node is DocumentItem => node.type === 'document')
            .filter((doc) => !group_id || doc.groupId === group_id)
            .sort((a, b) => b.updatedAt - a.updatedAt)
            .slice(0, 30)
            .map((doc) => ({
              doc,
              preview: summarizeMarkdown(doc.markdown),
            }))

        if (!docs.length) return query ? `No documents matching "${query}".` : 'No documents found.'
        return docs.map(({ doc, preview }) => {
          const groupName = groupNameById.get(doc.groupId) || doc.groupId
          const selected = state.selectedDocumentId === doc.id ? '> ' : '  '
          return `${selected}${doc.title} (id: ${doc.id}, group: ${groupName}, updated: ${new Date(doc.updatedAt).toLocaleString()})\n  ${preview}`
        }).join('\n\n')
      } catch (err) {
        return `Error listing documents: ${err instanceof Error ? err.message : String(err)}`
      }
    },
  }),

  query_document_graph: tool({
    description: 'Traverse Suora\'s built-in local document knowledge graph to expand from a matched document into referenced or tag-related documents. Use this when many local documents may be involved and the answer could span multiple connected notes, even without any external graph CLI or MCP server.',
    inputSchema: z.object({
      query: z.string().optional().describe('Optional search query used to find graph seed documents'),
      document_id: z.string().optional().describe('Optional document ID or title to use as the graph seed'),
      group_id: z.string().optional().describe('Optional document group ID to scope the graph'),
    }).refine((value) => Boolean(value.query?.trim() || value.document_id?.trim()), {
      message: 'Provide query or document_id',
    }),
    execute: async ({ query, document_id, group_id }) => {
      try {
        const state = readStoreState()
        if (!state) return 'Error: Store not available'
        const groups = (state.documentGroups || []) as DocumentGroup[]
        const nodes = (state.documentNodes || []) as DocumentNode[]
        const graph = buildDocumentGraph(groups, nodes, { groupId: group_id ?? null })
        const insights = analyzeDocumentGraphInsights(graph, nodes)
        const result = queryDocumentGraph(graph, nodes, {
          query,
          documentIdOrTitle: document_id,
          groupId: group_id ?? null,
        })

        if (!result.seeds.length) {
          const target = query?.trim() || document_id?.trim() || 'request'
          return `No document graph matches for ${target}. Use list_documents for direct keyword results.`
        }

        return JSON.stringify({
          query: query?.trim() || null,
          documentId: document_id?.trim() || null,
          groupId: group_id ?? null,
          stats: {
            documents: graph.nodes.filter((node) => node.type === 'document').length,
            tags: graph.tags.length,
            edges: graph.edges.length,
            orphans: graph.orphanDocumentIds.length,
            communities: insights.communities.length,
            graphInsights: insights.insights.length,
          },
          seeds: result.seeds,
          relatedDocuments: result.relatedDocuments,
          insights: insights.insights.slice(0, 5),
          tags: result.tags,
          externalLinks: result.externalLinks.slice(0, 10),
        }, null, 2)
      } catch (err) {
        return `Error querying document graph: ${err instanceof Error ? err.message : String(err)}`
      }
    },
  }),

  read_document: tool({
    description: 'Read the full Markdown content of a Suora document by ID or title. Use this after list_documents when answering from local document knowledge, and prefer it over web_search for facts that may exist in the user\'s notes.',
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

  create_document: tool({
    description: 'Create a new Suora document in the current group or a specified group/folder. Use this when the user wants the result saved as a document instead of only returned in chat.',
    inputSchema: z.object({
      title: z.string().describe('Document title to create'),
      markdown: z.string().optional().describe('Optional initial Markdown content. If omitted, a starter template is used for Markdown documents.'),
      group_id: z.string().optional().describe('Optional target document group ID or name'),
      parent_id: z.string().optional().describe('Optional target folder ID or title within the chosen group'),
      reason: z.string().describe('Short reason for creating the document, shown in confirmation/tool output'),
    }),
    execute: async ({ title, markdown, group_id, parent_id, reason }) => {
      try {
        const state = readStoreState()
        if (!state) return 'Error: Store not available'

        const nextTitle = title.trim()
        if (!nextTitle) return 'Error: Document title is required.'

        const groups = (state.documentGroups || []) as DocumentGroup[]
        const nodes = (state.documentNodes || []) as DocumentNode[]
        const explicitGroup = group_id?.trim() ? resolveDocumentGroup(groups, group_id) : null
        if (group_id?.trim() && !explicitGroup) {
          return `Document group not found: ${group_id}`
        }

        let targetGroup: DocumentGroup | null = explicitGroup
          ?? groups.find((group) => group.id === state.selectedDocumentGroupId)
          ?? groups[0]
          ?? null

        const targetFolder = parent_id?.trim()
          ? resolveDocumentFolder(nodes, parent_id, explicitGroup?.id)
            ?? (!explicitGroup ? resolveDocumentFolder(nodes, parent_id) : null)
          : null

        if (parent_id?.trim() && !targetFolder) {
          return `Folder not found: ${parent_id}`
        }

        if (targetFolder && targetGroup && targetFolder.groupId !== targetGroup.id) {
          return `Folder "${targetFolder.title}" is not in group "${targetGroup.name}".`
        }

        if (!targetGroup && targetFolder) {
          targetGroup = groups.find((group) => group.id === targetFolder.groupId) ?? null
        }

        let createdGroup: DocumentGroup | null = null
        if (!targetGroup) {
          createdGroup = createDocumentGroup('New Document Group')
          targetGroup = createdGroup
        }

        const selectedDocumentId = typeof state.selectedDocumentId === 'string' ? state.selectedDocumentId : null
        const selectedDocument = selectedDocumentId
          ? resolveDocument(nodes, selectedDocumentId)
          : null
        const defaultParentId = selectedDocument && selectedDocument.groupId === targetGroup.id
          ? selectedDocument.parentId
          : null
        const nextParentId = targetFolder?.id ?? defaultParentId ?? null
        const nextDocument = createDocument(targetGroup.id, nextParentId, nextTitle)
        if (markdown !== undefined) {
          nextDocument.markdown = markdown
        }

        const destination = `${targetGroup.name}${targetFolder ? ` / ${targetFolder.title}` : ''}`
        if (!(await confirmIfNeeded(`document_create\n${nextTitle}\nLocation: ${destination}\nReason: ${reason}\nInitial length: ${nextDocument.markdown.length} characters`))) {
          return 'Cancelled by user confirmation policy.'
        }

        if (!writeStoreState((s) => {
          if (createdGroup) {
            const currentGroups = (s.documentGroups || []) as DocumentGroup[]
            s.documentGroups = [...currentGroups, createdGroup]
          }
          const currentNodes = (s.documentNodes || []) as DocumentNode[]
          s.documentNodes = [...currentNodes, nextDocument]
          s.selectedDocumentGroupId = targetGroup.id
          s.selectedDocumentId = nextDocument.id
        })) return 'Error: Store not available'

        return `Created document "${nextDocument.title}" (${nextDocument.id}) in ${destination}. Reason: ${reason}`
      } catch (err) {
        return `Error creating document: ${err instanceof Error ? err.message : String(err)}`
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
          s.skills = arr.map((skill) => skill.id === skill_id ? { ...skill, enabled } : skill)
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
            s.envVariables = arr.map((envVariable) => envVariable.key === key
              ? {
                  ...envVariable,
                  value,
                  description: description !== undefined ? description : envVariable.description,
                  secret: isSecret,
                  updatedAt: now,
                }
              : envVariable)
          } else {
            s.envVariables = [...arr, { key, value, description, secret: isSecret, createdAt: now, updatedAt: now }]
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

  env_manage: tool({
    description: 'Manage environment variables with one action field: get, set, list, or delete. Prefer this over the legacy env_* tools.',
    inputSchema: envManageInputSchema,
    execute: async (input, options) => {
      switch (input.action) {
        case 'get':
          return executeBuiltinTool('env_get', { key: input.key }, options)
        case 'set':
          return executeBuiltinTool('env_set', {
            key: input.key,
            value: input.value,
            description: input.description,
            secret: input.secret,
          }, options)
        case 'list':
          return executeBuiltinTool('env_list', {}, options)
        case 'delete':
          return executeBuiltinTool('env_delete', { key: input.key }, options)
      }
    },
  }),
}

// Merge env var tools into main builtinToolDefs
Object.assign(builtinToolDefs, envVarTools)

const DEFAULT_AGENT_HIDDEN_TOOL_ALIASES = new Set([
  'todo_list',
  'todo_add',
  'todo_update',
  'todo_remove',
  'event_list_triggers',
  'event_create_trigger',
  'event_delete_trigger',
  'env_get',
  'env_set',
  'env_list',
  'env_delete',
  'browser_extract_text',
  'browser_extract_links',
  'browser_evaluate',
])

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
  todo_manage:           { userFacingName: 'Manage todos', isReadOnly: false, isDestructive: false, isConcurrencySafe: false, requiresConfirmation: false },
  todo_list:             { userFacingName: 'List todos', isReadOnly: true, isDestructive: false, isConcurrencySafe: true, requiresConfirmation: false },
  timer_list:            { userFacingName: 'List timers', isReadOnly: true, isDestructive: false, isConcurrencySafe: true, requiresConfirmation: false },
  pipeline_list:         { userFacingName: 'List pipelines', isReadOnly: true, isDestructive: false, isConcurrencySafe: true, requiresConfirmation: false },
  memory_search:         { userFacingName: 'Search memory', isReadOnly: true, isDestructive: false, isConcurrencySafe: true, requiresConfirmation: false },
  memory_list:           { userFacingName: 'List memories', isReadOnly: true, isDestructive: false, isConcurrencySafe: true, requiresConfirmation: false },
  agent_list:            { userFacingName: 'List agents', isReadOnly: true, isDestructive: false, isConcurrencySafe: true, requiresConfirmation: false },
  event_trigger_manage:  { userFacingName: 'Manage triggers', isReadOnly: false, isDestructive: false, isConcurrencySafe: false, requiresConfirmation: false },
  event_list_triggers:   { userFacingName: 'List triggers', isReadOnly: true, isDestructive: false, isConcurrencySafe: true, requiresConfirmation: false },
  read_attachment:       { userFacingName: 'Read attachment', isReadOnly: true, isDestructive: false, isConcurrencySafe: true, requiresConfirmation: false },
  analyze_code_structure:{ userFacingName: 'Analyze code', isReadOnly: true, isDestructive: false, isConcurrencySafe: true, requiresConfirmation: false, searchHint: 'code structure analysis' },
  find_code_patterns:    { userFacingName: 'Find patterns', isReadOnly: true, isDestructive: false, isConcurrencySafe: true, requiresConfirmation: false, searchHint: 'todo fixme console' },
  git_status:            { userFacingName: 'Git status', isReadOnly: true, isDestructive: false, isConcurrencySafe: true, requiresConfirmation: false },
  git_diff:              { userFacingName: 'Git diff', isReadOnly: true, isDestructive: false, isConcurrencySafe: true, requiresConfirmation: false },
  git_log:               { userFacingName: 'Git log', isReadOnly: true, isDestructive: false, isConcurrencySafe: true, requiresConfirmation: false },
  env_manage:            { userFacingName: 'Manage env vars', isReadOnly: false, isDestructive: false, isConcurrencySafe: false, requiresConfirmation: false },
  env_get:               { userFacingName: 'Get env var', isReadOnly: true, isDestructive: false, isConcurrencySafe: true, requiresConfirmation: false },
  env_list:              { userFacingName: 'List env vars', isReadOnly: true, isDestructive: false, isConcurrencySafe: true, requiresConfirmation: false },
  channel_server_status: { userFacingName: 'Channel status', isReadOnly: true, isDestructive: false, isConcurrencySafe: true, requiresConfirmation: false },
  list_models:           { userFacingName: 'List models', isReadOnly: true, isDestructive: false, isConcurrencySafe: true, requiresConfirmation: false },
  list_sessions:         { userFacingName: 'List sessions', isReadOnly: true, isDestructive: false, isConcurrencySafe: true, requiresConfirmation: false },
  list_providers:        { userFacingName: 'List providers', isReadOnly: true, isDestructive: false, isConcurrencySafe: true, requiresConfirmation: false },
  list_plugins:          { userFacingName: 'List plugins', isReadOnly: true, isDestructive: false, isConcurrencySafe: true, requiresConfirmation: false },
  list_documents:        { userFacingName: 'List documents', isReadOnly: true, isDestructive: false, isConcurrencySafe: true, requiresConfirmation: false, searchHint: 'document markdown notes' },
  query_document_graph:  { userFacingName: 'Query document graph', isReadOnly: true, isDestructive: false, isConcurrencySafe: true, requiresConfirmation: false, searchHint: 'document graph references tags related notes' },
  read_document:         { userFacingName: 'Read document', isReadOnly: true, isDestructive: false, isConcurrencySafe: true, requiresConfirmation: false, searchHint: 'document markdown content' },
  create_document:       { userFacingName: 'Create document', isReadOnly: false, isDestructive: false, isConcurrencySafe: false, requiresConfirmation: true, searchHint: 'create document markdown note' },
  list_skills:           { userFacingName: 'List skills', isReadOnly: true, isDestructive: false, isConcurrencySafe: true, requiresConfirmation: false },
  read_skill:            { userFacingName: 'Read skill', isReadOnly: true, isDestructive: false, isConcurrencySafe: true, requiresConfirmation: false, searchHint: 'skill instructions content' },
  get_settings:          { userFacingName: 'Get settings', isReadOnly: true, isDestructive: false, isConcurrencySafe: true, requiresConfirmation: false },
  skill_suggest_improvements: { userFacingName: 'Suggest improvements', isReadOnly: true, isDestructive: false, isConcurrencySafe: true, requiresConfirmation: false },

  // ── Write tools (not destructive) ──
  write_file:            { userFacingName: 'Write file', isReadOnly: false, isDestructive: false, isConcurrencySafe: false, requiresConfirmation: true, searchHint: 'create write file' },
  append_file:           { userFacingName: 'Append file', isReadOnly: false, isDestructive: false, isConcurrencySafe: false, requiresConfirmation: true, searchHint: 'append chunk write file' },
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
  timer_add:             { userFacingName: 'Add timer', isReadOnly: false, isDestructive: false, isConcurrencySafe: false, requiresConfirmation: true },
  timer_update:          { userFacingName: 'Update timer', isReadOnly: false, isDestructive: false, isConcurrencySafe: false, requiresConfirmation: true },
  timer_remove:          { userFacingName: 'Remove timer', isReadOnly: false, isDestructive: true, isConcurrencySafe: false, requiresConfirmation: true },
  pipeline_add:          { userFacingName: 'Add pipeline', isReadOnly: false, isDestructive: false, isConcurrencySafe: false, requiresConfirmation: true },
  pipeline_update:       { userFacingName: 'Update pipeline', isReadOnly: false, isDestructive: false, isConcurrencySafe: false, requiresConfirmation: true },
  pipeline_remove:       { userFacingName: 'Remove pipeline', isReadOnly: false, isDestructive: true, isConcurrencySafe: false, requiresConfirmation: true },
  agent_add:             { userFacingName: 'Add agent', isReadOnly: false, isDestructive: false, isConcurrencySafe: false, requiresConfirmation: true },
  agent_update:          { userFacingName: 'Update agent', isReadOnly: false, isDestructive: false, isConcurrencySafe: false, requiresConfirmation: true },
  agent_remove:          { userFacingName: 'Remove agent', isReadOnly: false, isDestructive: true, isConcurrencySafe: false, requiresConfirmation: true },
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
  browser_extract:       { userFacingName: 'Browser extract', isReadOnly: true, isDestructive: false, isConcurrencySafe: false, requiresConfirmation: false, searchHint: 'headless browser extract text links headings' },
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
  const hasDocumentSearch = toolNames.includes('list_documents')
  const hasDocumentGraph = toolNames.includes('query_document_graph')
  const hasDocumentRead = toolNames.includes('read_document')
  const hasWebSearch = toolNames.includes('web_search')
  const hasWriteFile = toolNames.includes('write_file')
  const hasAppendFile = toolNames.includes('append_file')

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
  if (hasDocumentGraph || hasDocumentSearch || hasDocumentRead) {
    lines.push('Local document routing: for questions about notes, plans, specs, budgets, schedules, project knowledge, or people likely stored in Suora documents, use local document tools before web_search.')
    if (hasDocumentGraph) {
      lines.push('When the answer may span multiple connected documents or the document corpus is large, start with query_document_graph, then use read_document on the most relevant documents.')
    } else if (hasDocumentSearch && hasDocumentRead) {
      lines.push('When answering from local documents, start with list_documents, then use read_document for the strongest matches before replying.')
    }
  }
  if (hasWebSearch && (hasDocumentGraph || hasDocumentSearch)) {
    lines.push('Only use web_search after local document tools are insufficient or when the question is clearly about external/public information.')
  }
  if (hasWriteFile && hasAppendFile) {
    lines.push('Large file writes: do not send a very large file body in one write_file call. Write the first chunk with write_file, then continue with append_file until the file is complete.')
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
  /** Page or workflow specific session context */
  sessionContext?: string
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
  /** Whether the active agent should proactively store durable memories */
  autoLearn?: boolean
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

  if (opts.sessionContext) {
    sections.push(`<session-context>\n${opts.sessionContext}\n</session-context>`)
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

  if (opts.autoLearn && opts.toolNames?.includes('memory_store')) {
    sections.push([
      '<auto-memory>',
      'Proactively store durable information with memory_store when it will help future interactions, even if the user does not explicitly ask you to remember it.',
      'Store concise, user-approved or user-stated preferences, corrections, stable project/workflow knowledge, and reusable skill-specific instructions.',
      'When a command, script, or tool invocation fails and you discover a reusable correction (such as the right command, path, flag, working directory, environment requirement, or retry strategy), store that correction with memory_store before repeating similar work.',
      'Use type="correction" for learned fixes from failed tool calls, and include enough context to avoid making the same failing call again without storing secrets or raw sensitive output.',
      'Choose the narrowest correct scope: session for only this chat/task, agent for this agent profile, skill for knowledge tied to a specific skill (include target_id or target_name), and global for cross-session/cross-agent knowledge.',
      'Do not store secrets, credentials, sensitive personal data, one-off transient details, or duplicates.',
      '</auto-memory>',
    ].join('\n'))
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

function resolveRuntimeSkillIds(agentSkillIds: string[], allSkills: Skill[]): string[] {
  const runtimeSkillIds = new Set(agentSkillIds)

  for (const skill of allSkills) {
    if (!skill?.enabled) continue
    if (skill.source !== 'claude-dir' && skill.source !== 'agent-dir') continue
    runtimeSkillIds.add(skill.id)
  }

  return Array.from(runtimeSkillIds)
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
  const runtimeSkillIds = resolveRuntimeSkillIds(agentSkillIds, allSkills)

  const explicitlyAllowedTools = new Set(allowedTools ?? [])

  // Always include current built-in tools. Legacy aliases for merged tools are
  // hidden by default, but remain available when an existing agent allowlist
  // names them explicitly.
  for (const [name, def] of Object.entries(builtinToolDefs)) {
    if (DEFAULT_AGENT_HIDDEN_TOOL_ALIASES.has(name) && !explicitlyAllowedTools.has(name)) {
      continue
    }
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
  for (const skillId of runtimeSkillIds) {
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
  const runtimeSkillIds = resolveRuntimeSkillIds(agentSkillIds, allSkills)

  for (const skillId of runtimeSkillIds) {
    const skill = allSkills.find((s) => s.id === skillId)
    if (!skill?.enabled) continue

    const lines: string[] = []

    // 1. Skill content (markdown instructions)
    const content = skill.content ?? skill.prompt
    if (typeof content === 'string' && content.trim()) {
      lines.push(content.trim())
    }

    if (skill.memories?.length) {
      lines.push(`### Skill memory\n\n${skill.memories.slice(-8).map((memory) => `- ${memory.content}`).join('\n')}`)
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
