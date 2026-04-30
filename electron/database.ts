import fs from 'fs/promises'
import path from 'path'
import { safeParse, safeStringify } from '../src/utils/safeJson'

export const SUORA_STORAGE_VERSION = 2
export const SPLIT_STORE_NAME = 'suora-store'

export type JsonTableName =
  | 'provider_configs'
  | 'models'
  | 'agents'
  | 'skills'
  | 'channels'
  | 'channel_messages'
  | 'mcp_servers'
  | 'timers'
  | 'timer_executions'
  | 'pipelines'
  | 'pipeline_executions'
  | 'memories'

const JSON_TABLES = new Set<JsonTableName>([
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

const TOP_LEVEL_DIRECTORIES = [
  'sessions',
  'timers',
  'timers/executions',
  'pipelines',
  'pipelines/executions',
  'agents',
  'skills',
  'documents',
  'documents/indexes',
  'channels',
  'memories',
  'mcp',
] as const

const MODEL_STATE_KEYS = new Set([
  'models',
  'selectedModel',
  'providerConfigs',
  'apiKeys',
  'encryptedSecrets',
  'encryptionVersion',
])

const SETTINGS_EXCLUDED_KEYS = new Set([
  ...MODEL_STATE_KEYS,
  'sessions',
  'activeSessionId',
  'openSessionTabs',
  'agents',
  'skills',
  'skillVersions',
  'channels',
  'channelMessages',
  'channelTokens',
  'channelHealth',
  'channelUsers',
  'globalMemories',
  'agentPipelines',
  'mcpServers',
  'documentGroups',
  'documentNodes',
  'selectedDocumentGroupId',
  'selectedDocumentId',
])

const TABLE_FILES: Partial<Record<JsonTableName, string>> = {
  agents: 'agents/index.json',
  skills: 'skills/index.json',
  channels: 'channels/index.json',
  channel_messages: 'channels/messages.json',
  mcp_servers: 'mcp/index.json',
  timers: 'timers/index.json',
  pipelines: 'pipelines/index.json',
  memories: 'memories/index.json',
}

// Tables stored as a directory of per-ID JSON files (e.g. `timers/executions/{id}.json`).
// Each entity is its own file, which keeps frequent appends/reads cheap and avoids
// rewriting a large index file every time an execution is recorded.
const TABLE_DIRECTORIES: Partial<Record<JsonTableName, string>> = {
  timer_executions: 'timers/executions',
  pipeline_executions: 'pipelines/executions',
}

interface PersistedPayload {
  state?: Record<string, unknown>
  version?: number
}

interface SessionLike {
  id: string
  messages?: unknown[]
  [key: string]: unknown
}

interface AgentLike {
  id: string
  memories?: unknown[]
  [key: string]: unknown
}

interface DocumentGroupLike {
  id: string
  name?: string
  indexPath?: string
  [key: string]: unknown
}

interface DocumentNodeLike {
  id: string
  groupId?: string
  parentId?: string | null
  type?: unknown
  title?: string
  markdown?: string
  filePath?: string
  path?: string
  [key: string]: unknown
}

interface DocumentStoragePlan {
  index: {
    groups: unknown[]
    selectedGroupId: string | null
    selectedDocumentId: string | null
  }
  groupIndexes: Array<{ relativePath: string; content: { groupId: string; nodes: unknown[] } }>
  directories: string[]
  files: Array<{ relativePath: string; content: string }>
}

interface DocumentGroupPath {
  documentDirectory: string
  indexPath: string
}

function assertJsonTable(table: JsonTableName): void {
  if (!JSON_TABLES.has(table)) throw new Error(`Unsupported storage table: ${table}`)
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value))
}

function isEntity(value: unknown): value is { id: string } {
  return isRecord(value) && typeof value.id === 'string' && value.id.length > 0
}

function safeSegment(value: string): string {
  return value.replace(/[^a-zA-Z0-9._-]/g, '_') || 'unknown'
}

