// Global state management using Zustand
import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { ActiveModule, Model, Session, Agent, Skill, AgentMemoryEntry, ToolSecuritySettings, MarketplaceSettings, ThemeMode, FontSize, CodeFont, BubbleStyle, ProviderConfig, ExternalDirectoryConfig, ChannelConfig, AppNotification, ModelUsageStats, ChannelHistoryMessage, ChannelAccessToken, ChannelHealthStatus, ChannelUser, PluginInfo, AgentVersion, AgentPerformanceStats, AgentPipeline, AgentPipelineStep, AppLocale, ProxySettings, OnboardingState, SkillVersion, EmailConfig, EnvVariable, MCPServerConfig, MCPServerStatus, DocumentGroup, DocumentFolder, DocumentItem, DocumentNode, AgentSelectionPreference } from '@/types'
import { setLiveStoreAccessor, setLiveStoreWriter } from '@/services/tools'
import { loadExternalResources, syncExternalDirectoryAccess } from '@/services/externalDirectories'
import { loadAllSkills } from '@/services/skillRegistry'
import { setI18nLocale, t } from '@/services/i18n'
import { fileStateStorage, flushPendingSplitStoreWrites } from '@/services/fileStorage'
import { createSessionSlice } from '@/store/slices/sessionSlice'
import { createModelConfigSlice } from '@/store/slices/modelConfigSlice'
import { createUIPreferencesSlice } from '@/store/slices/uiPreferencesSlice'
import { createSafePersistStorage } from '@/services/safePersistStorage'
import { taskFingerprint } from '@/utils/taskFingerprint'

function normalizeAgentMaxTurns(maxTurns: number | undefined): number | undefined {
  if (typeof maxTurns !== 'number' || !Number.isFinite(maxTurns)) return undefined
  return Math.max(2, Math.trunc(maxTurns))
}

function normalizeAgent(agent: Agent): Agent {
  const maxTurns = normalizeAgentMaxTurns(agent.maxTurns)
  const normalizedAgent = agent.enabled === undefined
    ? { ...agent, enabled: true }
    : agent
  return maxTurns === undefined ? normalizedAgent : { ...normalizedAgent, maxTurns }
}

function normalizeAgentPatch(agent: Partial<Agent>): Partial<Agent> {
  if (agent.maxTurns === undefined) return agent
  return { ...agent, maxTurns: normalizeAgentMaxTurns(agent.maxTurns) }
}

// ─── Default general-purpose agent ─────────────────────────────────

const LEGACY_DEFAULT_AGENT_NAME = ['Assistant', '助手']
const LEGACY_DEFAULT_AGENT_WHEN_TO_USE = [
  'General-purpose tasks, Q&A, and any task not better suited for a specialized agent',
  '适合通用任务、问答和任何不更适合专门智能体的任务',
]
const LEGACY_DEFAULT_AGENT_GREETING = [
  'Hi! I\'m your Suora. How can I help you today?',
  '你好，我是你的 Suora。今天想让我帮你处理什么？',
]
const LEGACY_DEFAULT_AGENT_SYSTEM_PROMPT = [
  'You are a helpful, friendly, and knowledgeable AI assistant with access to all available tools and skills. You can help with a wide range of tasks including answering questions, writing, coding, analysis, file operations, sending emails, web searches, running shell commands, managing timers, git operations, and much more. Proactively use the most appropriate tool for each task. When a task can benefit from a tool, use it without hesitation. Be clear and concise in your responses. When you are unsure, say so honestly. If the user speaks in Chinese, reply in Chinese; otherwise match the user\'s language.',
  '你是一个友好、可靠且知识丰富的 AI 助手，可以使用所有可用的工具和技能。你能够协助回答问题、写作、编程、分析、文件操作、发送邮件、网页搜索、执行命令、管理定时任务、进行 Git 操作等各种任务。请主动选择最合适的工具；当任务适合借助工具完成时，不要犹豫。回复时保持清晰和简洁；如果你不确定，请诚实说明。如果用户使用中文，就用中文回复，否则匹配用户的语言。',
]

function buildDefaultAgent(): Agent {
  return {
    id: 'default-assistant',
    name: t('chat.assistant', 'Assistant'),
    avatar: 'agent-robot',
    color: '#6366F1',
    whenToUse: t('agents.defaultAssistantWhenToUse', 'General-purpose tasks, Q&A, and any task not better suited for a specialized agent'),
    systemPrompt: t(
      'agents.defaultAssistantSystemPrompt',
      'You are a helpful, friendly, and knowledgeable AI assistant with access to all available tools and skills. You can help with a wide range of tasks including answering questions, writing, coding, analysis, file operations, sending emails, web searches, running shell commands, managing timers, git operations, and much more. Proactively use the most appropriate tool for each task. When a task can benefit from a tool, use it without hesitation. Be clear and concise in your responses. When you are unsure, say so honestly. If the user speaks in Chinese, reply in Chinese; otherwise match the user\'s language.',
    ),
    modelId: '',
    skills: [],
    temperature: 0.7,
    maxTokens: 4096,
    maxTurns: 30,
    enabled: true,
    greeting: t('chat.defaultAssistantGreeting', 'Hi! I\'m your Suora. How can I help you today?'),
    responseStyle: 'balanced',
    allowedTools: [],
    disallowedTools: [],
    memories: [],
    autoLearn: true,
  }
}

function shouldRefreshBuiltinField(value: string | undefined, legacyValues: string[]) {
  return !value || legacyValues.includes(value)
}

function localizeBuiltinAgent(agent: Agent): Agent {
  if (agent.id !== 'default-assistant') return agent

  const localized = buildDefaultAgent()
  return {
    ...localized,
    ...agent,
    name: shouldRefreshBuiltinField(agent.name, LEGACY_DEFAULT_AGENT_NAME) ? localized.name : agent.name,
    whenToUse: shouldRefreshBuiltinField(agent.whenToUse, LEGACY_DEFAULT_AGENT_WHEN_TO_USE) ? localized.whenToUse : agent.whenToUse,
    systemPrompt: shouldRefreshBuiltinField(agent.systemPrompt, LEGACY_DEFAULT_AGENT_SYSTEM_PROMPT) ? localized.systemPrompt : agent.systemPrompt,
    greeting: shouldRefreshBuiltinField(agent.greeting, LEGACY_DEFAULT_AGENT_GREETING) ? localized.greeting : agent.greeting,
  }
}

const DEFAULT_AGENT: Agent = buildDefaultAgent()

