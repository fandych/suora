import fs from 'fs/promises'
import path from 'path'

export const SUORA_STORAGE_VERSION = 1
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
  'pipelines',
  'agents',
  'skills',
  'documents',
  'channels',
  'memories',
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
])

const TABLE_FILES: Partial<Record<JsonTableName, string>> = {
  agents: 'agents/index.json',
  skills: 'skills/index.json',
  channels: 'channels/index.json',
  channel_messages: 'channels/messages.json',
  mcp_servers: 'settings.json',
  timers: 'timers/index.json',
  timer_executions: 'timers/executions.json',
  pipelines: 'pipelines/index.json',
  pipeline_executions: 'pipelines/executions.json',
  memories: 'memories/index.json',
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
  await atomicWriteFile(filePath, `${JSON.stringify(value, null, 2)}\n`)
}

async function readJson<T>(filePath: string, fallback: T): Promise<T> {
  try {
    return JSON.parse(await fs.readFile(filePath, 'utf-8')) as T
  } catch (error) {
    const code = (error as NodeJS.ErrnoException).code
    if (code === 'ENOENT') return fallback
    throw error
  }
}

async function readJsonIfExists<T>(filePath: string): Promise<T | null> {
  try {
    return JSON.parse(await fs.readFile(filePath, 'utf-8')) as T
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
  const parsed = JSON.parse(value) as PersistedPayload
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
    await this.ensureJsonFile('documents/index.json', [])
    await this.ensureJsonFile('channels/index.json', [])
    await this.ensureJsonFile('memories/index.json', [])
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

  getStateSlices(): Record<string, unknown> {
    throw new Error('getStateSlices is asynchronous for filesystem storage; use getSnapshot instead')
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
    return JSON.stringify({ state, version })
  }

  async savePersistedStore(key: string, serializedValue: string, version: number): Promise<void> {
    JSON.parse(serializedValue)
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
      writeJson(this.file('memories/index.json'), []),
    ])
  }

  async listJsonTable(table: JsonTableName): Promise<unknown[]> {
    assertJsonTable(table)
    if (table === 'models') return asArray((await readJson<Record<string, unknown>>(this.file('models.json'), {})).models)
    if (table === 'provider_configs') return asArray((await readJson<Record<string, unknown>>(this.file('models.json'), {})).providerConfigs)
    if (table === 'mcp_servers') return asArray((await readJson<Record<string, unknown>>(this.file('settings.json'), {})).mcpServers)

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
    if (table === 'mcp_servers') {
      const settings = await readJson<Record<string, unknown>>(this.file('settings.json'), {})
      settings.mcpServers = [value, ...asArray(settings.mcpServers).filter((entry) => !(isEntity(entry) && entry.id === id))]
      await writeJson(this.file('settings.json'), settings)
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
    if (table === 'mcp_servers') {
      const settings = await readJson<Record<string, unknown>>(this.file('settings.json'), {})
      settings.mcpServers = asArray(settings.mcpServers).filter((entry) => !(isEntity(entry) && entry.id === id))
      await writeJson(this.file('settings.json'), settings)
      return
    }

    const relativePath = TABLE_FILES[table]
    if (!relativePath) throw new Error(`Unsupported storage table: ${table}`)
    const items = asArray(await readJson<unknown>(this.file(relativePath), []))
      .filter((entry) => !(isEntity(entry) && entry.id === id))
    await writeJson(this.file(relativePath), items)
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
      writeJson(this.file('memories/index.json'), Array.isArray(state.globalMemories) ? state.globalMemories : []),
      writeJson(this.file('pipelines/index.json'), Array.isArray(state.agentPipelines) ? state.agentPipelines : []),
    ])
  }

  private async loadSplitState(): Promise<Record<string, unknown>> {
    await this.initialize()
    const settings = await readJson<Record<string, unknown>>(this.file('settings.json'), {})
    const models = await readJson<Record<string, unknown>>(this.file('models.json'), {})
    const sessionIndexRaw = await readJson<unknown>(this.file('sessions/index.json'), { sessions: [] })
    // Accept a bare array for early filesystem prototypes; new writes always use
    // the object form so tab/active-session metadata can live beside the index.
    const sessionIndex = Array.isArray(sessionIndexRaw) ? { sessions: sessionIndexRaw } : asObject(sessionIndexRaw)
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
      globalMemories: asArray(await readJson<unknown>(this.file('memories/index.json'), [])),
      agentPipelines: asArray(await readJson<unknown>(this.file('pipelines/index.json'), [])),
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
}

export async function openSuoraDatabase(workspacePath: string): Promise<SuoraDatabase> {
  const database = new SuoraDatabase(workspacePath)
  await database.initialize()
  return database
}