function safeDocumentSegment(value: string, fallback: string): string {
  const cleaned = value
    .replace(/[<>:"/\\|?*\x00-\x1F]/g, '_')
    .replace(/[. ]+$/g, '')
    .trim()
  const segment = cleaned || fallback
  return /^(con|prn|aux|nul|com[1-9]|lpt[1-9])$/i.test(segment) ? `${segment}_` : segment
}

function stripMarkdownExtension(value: string): string {
  return value.replace(/\.md$/i, '')
}

function normalizeDocumentRelativePath(relativePath: string): string | null {
  const normalized = path.posix.normalize(relativePath.replace(/\\/g, '/'))
  if (path.posix.isAbsolute(normalized) || normalized === 'documents' || normalized.startsWith('../') || normalized.includes('/../')) return null
  if (!normalized.startsWith('documents/')) return null
  return normalized
}

function normalizeDocumentContentFilePath(relativePath: string): string | null {
  const normalized = normalizeDocumentRelativePath(relativePath)
  if (!normalized || !normalized.endsWith('.md') || normalized.startsWith('documents/indexes/')) return null
  return normalized
}

function normalizeDocumentDirectoryPath(relativePath: string): string | null {
  const normalized = normalizeDocumentRelativePath(relativePath)
  if (!normalized || normalized === 'documents/indexes' || normalized.startsWith('documents/indexes/')) return null
  return normalized
}

async function pathExists(filePath: string): Promise<boolean> {
  try {
    await fs.access(filePath)
    return true
  } catch {
    return false
  }
}

async function atomicWriteFile(filePath: string, data: string): Promise<void> {
  await fs.mkdir(path.dirname(filePath), { recursive: true })
  const tempPath = `${filePath}.${process.pid}.${Date.now()}.tmp`
  await fs.writeFile(tempPath, data)
  try {
    await fs.rename(tempPath, filePath)
  } catch (error) {
    await fs.unlink(tempPath).catch(() => {})
    throw error
  }
}

async function writeJson(filePath: string, value: unknown): Promise<void> {
  await atomicWriteFile(filePath, `${safeStringify(value, 2)}\n`)
}

async function readJson<T>(filePath: string, fallback: T): Promise<T> {
  try {
    return safeParse<T>(await fs.readFile(filePath, 'utf-8'))
  } catch (error) {
    const code = (error as NodeJS.ErrnoException).code
    if (code === 'ENOENT') return fallback
    throw error
  }
}

async function readJsonIfExists<T>(filePath: string): Promise<T | null> {
  try {
    return safeParse<T>(await fs.readFile(filePath, 'utf-8'))
  } catch (error) {
    const code = (error as NodeJS.ErrnoException).code
    if (code === 'ENOENT') return null
    throw error
  }
}

async function readTextIfExists(filePath: string): Promise<string | null> {
  try {
    return await fs.readFile(filePath, 'utf-8')
  } catch (error) {
    const code = (error as NodeJS.ErrnoException).code
    if (code === 'ENOENT') return null
    throw error
  }
}

function asArray(value: unknown): unknown[] {
  if (Array.isArray(value)) return value
  if (isRecord(value) && Array.isArray(value.items)) return value.items
  return []
}

function asObject(value: unknown): Record<string, unknown> {
  return isRecord(value) ? value : {}
}

function withoutMessages(session: SessionLike): Record<string, unknown> {
  const { messages: _messages, ...metadata } = session
  return metadata
}

function buildSessionMemories(sessionId: string, state: Record<string, unknown>): unknown[] {
  const globalMemories = Array.isArray(state.globalMemories) ? state.globalMemories : []
  return globalMemories.filter((entry) => isRecord(entry) && entry.scope === 'session' && entry.source === sessionId)
}

function reserveDocumentName(usedNamesByDirectory: Map<string, Set<string>>, directory: string, desiredName: string): string {
  const usedNames = usedNamesByDirectory.get(directory) ?? new Set<string>()
  usedNamesByDirectory.set(directory, usedNames)

  const extensionIndex = desiredName.lastIndexOf('.')
  const baseName = extensionIndex > 0 ? desiredName.slice(0, extensionIndex) : desiredName
  const extension = extensionIndex > 0 ? desiredName.slice(extensionIndex) : ''
  let nextName = desiredName
  let counter = 2

  while (usedNames.has(nextName.toLowerCase())) {
    nextName = `${baseName}-${counter}${extension}`
    counter += 1
  }

  usedNames.add(nextName.toLowerCase())
  return nextName
}

function buildDocumentGroupPaths(groups: DocumentGroupLike[]): Map<string, DocumentGroupPath> {
  const paths = new Map<string, DocumentGroupPath>()
  const usedNamesByDirectory = new Map<string, Set<string>>()

  for (const group of groups) {
    const groupName = safeDocumentSegment(typeof group.name === 'string' ? group.name : group.id, safeSegment(group.id))
    const groupDirectoryName = reserveDocumentName(usedNamesByDirectory, 'documents', groupName)
    paths.set(group.id, {
      documentDirectory: path.posix.join('documents', groupDirectoryName),
      indexPath: path.posix.join('documents/indexes', `${groupDirectoryName}-index.json`),
    })
  }

  return paths
}

function withoutDocumentGroupStorageFields(group: unknown): unknown {
  if (!isRecord(group)) return group
  const { indexPath: _indexPath, ...metadata } = group
  return metadata
}

function buildDocumentStoragePlan(state: Record<string, unknown>): DocumentStoragePlan {
  const groups = Array.isArray(state.documentGroups) ? state.documentGroups.filter(isEntity) as DocumentGroupLike[] : []
  const nodes = Array.isArray(state.documentNodes) ? state.documentNodes.filter(isEntity) as DocumentNodeLike[] : []
  const nodesByParent = new Map<string | null, DocumentNodeLike[]>()
  const nodeById = new Map(nodes.map((node) => [node.id, node]))

  for (const node of nodes) {
    const parentId = typeof node.parentId === 'string' && nodeById.has(node.parentId) ? node.parentId : null
    const siblings = nodesByParent.get(parentId)
    if (siblings) siblings.push(node)
    else nodesByParent.set(parentId, [node])
  }

  const groupDirectoryById = new Map<string, string>()
  const groupIndexPathById = new Map<string, string>()
  const nodePathById = new Map<string, string>()
  const usedNamesByDirectory = new Map<string, Set<string>>()
  const indexNodesByGroupId = new Map<string, unknown[]>()
  const directories = new Set<string>()
  const files: DocumentStoragePlan['files'] = []
  const visitedNodeIds = new Set<string>()
  const groupPaths = buildDocumentGroupPaths(groups)

  for (const group of groups) {
    const groupPath = groupPaths.get(group.id)
    if (!groupPath) continue
    groupDirectoryById.set(group.id, groupPath.documentDirectory)
    groupIndexPathById.set(group.id, typeof group.indexPath === 'string' ? group.indexPath : groupPath.indexPath)
    indexNodesByGroupId.set(group.id, [])
    directories.add(groupPath.documentDirectory)
  }

  const visitNode = (node: DocumentNodeLike, fallbackGroupId: string | null): void => {
    if (visitedNodeIds.has(node.id)) return
    visitedNodeIds.add(node.id)

    const groupId = typeof node.groupId === 'string' ? node.groupId : fallbackGroupId
    if (!groupId) return

    const groupDirectory = groupDirectoryById.get(groupId) ?? path.posix.join('documents', safeDocumentSegment(groupId, safeSegment(groupId)))
    const indexNodes = indexNodesByGroupId.get(groupId) ?? []
    indexNodesByGroupId.set(groupId, indexNodes)
    const parentId = typeof node.parentId === 'string' ? node.parentId : null
    const parentNode = parentId ? nodeById.get(parentId) : null
    const parentDirectory = parentNode && parentNode.groupId === groupId
      ? (nodePathById.get(parentNode.id) ?? groupDirectory)
      : groupDirectory
    const title = typeof node.title === 'string' && node.title.trim() ? node.title : node.id
    const baseName = safeDocumentSegment(stripMarkdownExtension(title), safeSegment(node.id))

    if (node.type === 'folder') {
      const directoryName = reserveDocumentName(usedNamesByDirectory, parentDirectory, baseName)
      const relativePath = path.posix.join(parentDirectory, directoryName)
      nodePathById.set(node.id, relativePath)
      directories.add(relativePath)
      indexNodes.push({ ...node, groupId, parentId: parentNode && parentNode.groupId === groupId ? parentId : null, path: relativePath })

      for (const child of nodesByParent.get(node.id) ?? []) visitNode(child, groupId)
      return
    }

    if (node.type === 'document') {
      const fileName = reserveDocumentName(usedNamesByDirectory, parentDirectory, `${baseName}.md`)
      const relativePath = path.posix.join(parentDirectory, fileName)
      const { markdown: _markdown, ...metadata } = node
      indexNodes.push({ ...metadata, groupId, parentId: parentNode && parentNode.groupId === groupId ? parentId : null, filePath: relativePath })
      files.push({ relativePath, content: typeof node.markdown === 'string' ? node.markdown : '' })
    }
  }

  for (const group of groups) {
    for (const node of nodes.filter((item) => item.groupId === group.id && !item.parentId)) visitNode(node, group.id)
  }
  for (const node of nodes) visitNode(node, typeof node.groupId === 'string' ? node.groupId : null)

  return {
    index: {
      groups: groups.map((group) => ({ ...group, indexPath: groupIndexPathById.get(group.id) ?? path.posix.join('documents/indexes', `${safeDocumentSegment(group.id, safeSegment(group.id))}-index.json`) })),
      selectedGroupId: typeof state.selectedDocumentGroupId === 'string' ? state.selectedDocumentGroupId : null,
      selectedDocumentId: typeof state.selectedDocumentId === 'string' ? state.selectedDocumentId : null,
    },
    groupIndexes: groups.map((group) => ({
      relativePath: groupIndexPathById.get(group.id) ?? path.posix.join('documents/indexes', `${safeDocumentSegment(group.id, safeSegment(group.id))}-index.json`),
      content: { groupId: group.id, nodes: indexNodesByGroupId.get(group.id) ?? [] },
    })),
    directories: Array.from(directories),
    files,
  }
}

function splitSettingsState(state: Record<string, unknown>, version: number): Record<string, unknown> {
  const settings: Record<string, unknown> = { _storageVersion: SUORA_STORAGE_VERSION, _storeVersion: version }
  for (const [key, value] of Object.entries(state)) {
    if (!SETTINGS_EXCLUDED_KEYS.has(key)) settings[key] = value
  }
  if (isEntity(state.selectedAgent)) settings.selectedAgentId = state.selectedAgent.id
  if ('agentPipeline' in state) settings.agentPipeline = state.agentPipeline
  if ('agentPipelineName' in state) settings.agentPipelineName = state.agentPipelineName
  if ('selectedAgentPipelineId' in state) settings.selectedAgentPipelineId = state.selectedAgentPipelineId
  return settings
}

function splitModelState(state: Record<string, unknown>): Record<string, unknown> {
  const models: Record<string, unknown> = { _storageVersion: SUORA_STORAGE_VERSION }
  for (const key of MODEL_STATE_KEYS) {
    if (key in state) models[key] = state[key]
  }
  return models
}

function parsePersistedStore(value: string): PersistedPayload {
  const parsed = safeParse<PersistedPayload>(value)
  if (!isRecord(parsed.state)) return parsed
  return parsed
}

export function getDatabasePath(workspacePath: string): string {
  return path.resolve(workspacePath)
}

export class SuoraDatabase {
  readonly path: string

  constructor(workspacePath: string) {
    this.path = path.resolve(workspacePath)
  }

  get schemaVersion(): number {
    return SUORA_STORAGE_VERSION
  }

  async initialize(): Promise<void> {
    await fs.mkdir(this.path, { recursive: true })
    await Promise.all(TOP_LEVEL_DIRECTORIES.map((directory) => fs.mkdir(path.join(this.path, directory), { recursive: true })))
    await this.ensureJsonFile('settings.json', { _storageVersion: SUORA_STORAGE_VERSION, _storeVersion: 0 })
    await this.ensureJsonFile('models.json', { _storageVersion: SUORA_STORAGE_VERSION })
    await this.ensureJsonFile('sessions/index.json', { sessions: [], activeSessionId: null, openSessionTabs: [] })
    await this.ensureJsonFile('timers/index.json', [])
    await this.ensureJsonFile('pipelines/index.json', [])
    await this.ensureJsonFile('agents/index.json', [])
    await this.ensureJsonFile('skills/index.json', [])
    await this.ensureJsonFile('documents/index.json', { groups: [], selectedGroupId: null, selectedDocumentId: null })
    await this.ensureJsonFile('channels/index.json', [])
    await this.ensureJsonFile('memories/index.json', [])
    await this.ensureJsonFile('mcp/index.json', [])
    await this.migrateLegacyLayout()
  }

  private file(relativePath: string): string {
    return path.join(this.path, relativePath)
  }

  private async ensureJsonFile(relativePath: string, defaultValue: unknown): Promise<void> {
    const filePath = this.file(relativePath)
    if (!(await pathExists(filePath))) await writeJson(filePath, defaultValue)
  }

  async persist(): Promise<void> {
    // File-backed storage is persisted eagerly by each write.
  }

  async close(): Promise<void> {
    await this.persist()
  }

  async saveStateSlice(key: string, value: unknown): Promise<void> {
    const settings = await readJson<Record<string, unknown>>(this.file('settings.json'), {})
    settings[key] = value
    settings._storageVersion = SUORA_STORAGE_VERSION
    await writeJson(this.file('settings.json'), settings)
  }

  async getPersistedStore(key: string): Promise<string | null> {
    if (key !== SPLIT_STORE_NAME) {
      const settings = await readJson<Record<string, unknown>>(this.file('settings.json'), {})
      const stores = asObject(settings._persistedStores)
      return typeof stores[key] === 'string' ? stores[key] : null
    }

    const state = await this.loadSplitState()
    if (Object.keys(state).length === 0) return null
    const version = typeof state._storeVersion === 'number' ? state._storeVersion : 0
    delete state._storeVersion
    return safeStringify({ state, version })
  }

  async savePersistedStore(key: string, serializedValue: string, version: number): Promise<void> {
    // Renderer persistence writes this value via safeStringify; split-store
    // payloads are parsed below when they are decomposed into workspace files.
    if (key !== SPLIT_STORE_NAME) {
      const settings = await readJson<Record<string, unknown>>(this.file('settings.json'), {})
      const stores = asObject(settings._persistedStores)
      stores[key] = serializedValue
      settings._persistedStores = stores
      await writeJson(this.file('settings.json'), settings)
      return
    }

    const parsed = parsePersistedStore(serializedValue)
    if (!isRecord(parsed.state)) return
    await this.saveSplitState(parsed.state, Number.isFinite(version) ? Math.trunc(version) : (parsed.version ?? 0))
  }

  async deletePersistedStore(key: string): Promise<void> {
    if (key !== SPLIT_STORE_NAME) {
      const settings = await readJson<Record<string, unknown>>(this.file('settings.json'), {})
      const stores = asObject(settings._persistedStores)
      delete stores[key]
      settings._persistedStores = stores
      await writeJson(this.file('settings.json'), settings)
      return
    }

    await Promise.all([
      writeJson(this.file('settings.json'), { _storageVersion: SUORA_STORAGE_VERSION, _storeVersion: 0 }),
      writeJson(this.file('models.json'), { _storageVersion: SUORA_STORAGE_VERSION }),
      writeJson(this.file('sessions/index.json'), { sessions: [], activeSessionId: null, openSessionTabs: [] }),
      writeJson(this.file('agents/index.json'), []),
      writeJson(this.file('channels/index.json'), []),
      writeJson(this.file('documents/index.json'), { groups: [], selectedGroupId: null, selectedDocumentId: null }),
      this.clearEntityDirectory('documents/indexes'),
      writeJson(this.file('memories/index.json'), []),
      writeJson(this.file('mcp/index.json'), []),
      this.clearEntityDirectory('timers/executions'),
      this.clearEntityDirectory('pipelines/executions'),
    ])
  }

  async listJsonTable(table: JsonTableName): Promise<unknown[]> {
    assertJsonTable(table)
    if (table === 'models') return asArray((await readJson<Record<string, unknown>>(this.file('models.json'), {})).models)
    if (table === 'provider_configs') return asArray((await readJson<Record<string, unknown>>(this.file('models.json'), {})).providerConfigs)

    const directoryPath = TABLE_DIRECTORIES[table]
    if (directoryPath) return await this.readEntityDirectory(directoryPath)

    const relativePath = TABLE_FILES[table]
    if (!relativePath) return []
    return asArray(await readJson<unknown>(this.file(relativePath), []))
  }

  async saveJsonEntity(table: JsonTableName, id: string, value: unknown): Promise<void> {
    assertJsonTable(table)
    if (table === 'models' || table === 'provider_configs') {
      const models = await readJson<Record<string, unknown>>(this.file('models.json'), {})
      const key = table === 'models' ? 'models' : 'providerConfigs'
      const items = asArray(models[key]).filter((entry) => !(isEntity(entry) && entry.id === id))
      models[key] = [value, ...items]
      models._storageVersion = SUORA_STORAGE_VERSION
      await writeJson(this.file('models.json'), models)
      return
    }

    const directoryPath = TABLE_DIRECTORIES[table]
    if (directoryPath) {
      await fs.mkdir(this.file(directoryPath), { recursive: true })
      await writeJson(this.file(path.join(directoryPath, `${safeSegment(id)}.json`)), value)
      return
    }

    const relativePath = TABLE_FILES[table]
    if (!relativePath) throw new Error(`Unsupported storage table: ${table}`)
    const items = asArray(await readJson<unknown>(this.file(relativePath), []))
      .filter((entry) => !(isEntity(entry) && entry.id === id))
    await writeJson(this.file(relativePath), [value, ...items])
  }

  async deleteJsonEntity(table: JsonTableName, id: string): Promise<void> {
    assertJsonTable(table)
    if (table === 'models' || table === 'provider_configs') {
      const models = await readJson<Record<string, unknown>>(this.file('models.json'), {})
      const key = table === 'models' ? 'models' : 'providerConfigs'
      models[key] = asArray(models[key]).filter((entry) => !(isEntity(entry) && entry.id === id))
      await writeJson(this.file('models.json'), models)
      return
    }

    const directoryPath = TABLE_DIRECTORIES[table]
    if (directoryPath) {
      const filePath = this.file(path.join(directoryPath, `${safeSegment(id)}.json`))
      try {
        await fs.unlink(filePath)
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error
      }
      return
    }

    const relativePath = TABLE_FILES[table]
    if (!relativePath) throw new Error(`Unsupported storage table: ${table}`)
    const items = asArray(await readJson<unknown>(this.file(relativePath), []))
      .filter((entry) => !(isEntity(entry) && entry.id === id))
    await writeJson(this.file(relativePath), items)
  }

  private async readEntityDirectory(relativeDir: string): Promise<unknown[]> {
    const dirPath = this.file(relativeDir)
    let entries: string[]
    try {
      entries = await fs.readdir(dirPath)
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') return []
      throw error
    }
    const files = entries.filter((name) => name.endsWith('.json'))
    const records = await Promise.all(files.map(async (name) => {
      try {
        return safeParse(await fs.readFile(path.join(dirPath, name), 'utf-8')) as unknown
      } catch {
        return null
      }
    }))
    return records.filter((entry) => entry !== null)
  }

  private async readDocumentNodesFromGroupIndexes(documentIndex: Record<string, unknown>, groups: DocumentGroupLike[]): Promise<unknown[]> {
    const groupPaths = buildDocumentGroupPaths(groups)
    const groupNodes = await Promise.all(groups.map(async (group) => {
      const indexPath = typeof group.indexPath === 'string' ? group.indexPath : groupPaths.get(group.id)?.indexPath
      if (!indexPath) return []

      const groupIndex = asObject(await readJson<unknown>(this.file(indexPath), {}))
      return asArray(groupIndex.nodes)
    }))
    const nodes = groupNodes.flat()
    if (nodes.length > 0) return nodes
    return asArray(documentIndex.nodes)
  }

  private async readStoredDocumentPaths(): Promise<{ files: Set<string>; directories: Set<string> }> {
    const documentIndex = asObject(await readJson<unknown>(this.file('documents/index.json'), {}))
    const groups = asArray(documentIndex.groups).filter(isEntity) as DocumentGroupLike[]
    const nodes = await this.readDocumentNodesFromGroupIndexes(documentIndex, groups)
    const groupPaths = buildDocumentGroupPaths(groups)
    const files = new Set<string>()
    const directories = new Set<string>()

    for (const group of groups) {
      const groupDirectory = groupPaths.get(group.id)?.documentDirectory
      const normalized = groupDirectory ? normalizeDocumentDirectoryPath(groupDirectory) : null
      if (normalized) directories.add(normalized)
    }

    for (const node of nodes) {
      if (!isRecord(node)) continue
      if (node.type === 'document' && typeof node.filePath === 'string') {
        const normalized = normalizeDocumentContentFilePath(node.filePath)
        if (normalized) files.add(normalized)
      }
      if (node.type === 'folder' && typeof node.path === 'string') {
        const normalized = normalizeDocumentDirectoryPath(node.path)
        if (normalized) directories.add(normalized)
      }
    }

    return { files, directories }
  }

  private async cleanupStaleDocumentPaths(previous: { files: Set<string>; directories: Set<string> }, current: DocumentStoragePlan): Promise<void> {
    const currentFiles = new Set(current.files.map((file) => normalizeDocumentContentFilePath(file.relativePath)).filter((file): file is string => Boolean(file)))
    const currentDirectories = new Set(current.directories.map((directory) => normalizeDocumentDirectoryPath(directory)).filter((directory): directory is string => Boolean(directory)))
    const staleFiles = Array.from(previous.files).filter((file) => !currentFiles.has(file))
    const staleDirectories = Array.from(previous.directories)
      .filter((directory) => !currentDirectories.has(directory))
      .sort((first, second) => second.length - first.length)

    await Promise.all(staleFiles.map((file) => fs.unlink(this.file(file)).catch((error) => {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error
    })))

    for (const directory of staleDirectories) {
      await fs.rmdir(this.file(directory)).catch((error) => {
        const code = (error as NodeJS.ErrnoException).code
        if (code !== 'ENOENT' && code !== 'ENOTEMPTY') throw error
      })
    }
  }

  async getSnapshot(): Promise<Record<string, unknown>> {
    return {
      schemaVersion: this.schemaVersion,
      settings: await readJson<Record<string, unknown>>(this.file('settings.json'), {}),
      providerConfigs: await this.listJsonTable('provider_configs'),
      models: await this.listJsonTable('models'),
      agents: await this.listJsonTable('agents'),
      skills: await this.listJsonTable('skills'),
      channels: await this.listJsonTable('channels'),
      channelMessages: await this.listJsonTable('channel_messages'),
      documents: await readJson<unknown>(this.file('documents/index.json'), { groups: [], selectedGroupId: null, selectedDocumentId: null }),
      documentIndexes: await this.readEntityDirectory('documents/indexes'),
      mcpServers: await this.listJsonTable('mcp_servers'),
      timers: await this.listJsonTable('timers'),
      timerExecutions: await this.listJsonTable('timer_executions'),
      pipelines: await this.listJsonTable('pipelines'),
      pipelineExecutions: await this.listJsonTable('pipeline_executions'),
      memories: await this.listJsonTable('memories'),
    }
  }

  private async saveSplitState(state: Record<string, unknown>, version: number): Promise<void> {
    await this.initialize()
    const previousDocumentPaths = await this.readStoredDocumentPaths()
    const documentStoragePlan = buildDocumentStoragePlan(state)

    const sessions = Array.isArray(state.sessions) ? state.sessions.filter(isEntity) as SessionLike[] : []
    const sessionIndex = {
      sessions: sessions.map(withoutMessages),
      activeSessionId: typeof state.activeSessionId === 'string' ? state.activeSessionId : null,
      openSessionTabs: Array.isArray(state.openSessionTabs) ? state.openSessionTabs : [],
    }

    await writeJson(this.file('sessions/index.json'), sessionIndex)
    await this.pruneChildDirectories('sessions', new Set(sessions.map((session) => safeSegment(session.id))))
    await Promise.all(sessions.map(async (session) => {
      const sessionDir = this.file(path.join('sessions', safeSegment(session.id)))
      await fs.mkdir(sessionDir, { recursive: true })
      await writeJson(path.join(sessionDir, 'conversation.json'), { messages: Array.isArray(session.messages) ? session.messages : [] })
      await writeJson(path.join(sessionDir, 'memories.json'), buildSessionMemories(session.id, state))
    }))

    const agents = Array.isArray(state.agents) ? state.agents.filter(isEntity) as AgentLike[] : []
    await writeJson(this.file('agents/index.json'), agents)
    await this.pruneChildDirectories('agents', new Set(agents.map((agent) => safeSegment(agent.id))))
    await Promise.all(agents.map(async (agent) => {
      const agentDir = this.file(path.join('agents', safeSegment(agent.id)))
      await fs.mkdir(agentDir, { recursive: true })
      await writeJson(path.join(agentDir, 'memories.json'), Array.isArray(agent.memories) ? agent.memories : [])
    }))

    await this.pruneChildFiles('documents/indexes', new Set(documentStoragePlan.groupIndexes.map((index) => path.posix.basename(index.relativePath))))
    await Promise.all(documentStoragePlan.directories.map((directory) => fs.mkdir(this.file(directory), { recursive: true })))

    await Promise.all([
      writeJson(this.file('models.json'), splitModelState(state)),
      writeJson(this.file('settings.json'), splitSettingsState(state, version)),
      writeJson(this.file('skills/index.json'), Array.isArray(state.skills) ? state.skills : []),
      writeJson(this.file('skills/versions.json'), Array.isArray(state.skillVersions) ? state.skillVersions : []),
      writeJson(this.file('channels/index.json'), Array.isArray(state.channels) ? state.channels : []),
      writeJson(this.file('channels/messages.json'), Array.isArray(state.channelMessages) ? state.channelMessages : []),
      writeJson(this.file('channels/tokens.json'), isRecord(state.channelTokens) ? state.channelTokens : {}),
      writeJson(this.file('channels/health.json'), isRecord(state.channelHealth) ? state.channelHealth : {}),
      writeJson(this.file('channels/users.json'), isRecord(state.channelUsers) ? state.channelUsers : {}),
      writeJson(this.file('documents/index.json'), documentStoragePlan.index),
      ...documentStoragePlan.groupIndexes.map((index) => writeJson(this.file(index.relativePath), index.content)),
      ...documentStoragePlan.files.map((file) => atomicWriteFile(this.file(file.relativePath), file.content)),
      writeJson(this.file('memories/index.json'), Array.isArray(state.globalMemories) ? state.globalMemories : []),
      writeJson(this.file('pipelines/index.json'), Array.isArray(state.agentPipelines) ? state.agentPipelines : []),
      writeJson(this.file('mcp/index.json'), Array.isArray(state.mcpServers) ? state.mcpServers : []),
    ])
    await this.cleanupStaleDocumentPaths(previousDocumentPaths, documentStoragePlan)
  }

  private async loadSplitState(): Promise<Record<string, unknown>> {
    await this.initialize()
    const settings = await readJson<Record<string, unknown>>(this.file('settings.json'), {})
    const models = await readJson<Record<string, unknown>>(this.file('models.json'), {})
    const documentIndex = asObject(await readJson<unknown>(this.file('documents/index.json'), {}))
    const rawDocumentGroups = asArray(documentIndex.groups)
    const documentGroupRecords = rawDocumentGroups.filter(isEntity) as DocumentGroupLike[]
    const indexedDocumentNodes = await this.readDocumentNodesFromGroupIndexes(documentIndex, documentGroupRecords)
    const legacyDocumentNodes = asArray(documentIndex.nodes)
    const rawDocumentNodes = indexedDocumentNodes.length > 0 ? indexedDocumentNodes : legacyDocumentNodes
    const hasDocumentIndexState = rawDocumentGroups.length > 0 || rawDocumentNodes.length > 0 || typeof documentIndex.selectedGroupId === 'string' || typeof documentIndex.selectedDocumentId === 'string'
    const documentGroups = hasDocumentIndexState ? rawDocumentGroups.map(withoutDocumentGroupStorageFields) : asArray(settings.documentGroups)
    const documentNodes = await Promise.all((hasDocumentIndexState ? rawDocumentNodes : asArray(settings.documentNodes)).map(async (node) => {
      if (!isRecord(node) || node.type !== 'document') return node
      const filePath = typeof node.filePath === 'string' ? node.filePath : ''
      const markdown = filePath ? await readTextIfExists(this.file(filePath)) : null
      return { ...node, markdown: typeof markdown === 'string' ? markdown : (typeof node.markdown === 'string' ? node.markdown : '') }
    }))
    const sessionIndexRaw = await readJson<unknown>(this.file('sessions/index.json'), { sessions: [] })
    const sessionIndex = asObject(sessionIndexRaw)
    const sessionMetadata = asArray(sessionIndex.sessions).filter(isEntity) as SessionLike[]
    const sessions = await Promise.all(sessionMetadata.map(async (session) => {
      const sessionDir = this.file(path.join('sessions', safeSegment(session.id)))
      const conversation = await readJsonIfExists<unknown>(path.join(sessionDir, 'conversation.json'))
      const messages = Array.isArray(conversation) ? conversation : asArray(asObject(conversation).messages)
      return { ...session, messages }
    }))

    const rawAgents = await readJson<unknown>(this.file('agents/index.json'), [])
    const agentMetadata = asArray(rawAgents).filter(isEntity) as AgentLike[]
    const agents = await Promise.all(agentMetadata.map(async (agent) => {
      const memories = await readJsonIfExists<unknown[]>(this.file(path.join('agents', safeSegment(agent.id), 'memories.json')))
      return Array.isArray(memories) ? { ...agent, memories } : agent
    }))

    const selectedAgentId = typeof settings.selectedAgentId === 'string' ? settings.selectedAgentId : undefined
    const selectedAgent = selectedAgentId ? agents.find((agent) => agent.id === selectedAgentId) : undefined
    const state: Record<string, unknown> = {
      ...settings,
      ...models,
      sessions,
      activeSessionId: typeof sessionIndex.activeSessionId === 'string' ? sessionIndex.activeSessionId : null,
      openSessionTabs: Array.isArray(sessionIndex.openSessionTabs) ? sessionIndex.openSessionTabs : [],
      agents,
      selectedAgent: selectedAgent ?? null,
      skills: asArray(await readJson<unknown>(this.file('skills/index.json'), [])),
      skillVersions: asArray(await readJson<unknown>(this.file('skills/versions.json'), [])),
      channels: asArray(await readJson<unknown>(this.file('channels/index.json'), [])),
      channelMessages: asArray(await readJson<unknown>(this.file('channels/messages.json'), [])),
      channelTokens: await readJson<Record<string, unknown>>(this.file('channels/tokens.json'), {}),
      channelHealth: await readJson<Record<string, unknown>>(this.file('channels/health.json'), {}),
      channelUsers: await readJson<Record<string, unknown>>(this.file('channels/users.json'), {}),
      documentGroups,
      documentNodes,
      selectedDocumentGroupId: typeof documentIndex.selectedGroupId === 'string'
        ? documentIndex.selectedGroupId
        : (typeof settings.selectedDocumentGroupId === 'string' ? settings.selectedDocumentGroupId : null),
      selectedDocumentId: typeof documentIndex.selectedDocumentId === 'string'
        ? documentIndex.selectedDocumentId
        : (typeof settings.selectedDocumentId === 'string' ? settings.selectedDocumentId : null),
      globalMemories: asArray(await readJson<unknown>(this.file('memories/index.json'), [])),
      agentPipelines: asArray(await readJson<unknown>(this.file('pipelines/index.json'), [])),
      mcpServers: asArray(await readJson<unknown>(this.file('mcp/index.json'), [])),
    }

    state._storeVersion = typeof settings._storeVersion === 'number' ? settings._storeVersion : 0
    delete state._storageVersion
    delete state.selectedAgentId
    delete state._persistedStores
    return state
  }

  private async pruneChildDirectories(parent: string, keepNames: Set<string>): Promise<void> {
    let entries: Array<{ name: string; isDirectory: () => boolean }>
    try {
      entries = await fs.readdir(this.file(parent), { withFileTypes: true })
    } catch {
      return
    }
    await Promise.all(entries
      .filter((entry) => entry.isDirectory() && !keepNames.has(entry.name))
      .map((entry) => fs.rm(this.file(path.join(parent, entry.name)), { recursive: true, force: true })))
  }

  private async clearEntityDirectory(relativeDir: string): Promise<void> {
    const dirPath = this.file(relativeDir)
    let entries: string[]
    try {
      entries = await fs.readdir(dirPath)
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') return
      throw error
    }
    await Promise.all(entries
      .filter((name) => name.endsWith('.json'))
      .map((name) => fs.unlink(path.join(dirPath, name)).catch(() => {})))
  }

  private async pruneChildFiles(parent: string, keepNames: Set<string>): Promise<void> {
    let entries: Array<{ name: string; isFile: () => boolean }>
    try {
      entries = await fs.readdir(this.file(parent), { withFileTypes: true })
    } catch {
      return
    }
    await Promise.all(entries
      .filter((entry) => entry.isFile() && entry.name.endsWith('.json') && !keepNames.has(entry.name))
      .map((entry) => fs.unlink(this.file(path.join(parent, entry.name))).catch(() => {})))
  }

  private async migrateLegacyLayout(): Promise<void> {
    await this.migrateLegacyExecutionsFile('timers/executions.json', 'timers/executions')
    await this.migrateLegacyExecutionsFile('pipelines/executions.json', 'pipelines/executions')
    await this.migrateLegacyMcpServers()
  }

  private async migrateLegacyExecutionsFile(legacyRelative: string, targetDir: string): Promise<void> {
    const legacyPath = this.file(legacyRelative)
    if (!(await pathExists(legacyPath))) return
    try {
      const records = asArray(await readJson<unknown>(legacyPath, []))
      await fs.mkdir(this.file(targetDir), { recursive: true })
      for (const record of records) {
        if (!isEntity(record)) continue
        const filePath = this.file(path.join(targetDir, `${safeSegment(record.id)}.json`))
        if (await pathExists(filePath)) continue
        await writeJson(filePath, record)
      }
      await fs.unlink(legacyPath).catch(() => {})
    } catch {
      // Leave the legacy file in place if migration fails so we can retry on next start.
    }
  }

  private async migrateLegacyMcpServers(): Promise<void> {
    const settingsPath = this.file('settings.json')
    if (!(await pathExists(settingsPath))) return
    let settings: Record<string, unknown>
    try {
      settings = await readJson<Record<string, unknown>>(settingsPath, {})
    } catch {
      return
    }
    if (!('mcpServers' in settings)) return
    const legacy = asArray(settings.mcpServers)
    const targetPath = this.file('mcp/index.json')
    const existing = asArray(await readJson<unknown>(targetPath, []))
    if (existing.length === 0 && legacy.length > 0) {
      await writeJson(targetPath, legacy)
    }
    delete settings.mcpServers
    await writeJson(settingsPath, settings)
  }
}

export async function openSuoraDatabase(workspacePath: string): Promise<SuoraDatabase> {
  const database = new SuoraDatabase(workspacePath)
  await database.initialize()
  return database
}