function buildProfessionalAgent(
  id: string,
  name: string,
  avatar: string,
  color: string,
  whenToUse: string,
  systemPrompt: string,
  skills: string[],
  permissionMode: Agent['permissionMode'] = 'default',
  temperature = 0.5,
): Agent {
  return {
    id,
    name,
    avatar,
    color,
    whenToUse,
    systemPrompt,
    modelId: '',
    skills,
    temperature,
    maxTokens: 4096,
    maxTurns: permissionMode === 'plan' ? 12 : 24,
    enabled: true,
    greeting: `Ready for ${name.toLowerCase()} work.`,
    responseStyle: 'balanced',
    allowedTools: [],
    disallowedTools: [],
    permissionMode,
    memories: [],
    autoLearn: true,
  }
}

// ─── All builtin agents ────────────────────────────────────────────

const BUILTIN_AGENTS: Agent[] = [
  DEFAULT_AGENT,
  buildProfessionalAgent(
    'builtin-code-expert',
    'Code Expert',
    'agent-developer',
    '#22C55E',
    'Use for coding, debugging, refactoring, TypeScript, React, Electron, tests, builds, and pull-request implementation work.',
    'You are a senior software engineer. Diagnose code precisely, prefer minimal safe changes, keep tests meaningful, and explain tradeoffs clearly.',
    ['builtin-filesystem', 'builtin-shell', 'builtin-git', 'builtin-code-analysis'],
    'acceptEdits',
    0.35,
  ),
  buildProfessionalAgent(
    'builtin-writer',
    'Writing Strategist',
    'agent-writer',
    '#F59E0B',
    'Use for drafting, rewriting, summarizing, documentation, email, product copy, and narrative structure.',
    'You are an expert writing strategist. Produce clear, audience-aware writing with strong structure, concise edits, and a polished voice.',
    ['builtin-filesystem', 'builtin-web', 'builtin-utilities'],
    'default',
    0.65,
  ),
  buildProfessionalAgent(
    'builtin-researcher',
    'Research Analyst',
    'agent-research',
    '#38BDF8',
    'Use for research, source comparison, market analysis, literature review, synthesis, and citation-heavy answers.',
    'You are a rigorous research analyst. Break questions into sub-questions, compare sources, cite provenance, and flag uncertainty.',
    ['builtin-web', 'builtin-memory', 'builtin-utilities'],
    'default',
    0.45,
  ),
  buildProfessionalAgent(
    'builtin-security-auditor',
    'Security Auditor',
    'agent-security',
    '#EF4444',
    'Use for threat modeling, vulnerability review, dependency risk, secrets, permissions, and secure implementation guidance.',
    'You are a pragmatic security auditor. Identify realistic risks, prioritize exploitability, recommend minimal mitigations, and avoid unsafe instructions.',
    ['builtin-filesystem', 'builtin-code-analysis', 'builtin-web'],
    'plan',
    0.25,
  ),
  buildProfessionalAgent(
    'builtin-data-analyst',
    'Data Analyst',
    'agent-database',
    '#A855F7',
    'Use for data analysis, SQL, spreadsheets, metrics, dashboards, experiment analysis, and statistical interpretation.',
    'You are a data analyst. Validate assumptions, explain methods, write clear queries, summarize findings, and call out data quality issues.',
    ['builtin-filesystem', 'builtin-shell', 'builtin-utilities', 'builtin-memory'],
    'default',
    0.4,
  ),
  buildProfessionalAgent(
    'builtin-devops-expert',
    'DevOps Expert',
    'agent-devops',
    '#14B8A6',
    'Use for CI/CD, deployment, Docker, infrastructure, observability, release automation, and operational troubleshooting.',
    'You are a DevOps expert. Design reliable automation, inspect failures from logs, minimize blast radius, and document rollback paths.',
    ['builtin-shell', 'builtin-filesystem', 'builtin-git', 'builtin-event-automation'],
    'acceptEdits',
    0.35,
  ),
]

function mergeBuiltinAgents(existingAgents: Agent[]): Agent[] {
  const existingIds = new Set(existingAgents.map((agent) => agent.id))
  return [
    ...existingAgents.map((agent) => localizeBuiltinAgent(normalizeAgent(agent))),
    ...BUILTIN_AGENTS.filter((agent) => !existingIds.has(agent.id)),
  ]
}

export interface AppStore {
  // Navigation
  activeModule: ActiveModule
  setActiveModule: (module: ActiveModule) => void

  // Sessions (Chat)
  sessions: Session[]
  activeSessionId: string | null
  openSessionTabs: string[]          // IDs of sessions open as tabs (multi-chat)
  addSession: (session: Session) => void
  updateSession: (id: string, data: Partial<Session>) => void
  removeSession: (id: string) => void
  setActiveSession: (id: string | null) => void
  openSessionTab: (id: string) => void
  closeSessionTab: (id: string) => void

  // Documents
  documentGroups: DocumentGroup[]
  documentNodes: DocumentNode[]
  selectedDocumentGroupId: string | null
  selectedDocumentId: string | null
  addDocumentGroup: (group: DocumentGroup) => void
  updateDocumentGroup: (id: string, data: Partial<DocumentGroup>) => void
  removeDocumentGroup: (id: string) => void
  setSelectedDocumentGroup: (id: string | null) => void
  addDocumentFolder: (folder: DocumentFolder) => void
  addDocument: (document: DocumentItem) => void
  updateDocumentNode: (id: string, data: Partial<DocumentNode>) => void
  removeDocumentNode: (id: string) => void
  setSelectedDocument: (id: string | null) => void

  // Models
  models: Model[]
  selectedModel: Model | null
  setSelectedModel: (model: Model | null) => void
  addModel: (model: Model) => void
  updateModel: (id: string, data: Partial<Model>) => void
  removeModel: (id: string) => void

  // Agents
  agents: Agent[]
  selectedAgent: Agent | null
  addAgent: (agent: Agent) => void
  updateAgent: (id: string, agent: Partial<Agent>) => void
  removeAgent: (id: string) => void
  setSelectedAgent: (agent: Agent | null) => void
  restoreAgentVersion: (versionId: string) => void
  addAgentMemory: (agentId: string, memory: AgentMemoryEntry) => void
  removeAgentMemory: (agentId: string, memoryId: string) => void
  clearAgentMemories: (agentId: string) => void

  // Global memories (cross-session, shared across all sessions)
  globalMemories: AgentMemoryEntry[]
  addGlobalMemory: (memory: AgentMemoryEntry) => void
  removeGlobalMemory: (memoryId: string) => void
  clearGlobalMemories: () => void

  // Skills
  skills: Skill[]
  addSkill: (skill: Skill) => void
  updateSkill: (id: string, skill: Partial<Skill>) => void
  removeSkill: (id: string) => void

  // Provider Configurations (dynamic, multi-model per provider)
  providerConfigs: ProviderConfig[]
  addProviderConfig: (config: ProviderConfig) => void
  updateProviderConfig: (id: string, config: Partial<ProviderConfig>) => void
  removeProviderConfig: (id: string) => void
  setProviderConfigs: (configs: ProviderConfig[]) => void
  syncModelsFromConfigs: () => void

  // External Directories
  externalDirectories: ExternalDirectoryConfig[]
  addExternalDirectory: (dir: ExternalDirectoryConfig) => void
  updateExternalDirectory: (path: string, data: Partial<ExternalDirectoryConfig>) => void
  removeExternalDirectory: (path: string) => void

  // Channels (WeChat, Feishu, DingTalk)
  channels: ChannelConfig[]
  addChannel: (channel: ChannelConfig) => void
  updateChannel: (id: string, data: Partial<ChannelConfig>) => void
  removeChannel: (id: string) => void
  setChannels: (channels: ChannelConfig[]) => void

  // Settings
  workspacePath: string
  setWorkspacePath: (path: string) => void
  apiKeys: Record<string, string>
  setApiKey: (provider: string, key: string) => void
  plugins: Record<string, unknown>
  setPlugin: (name: string, config: unknown) => void
  toolSecurity: ToolSecuritySettings
  setToolSecurity: (data: Partial<ToolSecuritySettings>) => void
  marketplace: MarketplaceSettings
  setMarketplace: (data: Partial<MarketplaceSettings>) => void
  theme: ThemeMode
  setTheme: (mode: ThemeMode) => void
  fontSize: FontSize
  setFontSize: (size: FontSize) => void
  codeFont: CodeFont
  setCodeFont: (font: CodeFont) => void
  bubbleStyle: BubbleStyle
  setBubbleStyle: (style: BubbleStyle) => void
  historyRetentionDays: number
  setHistoryRetentionDays: (days: number) => void
  autoSave: boolean
  setAutoSave: (enabled: boolean) => void
  accentColor: string
  setAccentColor: (color: string) => void
  shortcuts: Record<string, string>
  setShortcut: (action: string, shortcut: string) => void
  resetShortcuts: () => void

  // Notifications
  notifications: AppNotification[]
  addNotification: (notification: AppNotification) => void
  markNotificationRead: (id: string) => void
  markAllNotificationsRead: () => void
  clearNotifications: () => void

  // Model Usage Stats
  modelUsageStats: Record<string, ModelUsageStats>
  recordModelUsage: (modelId: string, promptTokens: number, completionTokens: number, latencyMs?: number, isError?: boolean, error?: string) => void
  clearModelUsageStats: () => void

  // Channel Message History
  channelMessages: ChannelHistoryMessage[]
  addChannelMessage: (msg: ChannelHistoryMessage) => void
  clearChannelMessages: (channelId?: string) => void

  // Channel Access Tokens
  channelTokens: Record<string, ChannelAccessToken>
  setChannelToken: (channelId: string, token: ChannelAccessToken) => void
  removeChannelToken: (channelId: string) => void

  // Channel Health
  channelHealth: Record<string, ChannelHealthStatus>
  setChannelHealth: (channelId: string, health: ChannelHealthStatus) => void

  // Channel Users (multi-user tracking per channel)
  channelUsers: Record<string, ChannelUser>  // key: `${channelId}:${senderId}`
  upsertChannelUser: (user: ChannelUser) => void
  removeChannelUser: (key: string) => void
  clearChannelUsers: (channelId?: string) => void

  // Plugin System
  installedPlugins: PluginInfo[]
  addInstalledPlugin: (plugin: PluginInfo) => void
  updateInstalledPlugin: (id: string, data: Partial<PluginInfo>) => void
  removeInstalledPlugin: (id: string) => void
  pluginTools: Record<string, string[]>  // pluginId → tool names registered
  setPluginTools: (pluginId: string, tools: string[]) => void
  removePluginTools: (pluginId: string) => void

  // MCP System
  mcpServers: MCPServerConfig[]
  addMcpServer: (server: MCPServerConfig) => void
  updateMcpServer: (id: string, data: Partial<MCPServerConfig>) => void
  removeMcpServer: (id: string) => void
  setMcpServerStatus: (id: string, status: MCPServerStatus, error?: string) => void

  // Skill Version Management
  skillVersions: SkillVersion[]
  addSkillVersion: (version: SkillVersion) => void
  removeSkillVersions: (skillId: string) => void

  // Agent Version Management
  agentVersions: AgentVersion[]
  addAgentVersion: (version: AgentVersion) => void
  removeAgentVersions: (agentId: string) => void

  // Agent Performance Stats
  agentPerformance: Record<string, AgentPerformanceStats>
  recordAgentPerformance: (agentId: string, responseTimeMs: number, tokens: number, isError?: boolean) => void
  clearAgentPerformance: () => void
  agentSelectionPreferences: AgentSelectionPreference[]
  recordAgentSelectionPreference: (agentId: string, taskText: string) => void

  // Agent Orchestration Pipeline Draft
  agentPipeline: AgentPipelineStep[]
  setAgentPipeline: (pipeline: AgentPipelineStep[]) => void
  clearAgentPipeline: () => void
  agentPipelineName: string
  setAgentPipelineName: (name: string) => void
  selectedAgentPipelineId: string | null
  setSelectedAgentPipelineId: (id: string | null) => void
  agentPipelines: AgentPipeline[]
  setAgentPipelines: (pipelines: AgentPipeline[]) => void
  addAgentPipeline: (pipeline: AgentPipeline) => void
  updateAgentPipeline: (id: string, pipeline: Partial<AgentPipeline>) => void
  removeAgentPipeline: (id: string) => void

  // i18n
  locale: AppLocale
  setLocale: (locale: AppLocale) => void

  // Proxy Settings
  proxySettings: ProxySettings
  setProxySettings: (settings: Partial<ProxySettings>) => void

  // Onboarding
  onboarding: OnboardingState
  setOnboarding: (data: Partial<OnboardingState>) => void

  // Email Configuration
  emailConfig: EmailConfig
  setEmailConfig: (data: Partial<EmailConfig>) => void

  // Environment Variables
  envVariables: EnvVariable[]
  addEnvVariable: (variable: EnvVariable) => void
  updateEnvVariable: (key: string, data: Partial<EnvVariable>) => void
  removeEnvVariable: (key: string) => void
  setEnvVariables: (variables: EnvVariable[]) => void
}

export const useAppStore = create<AppStore>()(
  persist(
    (set, get, api) => ({
      ...createUIPreferencesSlice(set, get, api),
      ...createSessionSlice(set, get, api),
      ...createModelConfigSlice(set, get, api),

      // Documents
      documentGroups: [],
      documentNodes: [],
      selectedDocumentGroupId: null,
      selectedDocumentId: null,
      addDocumentGroup: (group) => set((state) => ({
        documentGroups: [group, ...state.documentGroups.filter((item) => item.id !== group.id)],
        selectedDocumentGroupId: group.id,
      })),
      updateDocumentGroup: (id, data) => set((state) => ({
        documentGroups: state.documentGroups.map((group) =>
          group.id === id ? { ...group, ...data, updatedAt: Date.now() } : group
        ),
      })),
      removeDocumentGroup: (id) => set((state) => {
        const remainingGroups = state.documentGroups.filter((group) => group.id !== id)
        const remainingNodes = state.documentNodes.filter((node) => node.groupId !== id)
        const selectedDocumentId = state.selectedDocumentId && remainingNodes.some((node) => node.id === state.selectedDocumentId)
          ? state.selectedDocumentId
          : null
        return {
          documentGroups: remainingGroups,
          documentNodes: remainingNodes,
          selectedDocumentGroupId: state.selectedDocumentGroupId === id ? (remainingGroups[0]?.id ?? null) : state.selectedDocumentGroupId,
          selectedDocumentId,
        }
      }),
      setSelectedDocumentGroup: (id) => set((state) => {
        const selectedDocumentId = state.selectedDocumentId && state.documentNodes.some((node) => node.id === state.selectedDocumentId && node.groupId === id)
          ? state.selectedDocumentId
          : null
        return { selectedDocumentGroupId: id, selectedDocumentId }
      }),
      addDocumentFolder: (folder) => set((state) => ({
        documentNodes: [...state.documentNodes.filter((item) => item.id !== folder.id), folder],
      })),
      addDocument: (document) => set((state) => ({
        documentNodes: [...state.documentNodes.filter((item) => item.id !== document.id), document],
        selectedDocumentGroupId: document.groupId,
        selectedDocumentId: document.id,
      })),
      updateDocumentNode: (id, data) => set((state) => ({
        documentNodes: state.documentNodes.map((node) =>
          node.id === id ? ({ ...node, ...data, updatedAt: Date.now() } as DocumentNode) : node
        ),
      })),
      removeDocumentNode: (id) => set((state) => {
        const collectIds = (targetId: string, ids = new Set<string>()) => {
          ids.add(targetId)
          for (const child of state.documentNodes.filter((node) => node.parentId === targetId)) {
            collectIds(child.id, ids)
          }
          return ids
        }
        const idsToRemove = collectIds(id)
        const remainingNodes = state.documentNodes.filter((node) => !idsToRemove.has(node.id))
        return {
          documentNodes: remainingNodes,
          selectedDocumentId: state.selectedDocumentId && idsToRemove.has(state.selectedDocumentId) ? null : state.selectedDocumentId,
        }
      }),
      setSelectedDocument: (id) => set({ selectedDocumentId: id }),

      // Agents (seeded with built-in agents)
      agents: [...BUILTIN_AGENTS],
      selectedAgent: null,
      addAgent: (agent) => set((state) => ({ agents: [...state.agents, normalizeAgent(agent)] })),
      updateAgent: (id, agent) => set((state) => {
        const normalizedPatch = normalizeAgentPatch(agent)
        const agents = state.agents.map((a) => (a.id === id ? normalizeAgent({ ...a, ...normalizedPatch }) : a))
        return {
          agents,
          selectedAgent: state.selectedAgent?.id === id
            ? agents.find((a) => a.id === id) ?? state.selectedAgent
            : state.selectedAgent,
        }
      }),
      restoreAgentVersion: (versionId) => set((state) => {
        const version = state.agentVersions.find((item) => item.id === versionId)
        if (!version) return state
        const current = state.agents.find((agent) => agent.id === version.agentId)
        const restored = normalizeAgent({ ...version.snapshot, memories: current?.memories ?? [] })
        const agents = current
          ? state.agents.map((agent) => agent.id === version.agentId ? restored : agent)
          : [...state.agents, restored]
        return {
          agents,
          selectedAgent: state.selectedAgent?.id === version.agentId ? restored : state.selectedAgent,
          agentVersions: [
            ...state.agentVersions,
            {
              id: `aver-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`,
              agentId: version.agentId,
              version: state.agentVersions.filter((item) => item.agentId === version.agentId).length + 1,
              snapshot: version.snapshot,
              createdAt: Date.now(),
              label: `Rollback to v${version.version}`,
              source: 'rollback' as const,
            },
          ].slice(-200),
        }
      }),
      removeAgent: (id) => {
        set((state) => ({
          agents: state.agents.filter((a) => a.id !== id),
          selectedAgent: state.selectedAgent?.id === id ? null : state.selectedAgent,
          sessions: state.sessions.map((s) =>
            s.agentId === id ? { ...s, agentId: undefined } : s
          ),
        }))
      },
      setSelectedAgent: (agent) => set({ selectedAgent: agent ? normalizeAgent(agent) : null }),
      addAgentMemory: (agentId, memory) => set((state) => ({
        agents: state.agents.map((a) =>
          a.id === agentId ? { ...a, memories: [...(a.memories || []), memory] } : a
        ),
      })),
      removeAgentMemory: (agentId, memoryId) => set((state) => ({
        agents: state.agents.map((a) =>
          a.id === agentId
            ? { ...a, memories: (a.memories || []).filter((m) => m.id !== memoryId) }
            : a
        ),
      })),
      clearAgentMemories: (agentId) => set((state) => ({
        agents: state.agents.map((a) =>
          a.id === agentId ? { ...a, memories: [] } : a
        ),
      })),

      // Global memories
      globalMemories: [],
      addGlobalMemory: (memory) => set((state) => ({
        globalMemories: [...state.globalMemories, memory],
      })),
      removeGlobalMemory: (memoryId) => set((state) => ({
        globalMemories: state.globalMemories.filter((m) => m.id !== memoryId),
      })),
      clearGlobalMemories: () => set({ globalMemories: [] }),

      // Skills (seeded with built-in skills)
      skills: [],
      addSkill: (skill) => set((state) => ({ skills: [...state.skills, skill] })),
      updateSkill: (id, skill) => set((state) => ({
        skills: state.skills.map((s) => (s.id === id ? { ...s, ...skill } : s)),
      })),
      removeSkill: (id) => set((state) => ({
        skills: state.skills.filter((s) => s.id !== id),
      })),

      // External Directories
      externalDirectories: [],
      addExternalDirectory: (dir) => set((state) => ({
        externalDirectories: [...state.externalDirectories, dir],
      })),
      updateExternalDirectory: (path, data) => set((state) => ({
        externalDirectories: state.externalDirectories.map((d) =>
          d.path === path ? { ...d, ...data } : d
        ),
      })),
      removeExternalDirectory: (path) => set((state) => ({
        externalDirectories: state.externalDirectories.filter((d) => d.path !== path),
      })),

      // Channels
      channels: [],
      addChannel: (channel) => set((state) => ({
        channels: [...state.channels, channel],
      })),
      updateChannel: (id, data) => set((state) => ({
        channels: state.channels.map((c) => (c.id === id ? { ...c, ...data } : c)),
      })),
      removeChannel: (id) => set((state) => ({
        channels: state.channels.filter((c) => c.id !== id),
      })),
      setChannels: (channels) => set({ channels }),

      // Notifications
      notifications: [],
      addNotification: (notification) => set((state) => ({
        notifications: [notification, ...state.notifications].slice(0, 100),
      })),
      markNotificationRead: (id) => set((state) => ({
        notifications: state.notifications.map((n) =>
          n.id === id ? { ...n, read: true } : n
        ),
      })),
      markAllNotificationsRead: () => set((state) => ({
        notifications: state.notifications.map((n) => ({ ...n, read: true })),
      })),
      clearNotifications: () => set({ notifications: [] }),

      // Model Usage Stats
      modelUsageStats: {},
      recordModelUsage: (modelId, promptTokens, completionTokens, latencyMs, isError, error) => set((state) => {
        const existing = state.modelUsageStats[modelId] ?? { modelId, callCount: 0, totalPromptTokens: 0, totalCompletionTokens: 0, totalTokens: 0, lastUsed: 0, errorCount: 0, latencies: [] }
        const latencies = Number.isFinite(latencyMs) ? [...(existing.latencies ?? []), latencyMs as number] : (existing.latencies ?? [])
        const retainedLatencies = latencies.length > 60 ? latencies.slice(-50) : latencies
        const avgLatencyMs = retainedLatencies.length ? Math.round(retainedLatencies.reduce((sum, value) => sum + value, 0) / retainedLatencies.length) : existing.avgLatencyMs
        return {
          modelUsageStats: {
            ...state.modelUsageStats,
            [modelId]: {
              modelId,
              callCount: existing.callCount + 1,
              totalPromptTokens: existing.totalPromptTokens + promptTokens,
              totalCompletionTokens: existing.totalCompletionTokens + completionTokens,
              totalTokens: existing.totalTokens + promptTokens + completionTokens,
              lastUsed: Date.now(),
              avgLatencyMs,
              latencies: retainedLatencies,
              errorCount: (existing.errorCount ?? 0) + (isError ? 1 : 0),
              lastError: error || existing.lastError,
            },
          },
        }
      }),
      clearModelUsageStats: () => set({ modelUsageStats: {} }),

      // Channel Message History
      channelMessages: [],
      addChannelMessage: (msg) => set((state) => ({
        channelMessages: [msg, ...state.channelMessages].slice(0, 500),
      })),
      clearChannelMessages: (channelId) => set((state) => ({
        channelMessages: channelId
          ? state.channelMessages.filter((m) => m.channelId !== channelId)
          : [],
      })),

      // Channel Access Tokens
      channelTokens: {},
      setChannelToken: (channelId, token) => set((state) => ({
        channelTokens: { ...state.channelTokens, [channelId]: token },
      })),
      removeChannelToken: (channelId) => set((state) => {
        const { [channelId]: _, ...rest } = state.channelTokens
        return { channelTokens: rest }
      }),

      // Channel Health
      channelHealth: {},
      setChannelHealth: (channelId, health) => set((state) => ({
        channelHealth: { ...state.channelHealth, [channelId]: health },
      })),

      // Channel Users (multi-user tracking)
      channelUsers: {},
      upsertChannelUser: (user) => set((state) => ({
        channelUsers: { ...state.channelUsers, [user.id]: user },
      })),
      removeChannelUser: (key) => set((state) => {
        const { [key]: _, ...rest } = state.channelUsers
        return { channelUsers: rest }
      }),
      clearChannelUsers: (channelId) => set((state) => ({
        channelUsers: channelId
          ? Object.fromEntries(Object.entries(state.channelUsers).filter(([, u]) => u.channelId !== channelId))
          : {},
      })),

      // Plugin System
      installedPlugins: [],
      addInstalledPlugin: (plugin) => set((state) => ({
        installedPlugins: [...state.installedPlugins, plugin],
      })),
      updateInstalledPlugin: (id, data) => set((state) => ({
        installedPlugins: state.installedPlugins.map((p) => p.id === id ? { ...p, ...data } : p),
      })),
      removeInstalledPlugin: (id) => set((state) => ({
        installedPlugins: state.installedPlugins.filter((p) => p.id !== id),
      })),
      pluginTools: {},
      setPluginTools: (pluginId, tools) => set((state) => ({
        pluginTools: { ...state.pluginTools, [pluginId]: tools },
      })),
      removePluginTools: (pluginId) => set((state) => {
        const { [pluginId]: _, ...rest } = state.pluginTools
        return { pluginTools: rest }
      }),

      // MCP System
      mcpServers: [],
      addMcpServer: (server) => set((state) => ({
        mcpServers: [...state.mcpServers, server],
      })),
      updateMcpServer: (id, data) => set((state) => ({
        mcpServers: state.mcpServers.map((s) => (s.id === id ? { ...s, ...data } : s)),
      })),
      removeMcpServer: (id) => set((state) => ({
        mcpServers: state.mcpServers.filter((s) => s.id !== id),
      })),
      setMcpServerStatus: (id, status, error) => set((state) => ({
        mcpServers: state.mcpServers.map((s) =>
          s.id === id
            ? {
                ...s,
                status,
                error: error || undefined,
                lastConnectedAt: status === 'connected' ? Date.now() : s.lastConnectedAt,
              }
            : s
        ),
      })),

      // Skill Version Management
      skillVersions: [],
      addSkillVersion: (version) => set((state) => ({
        skillVersions: [...state.skillVersions, version].slice(-500),
      })),
      removeSkillVersions: (skillId) => set((state) => ({
        skillVersions: state.skillVersions.filter((v) => v.skillId !== skillId),
      })),

      // Agent Version Management
      agentVersions: [],
      addAgentVersion: (version) => set((state) => ({
        agentVersions: [...state.agentVersions, version].slice(-200),
      })),
      removeAgentVersions: (agentId) => set((state) => ({
        agentVersions: state.agentVersions.filter((v) => v.agentId !== agentId),
      })),

      // Agent Performance Stats
      agentPerformance: {},
      recordAgentPerformance: (agentId, responseTimeMs, tokens, isError) => set((state) => {
        const existing = state.agentPerformance[agentId] ?? { agentId, totalCalls: 0, totalTokens: 0, avgResponseTimeMs: 0, responseTimes: [], lastUsed: 0, errorCount: 0 }
        const newTimes = [...existing.responseTimes, responseTimeMs].slice(-50)
        const newAvg = newTimes.reduce((a, b) => a + b, 0) / newTimes.length
        return {
          agentPerformance: {
            ...state.agentPerformance,
            [agentId]: {
              agentId,
              totalCalls: existing.totalCalls + 1,
              totalTokens: existing.totalTokens + tokens,
              avgResponseTimeMs: Math.round(newAvg),
              responseTimes: newTimes,
              lastUsed: Date.now(),
              errorCount: existing.errorCount + (isError ? 1 : 0),
            },
          },
        }
      }),
      clearAgentPerformance: () => set({ agentPerformance: {} }),
      agentSelectionPreferences: [],
      recordAgentSelectionPreference: (agentId, taskText) => set((state) => {
        const fingerprint = taskFingerprint(taskText)
        if (!fingerprint) return state
        const existing = state.agentSelectionPreferences.find((item) => item.agentId === agentId && item.taskFingerprint === fingerprint)
        const next = existing
          ? state.agentSelectionPreferences.map((item) => item === existing ? { ...item, selectedAt: Date.now(), count: item.count + 1 } : item)
          : [{ agentId, taskFingerprint: fingerprint, selectedAt: Date.now(), count: 1 }, ...state.agentSelectionPreferences]
        return { agentSelectionPreferences: next.slice(0, 200) }
      }),

      // Agent Orchestration Pipeline Draft
      agentPipeline: [],
      setAgentPipeline: (agentPipeline) => set({ agentPipeline }),
      clearAgentPipeline: () => set({ agentPipeline: [] }),
      agentPipelineName: '',
      setAgentPipelineName: (agentPipelineName) => set({ agentPipelineName }),
      selectedAgentPipelineId: null,
      setSelectedAgentPipelineId: (selectedAgentPipelineId) => set({ selectedAgentPipelineId }),
      agentPipelines: [],
      setAgentPipelines: (agentPipelines) => set({ agentPipelines }),
      addAgentPipeline: (pipeline) => set((state) => ({
        agentPipelines: [pipeline, ...state.agentPipelines.filter((item) => item.id !== pipeline.id)],
      })),
      updateAgentPipeline: (id, pipeline) => set((state) => ({
        agentPipelines: state.agentPipelines.map((item) => item.id === id ? { ...item, ...pipeline } : item),
      })),
      removeAgentPipeline: (id) => set((state) => ({
        agentPipelines: state.agentPipelines.filter((item) => item.id !== id),
        selectedAgentPipelineId: state.selectedAgentPipelineId === id ? null : state.selectedAgentPipelineId,
      })),

      // i18n
      locale: 'en' as AppLocale,
      setLocale: (locale) => {
        setI18nLocale(locale)
        set((state) => {
          const agents = state.agents.map((agent) => localizeBuiltinAgent(normalizeAgent(agent)))
          const selectedAgent = state.selectedAgent
            ? agents.find((agent) => agent.id === state.selectedAgent?.id) ?? localizeBuiltinAgent(normalizeAgent(state.selectedAgent))
            : null
          return { locale, agents, selectedAgent }
        })
      },

      // Proxy Settings
      proxySettings: { enabled: false, type: 'http', host: '', port: 0 } as ProxySettings,
      setProxySettings: (settings) => set((state) => ({
        proxySettings: { ...state.proxySettings, ...settings },
      })),

      // Onboarding
      onboarding: { completed: false, currentStep: 0, skipped: false } as OnboardingState,
      setOnboarding: (data) => set((state) => ({
        onboarding: { ...state.onboarding, ...data },
      })),

      // Email Configuration
      emailConfig: {
        smtpHost: '',
        smtpPort: 587,
        secure: false,
        username: '',
        password: '',
        fromName: '',
        fromAddress: '',
        enabled: false,
      } as EmailConfig,
      setEmailConfig: (data) => set((state) => ({
        emailConfig: { ...state.emailConfig, ...data },
      })),

      // Environment Variables
      envVariables: [] as EnvVariable[],
      addEnvVariable: (variable) => set((state) => {
        if (state.envVariables.some((v) => v.key === variable.key)) return state
        return { envVariables: [...state.envVariables, variable] }
      }),
      updateEnvVariable: (key, data) => set((state) => ({
        envVariables: state.envVariables.map((v) =>
          v.key === key ? { ...v, ...data, updatedAt: Date.now() } : v
        ),
      })),
      removeEnvVariable: (key) => set((state) => ({
        envVariables: state.envVariables.filter((v) => v.key !== key),
      })),
      setEnvVariables: (variables) => set({ envVariables: variables }),
    }),
    {
      name: 'suora-store',
      version: 20,
      storage: createSafePersistStorage<Record<string, unknown>>(fileStateStorage),
      migrate: (persisted: unknown, version: number) => {
        const state = persisted as Record<string, unknown>
        if (version < 2) {
          // Backfill new Agent fields
          state.agents = ((state.agents || []) as Agent[]).map((a) => ({
            ...a,
            memories: a.memories || [],
            autoLearn: a.autoLearn ?? false,
          }))
          // Backfill new Skill fields
          state.skills = ((state.skills || []) as Skill[]).map((s) => ({
            ...s,
            tools: s.tools || [],
          }))
        }
        if (version < 3) {
          state.toolSecurity = {
            allowedDirectories: [],
            blockedCommands: ['rm -rf', 'del /f /q', 'format', 'shutdown'],
            requireConfirmation: false,
          }
        }
        if (version < 4) {
          state.marketplace = {
            source: 'official',
            privateUrl: '',
          }
        }
        if (version < 5) {
          state.workspacePath = state.workspacePath || ''
        }
        if (version < 7) {
          // Migrate old providerConfigs (Record<string, {apiKey, baseUrl, enabledModels}>) to new ProviderConfig[]
          const oldConfigs = (state.providerConfigs || {}) as Record<string, { apiKey?: string; baseUrl?: string; enabledModels?: string[] }>
          const newConfigs: ProviderConfig[] = []
          const providerTypeMap: Record<string, ProviderConfig['providerType']> = {
            anthropic: 'anthropic',
            openai: 'openai',
            google: 'google',
            ollama: 'ollama',
          }
          if (oldConfigs && typeof oldConfigs === 'object' && !Array.isArray(oldConfigs)) {
            for (const [key, cfg] of Object.entries(oldConfigs)) {
              if (!cfg) continue
              newConfigs.push({
                id: key,
                name: key.charAt(0).toUpperCase() + key.slice(1),
                apiKey: cfg.apiKey || '',
                baseUrl: cfg.baseUrl || '',
                providerType: providerTypeMap[key] || 'openai-compatible',
                models: (cfg.enabledModels || []).map((mid: string) => ({ modelId: mid, name: mid, enabled: true })),
              })
            }
          }
          // Also migrate old customModels
          const oldCustom = (state.customModels || []) as Array<{ provider?: string; modelId?: string; name?: string; apiKey?: string; baseUrl?: string }>
          for (const cm of oldCustom) {
            if (!cm.modelId) continue
            newConfigs.push({
              id: `custom-${cm.modelId}`,
              name: cm.name || cm.modelId,
              apiKey: cm.apiKey || '',
              baseUrl: cm.baseUrl || '',
              providerType: 'openai-compatible',
              models: [{ modelId: cm.modelId, name: cm.name || cm.modelId, enabled: true }],
            })
          }
          state.providerConfigs = newConfigs
          delete state.customModels
        }
        if (version < 8) {
          // Default to no confirmation popups for tool execution
          const sec = state.toolSecurity as { requireConfirmation?: boolean } | undefined
          if (sec) sec.requireConfirmation = false
        }
        if (version < 9) {
          // Add globalMemories array and backfill scope on existing agent memories
          if (!state.globalMemories) state.globalMemories = []
          state.agents = ((state.agents || []) as Agent[]).map((a) => ({
            ...a,
            memories: (a.memories || []).map((m) => ({
              ...m,
              scope: 'session' as const,
            })),
          }))
        }
        if (version < 10) {
          if (!state.channelMessages) state.channelMessages = []
          if (!state.channelTokens) state.channelTokens = {}
          if (!state.channelHealth) state.channelHealth = {}
          if (!state.installedPlugins) state.installedPlugins = []
          if (!state.agentVersions) state.agentVersions = []
          if (!state.agentPerformance) state.agentPerformance = {}
          if (!state.locale) state.locale = 'en'
          if (!state.proxySettings) state.proxySettings = { enabled: false, type: 'http', host: '', port: 0 }
          if (!state.onboarding) state.onboarding = { completed: false, currentStep: 0, skipped: false }
        }
        if (version < 11) {
          if (!state.pluginTools) state.pluginTools = {}
          if (!state.skillVersions) state.skillVersions = []
        }
        if (version < 12) {
          if (!state.emailConfig) state.emailConfig = {
            smtpHost: '', smtpPort: 587, secure: false,
            username: '', password: '', fromName: '', fromAddress: '', enabled: false,
          }
        }
        if (version < 13) {
          if (!state.channelUsers) state.channelUsers = {}
        }
        if (version < 14) {
          // No structural migration needed — new ChannelPlatform values ('wechat_official',
          // 'wechat_miniprogram', 'custom') and optional ChannelConfig fields are additive.
          // Existing channels continue to work as before.
        }
        if (version < 15) {
          if (!state.mcpServers) state.mcpServers = []
        }
        if (version < 16) {
          if (!state.agentPipeline) state.agentPipeline = []
        }
        if (version < 17) {
          if (!state.agentPipelineName) state.agentPipelineName = ''
          if (!('selectedAgentPipelineId' in state)) state.selectedAgentPipelineId = null
          if (!state.agentPipelines) state.agentPipelines = []
        }
        if (version < 18) {
          if (!state.sessions) state.sessions = []
        }
        if (version < 19) {
          if (!state.documentGroups) state.documentGroups = []
          if (!state.documentNodes) state.documentNodes = []
          if (!('selectedDocumentGroupId' in state)) state.selectedDocumentGroupId = null
          if (!('selectedDocumentId' in state)) state.selectedDocumentId = null
        }
        if (version < 20) {
          state.agents = mergeBuiltinAgents((state.agents || []) as Agent[])
          if (!state.agentSelectionPreferences) state.agentSelectionPreferences = []
        }
        return state as Record<string, unknown>
      },
      merge: (persisted, current) => {
        const merged = { ...(current as object), ...(persisted as object) } as AppStore
        setI18nLocale(merged.locale ?? current.locale)
        // Filter out legacy builtin skills from persisted state
        merged.skills = merged.skills.filter((s) => s.type !== 'builtin')
        merged.agents = mergeBuiltinAgents(merged.agents)
        const localizedDefaultAgent = buildDefaultAgent()

        // Ensure default agent always present
        if (!merged.agents.some((a) => a.id === localizedDefaultAgent.id)) {
          merged.agents = [localizedDefaultAgent, ...merged.agents]
          // Auto-select if nothing selected
          if (!merged.selectedAgent) {
            merged.selectedAgent = localizedDefaultAgent
          }
        }

        if (merged.selectedAgent) {
          merged.selectedAgent = merged.agents.find((a) => a.id === merged.selectedAgent?.id)
            ?? normalizeAgent(merged.selectedAgent)
        }

        if (!merged.agentPipelines) {
          merged.agentPipelines = []
        }
        if (!merged.documentGroups) {
          merged.documentGroups = []
        }
        if (!merged.documentNodes) {
          merged.documentNodes = []
        }
        if (!merged.agentSelectionPreferences) {
          merged.agentSelectionPreferences = []
        }

        return merged
      },
      partialize: (state) => ({
        sessions: state.sessions,
        activeSessionId: state.activeSessionId,
        openSessionTabs: state.openSessionTabs,
        documentGroups: state.documentGroups,
        documentNodes: state.documentNodes,
        selectedDocumentGroupId: state.selectedDocumentGroupId,
        selectedDocumentId: state.selectedDocumentId,
        models: state.models,
        selectedModel: state.selectedModel,
        agents: state.agents,
        selectedAgent: state.selectedAgent,
        workspacePath: state.workspacePath,
        providerConfigs: state.providerConfigs,
        externalDirectories: state.externalDirectories,
        channels: state.channels,
        apiKeys: state.apiKeys,
        plugins: state.plugins,
        toolSecurity: state.toolSecurity,
        marketplace: state.marketplace,
        theme: state.theme,
        fontSize: state.fontSize,
        globalMemories: state.globalMemories,
        channelMessages: state.channelMessages,
        channelTokens: state.channelTokens,
        installedPlugins: state.installedPlugins,
        agentVersions: state.agentVersions,
        agentPerformance: state.agentPerformance,
        agentSelectionPreferences: state.agentSelectionPreferences,
        agentPipeline: state.agentPipeline,
        agentPipelineName: state.agentPipelineName,
        selectedAgentPipelineId: state.selectedAgentPipelineId,
        locale: state.locale,
        proxySettings: state.proxySettings,
        onboarding: state.onboarding,
        pluginTools: state.pluginTools,
        mcpServers: state.mcpServers,
        codeFont: state.codeFont,
        bubbleStyle: state.bubbleStyle,
        historyRetentionDays: state.historyRetentionDays,
        autoSave: state.autoSave,
        accentColor: state.accentColor,
        shortcuts: state.shortcuts,
        channelHealth: state.channelHealth,
        channelUsers: state.channelUsers,
        notifications: state.notifications,
        modelUsageStats: state.modelUsageStats,
        emailConfig: state.emailConfig,
        envVariables: state.envVariables,
      }),
    }
  )
)

// Register live store accessor so tools.ts reads fresh state (not stale file cache)
setLiveStoreAccessor(() => useAppStore.getState() as unknown as Record<string, unknown>)
setLiveStoreWriter((updater) => {
  useAppStore.setState((state) => {
    const next = { ...(state as unknown as Record<string, unknown>) }
    updater(next)
    return next as Partial<AppStore>
  })
})

// ─── Standalone async helpers (avoid circular ref in store init) ───

export async function waitForStoreHydration(): Promise<void> {
  if (useAppStore.persist.hasHydrated()) return
  await new Promise<void>((resolve) => {
    const unsubscribe = useAppStore.persist.onFinishHydration(() => {
      unsubscribe()
      resolve()
    })
  })
}

export async function initWorkspacePath(): Promise<string> {
  const state = useAppStore.getState()
  if (state.workspacePath) {
    // Notify main process so fs:* path enforcement is active
    const electron = (window as unknown as { electron?: { invoke: (ch: string, ...args: unknown[]) => Promise<unknown> } }).electron
    if (electron) electron.invoke('workspace:init', state.workspacePath).catch(() => {})
    return state.workspacePath
  }
  const electron = (window as unknown as { electron?: { invoke: (ch: string, ...args: unknown[]) => Promise<unknown> } }).electron
  if (!electron) return ''
  const bootConfig = (await electron.invoke('workspace:getBootConfig')) as { workspacePath?: string }
  const initialPath = typeof bootConfig?.workspacePath === 'string' && bootConfig.workspacePath.trim()
    ? bootConfig.workspacePath
    : (await electron.invoke('system:getDefaultWorkspacePath')) as string
  useAppStore.setState({ workspacePath: initialPath })
  // Notify main process so fs:* path enforcement is active
  await electron.invoke('workspace:init', initialPath).catch(() => {})
  return initialPath
}

export async function loadSessionsFromWorkspace(): Promise<void> {
  const { workspacePath, historyRetentionDays } = useAppStore.getState()
  if (!workspacePath) return
  const currentSessions = useAppStore.getState().sessions
  if (currentSessions.length === 0) return

  const migratedSessions = currentSessions.map((session) => ({
    ...session,
    messages: session.messages.map((msg) => {
      if (!msg.toolCalls?.length) return msg
      const migratedCalls = msg.toolCalls.map((tc) => {
        const raw = tc as unknown as Record<string, unknown>
        if ('args' in raw && !('input' in raw)) {
          const { args, result, ...rest } = raw
          return { ...rest, input: args, output: result }
        }
        return tc
      })
      return { ...msg, toolCalls: migratedCalls }
    }),
  })) as Session[]

  let merged = migratedSessions.sort((a, b) => b.updatedAt - a.updatedAt)

  // Auto-clean expired sessions based on history retention setting
  if (historyRetentionDays > 0) {
    const cutoff = Date.now() - historyRetentionDays * 86400000
    const expired = merged.filter((session) => session.updatedAt < cutoff).map((session) => session.id)
    if (expired.length > 0) {
      const expiredIds = new Set(expired)
      merged = merged.filter((session) => !expiredIds.has(session.id))
    }
  }

  useAppStore.setState((state) => ({
    sessions: merged,
    openSessionTabs: state.openSessionTabs.filter((tabId) => merged.some((session) => session.id === tabId)),
    activeSessionId: state.activeSessionId && merged.some((session) => session.id === state.activeSessionId)
      ? state.activeSessionId
      : (merged[0]?.id ?? null),
  }))
}

export async function loadSettingsFromWorkspace(): Promise<void> {
  useAppStore.getState().syncModelsFromConfigs()
}

export async function saveSettingsToWorkspace(): Promise<boolean> {
  const state = useAppStore.getState()
  if (!state.workspacePath) return false

  try {
    await flushPendingSplitStoreWrites()
    return true
  } catch {
    return false
  }
}

/**
 * Load external skills and agents from configured directories
 */
export async function loadExternalSkillsAndAgents(): Promise<void> {
  const state = useAppStore.getState()
  if (!state.workspacePath) return

  await syncExternalDirectoryAccess(state.externalDirectories, ['~/.suora/skills'])

  const [diskSkills, { skills: externalSkills }] = await Promise.all([
    loadAllSkills(state.workspacePath),
    loadExternalResources(state.externalDirectories),
  ])

  const skillMap = new Map<string, Skill>()
  for (const skill of state.skills) {
    skillMap.set(skill.name.toLowerCase(), skill)
  }
  for (const skill of [...diskSkills, ...externalSkills]) {
    skillMap.set(skill.name.toLowerCase(), skill)
  }

  useAppStore.setState((current) => {
    const agentMap = new Map<string, Agent>()
    for (const agent of current.agents) {
      agentMap.set(agent.id, normalizeAgent(agent))
    }

    const allAgents = Array.from(agentMap.values())
    const selectedAgentId = current.selectedAgent?.id

    return {
      skills: Array.from(skillMap.values()),
      agents: allAgents,
      selectedAgent: selectedAgentId
        ? allAgents.find((agent) => agent.id === selectedAgentId) ?? current.selectedAgent
        : current.selectedAgent,
    }
  })
}
