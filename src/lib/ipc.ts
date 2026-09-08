import type { AgentConfigRecord, AgentDetail, AgentSummary, ChannelConfigRecord, ChannelDetail, ChannelRuntimeState, ChannelSummary, ChatDetail, ChatSummary, DocumentDetail, DocumentGraphEdge, DocumentPageRecord, DocumentSummary, IntegrationConfig, IntegrationDetail, IntegrationExecutionRecord, IntegrationSummary, ProviderConfigRecord, SchedulerDetail, SkillConfigRecord, SkillFileRecord, SkillSummary, VersionOption, WorkflowDefinition, WorkflowDetail, WorkflowInvocationRecord, WorkflowNodeData, WorkflowSummary } from "@/data/domain/models"
import { normalizeChatMessageParts, type ChatMessagePart } from "@/data/domain/chat-message-parts"
import { getVersionLabel } from "@/data/domain/versioning"
import { inferChannelBindingState } from "@/lib/channel-config"
import { buildDefaultDocumentNodes, normalizeDocumentNodes } from "@/lib/document-tree"

type SendMailPayload = {
  to: string
  subject: string
  content: string
}

type RawProviderRow = {
  id: string
  title: string
  providerType: string
  baseUrl: string
  apiKey: string
  modelsJson: string
  enabled: number | boolean
  updatedAt: number
}

type RawChannelRow = {
  id: string
  title: string
  platform: string
  enabled?: number | boolean
  status?: string
  connectionMode?: string
  webhookPath?: string
  webhookSecret?: string
  autoReply?: number | boolean
  replyAgentId?: string
  createdAt?: number
  lastMessageAt?: number | null
  messageCount?: number
  configJson?: string
  runtimeJson?: string
  updatedAt: number
}

type RawChatMessageRow = {
  id: string
  role: "user" | "assistant" | "system"
  content: string
  partsJson?: string
  parts?: ChatMessagePart[]
  createdAt: number
}

type RawChatSummaryRow = {
  id: string
  title: string
  chatbotId: string
  summary: string
  updatedAt: number
  sourceType?: "manual" | "channel"
  sourceRef?: string | null
}

type PreferenceCommandConfirmationMode = "daily" | "never" | "always"

type PreferenceEnvironmentVariable = {
  key: string
  value: string
}

type ToolPreferenceSettings = {
  commandConfirmationMode?: PreferenceCommandConfirmationMode
  globalEnvironmentVariables?: PreferenceEnvironmentVariable[]
}

const COMMAND_CONFIRMATION_STORAGE_KEY = "suora:command-confirmation-last-date"

function parseProviderRow(row: RawProviderRow): ProviderConfigRecord {
  return {
    id: row.id,
    title: row.title,
    providerType: row.providerType,
    baseUrl: row.baseUrl,
    apiKey: row.apiKey,
    enabled: Boolean(row.enabled),
    models: parseArrayJson<ProviderConfigRecord["models"][number]>(row.modelsJson, []),
    updatedAt: row.updatedAt,
  }
}

function createDefaultAgentConfig(): AgentConfigRecord {
  return {
    instructions: "You are a helpful agent.",
    providerId: "provider-openai",
    modelId: "gpt-5",
    maxSteps: 100,
    workflowIds: [],
    skillIds: [],
    toolsetIds: [],
    documentIds: [],
    privateToolIds: [],
  }
}

function parseJson<T>(value: string | null | undefined, fallback: T): T {
  if (!value) {
    return fallback
  }

  const normalized = value.trim()
  if (!normalized || normalized === "undefined" || normalized === "null") {
    return fallback
  }

  try {
    return JSON.parse(normalized) as T
  } catch {
    return fallback
  }
}

function parseObjectJson<T extends Record<string, unknown>>(value: string | null | undefined, fallback: T): T {
  const parsed = parseJson<unknown>(value, fallback)
  return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed as T : fallback
}

function parseArrayJson<T>(value: string | null | undefined, fallback: T[]): T[] {
  const parsed = parseJson<unknown>(value, fallback)
  return Array.isArray(parsed) ? parsed as T[] : fallback
}

function parseChatMessageRow(row: RawChatMessageRow) {
  return {
    id: row.id,
    role: row.role,
    content: row.content,
    parts: normalizeChatMessageParts(row.parts ?? parseJson<ChatMessagePart[]>(row.partsJson, [])),
    createdAt: row.createdAt,
  }
}

function parseChatSummaryRow(row: RawChatSummaryRow): ChatSummary {
  return {
    id: row.id,
    title: row.title,
    chatbotId: row.chatbotId,
    summary: row.summary,
    updatedAt: row.updatedAt,
    sourceType: row.sourceType === "channel" ? "channel" : "manual",
    sourceRef: typeof row.sourceRef === "string" ? row.sourceRef : null,
  }
}

function createDefaultChannelRuntime(): ChannelRuntimeState {
  return {
    messages: [],
    users: [],
    health: {
      isHealthy: null,
      errorCount: 0,
    },
    debugLog: [],
  }
}

function createDefaultChannelConfig(row: RawChannelRow): ChannelConfigRecord {
  return {
    id: row.id,
    title: row.title,
    platform: (row.platform || "web") as ChannelConfigRecord["platform"],
    catalogId: row.id,
    bindingState: "unconfigured",
    enabled: Boolean(row.enabled),
    status: (row.status || "inactive") as ChannelConfigRecord["status"],
    connectionMode: (row.connectionMode || "webhook") as ChannelConfigRecord["connectionMode"],
    webhookPath: row.webhookPath || `/channels/${row.id}`,
    webhookSecret: row.webhookSecret || "",
    autoReply: row.autoReply == null ? true : Boolean(row.autoReply),
    replyAgentId: row.replyAgentId || "",
    createdAt: row.createdAt ?? row.updatedAt,
    updatedAt: row.updatedAt,
    lastMessageAt: row.lastMessageAt ?? undefined,
    messageCount: row.messageCount ?? 0,
    emailFilters: [],
    emailActions: [],
    emailMarkAsRead: true,
    emailUseGlobalMailService: false,
  }
}

function parseChannelDetailRow(row: RawChannelRow): ChannelDetail {
  const baseConfig = createDefaultChannelConfig(row)
  const parsedConfig = parseJson<Partial<ChannelConfigRecord>>(row.configJson, {})
  const parsedRuntime = parseJson<Partial<ChannelRuntimeState>>(row.runtimeJson, {})
  const baseRuntime = createDefaultChannelRuntime()
  const mergedChannel = {
    ...baseConfig,
    ...parsedConfig,
    id: row.id,
    title: row.title,
    platform: (row.platform || parsedConfig.platform || "web") as ChannelConfigRecord["platform"],
    enabled: row.enabled == null ? (parsedConfig.enabled ?? false) : Boolean(row.enabled),
    status: (row.status || parsedConfig.status || "inactive") as ChannelConfigRecord["status"],
    connectionMode: (row.connectionMode || parsedConfig.connectionMode || "webhook") as ChannelConfigRecord["connectionMode"],
    webhookPath: row.webhookPath || parsedConfig.webhookPath || `/channels/${row.id}`,
    webhookSecret: row.webhookSecret || parsedConfig.webhookSecret || "",
    autoReply: row.autoReply == null ? (parsedConfig.autoReply ?? true) : Boolean(row.autoReply),
    replyAgentId: row.replyAgentId || parsedConfig.replyAgentId || "",
    createdAt: row.createdAt ?? parsedConfig.createdAt ?? row.updatedAt,
    updatedAt: row.updatedAt,
    lastMessageAt: row.lastMessageAt ?? parsedConfig.lastMessageAt,
    messageCount: row.messageCount ?? parsedConfig.messageCount ?? 0,
    emailFilters: parsedConfig.emailFilters ?? [],
    emailActions: parsedConfig.emailActions ?? [],
    emailMarkAsRead: parsedConfig.emailMarkAsRead ?? true,
    emailUseGlobalMailService: parsedConfig.emailUseGlobalMailService ?? false,
  } satisfies ChannelConfigRecord

  return {
    channel: {
      ...mergedChannel,
      catalogId: parsedConfig.catalogId || row.id,
      bindingState: parsedConfig.bindingState || inferChannelBindingState(mergedChannel),
    },
    runtime: {
      ...baseRuntime,
      ...parsedRuntime,
      messages: parsedRuntime.messages ?? baseRuntime.messages,
      users: parsedRuntime.users ?? baseRuntime.users,
      debugLog: parsedRuntime.debugLog ?? baseRuntime.debugLog,
      health: {
        ...baseRuntime.health,
        ...(parsedRuntime.health ?? {}),
      },
    },
  }
}

function parseChannelSummaryRow(row: RawChannelRow): ChannelSummary {
  const detail = parseChannelDetailRow(row)
  return {
    id: detail.channel.id,
    title: detail.channel.title,
    platform: detail.channel.platform,
    catalogId: detail.channel.catalogId,
    connectionMode: detail.channel.connectionMode,
    bindingState: detail.channel.bindingState,
    enabled: detail.channel.enabled,
    status: detail.channel.status,
    updatedAt: detail.channel.updatedAt,
    lastMessageAt: detail.channel.lastMessageAt,
    messageCount: detail.channel.messageCount,
    meta: `${detail.channel.platform} · ${detail.channel.connectionMode}`,
    customPlatformName: detail.channel.customPlatformName,
    customPlatformIcon: detail.channel.customPlatformIcon,
  }
}

function normalizeWorkflowNodeData(data: Partial<WorkflowNodeData>, fallback: Pick<WorkflowNodeData, "kind" | "label" | "prompt">): WorkflowNodeData {
  return {
    ...data,
    label: data.label ?? fallback.label,
    prompt: data.prompt ?? fallback.prompt,
    kind: data.kind ?? fallback.kind,
    agentId: data.agentId ?? "",
    task: data.task ?? data.prompt ?? fallback.prompt,
    description: data.description ?? "",
    enabled: data.enabled ?? true,
    continueOnError: data.continueOnError ?? fallback.kind === "start",
    retryCount: data.retryCount ?? 0,
    timeoutMs: data.timeoutMs ?? 30000,
    modelId: data.modelId ?? "",
    runIf: data.runIf ?? "",
    inputTemplate: data.inputTemplate ?? "",
    outputKey: data.outputKey ?? "",
    maxInputChars: data.maxInputChars ?? 8000,
    maxOutputChars: data.maxOutputChars ?? 8000,
    documentId: data.documentId ?? "",
    documentName: data.documentName ?? "",
    queryExpression: data.queryExpression ?? "$input.query",
    resultLimit: data.resultLimit ?? 5,
    integrationId: data.integrationId ?? "",
    integrationName: data.integrationName ?? "",
    method: data.method ?? "POST",
    url: data.url ?? "",
    headersJson: data.headersJson ?? "{}",
    queryJson: data.queryJson ?? "{}",
    bodyJson: data.bodyJson ?? "{}",
    runtime: data.runtime ?? "node",
    script: data.script ?? "export async function main(input) {\n  return { ok: true, input }\n}\n",
    timeoutSeconds: data.timeoutSeconds ?? 60,
    branchCount: data.branchCount ?? 2,
    joinStrategy: data.joinStrategy ?? "wait-all",
    trueLabel: data.trueLabel ?? "True",
    falseLabel: data.falseLabel ?? "False",
    branches: data.branches ?? [
      { id: `${fallback.label}-true`, label: "True", expression: "$input.ok === true" },
      { id: `${fallback.label}-false`, label: "False", expression: "" },
    ],
    variableName: data.variableName ?? "",
    variableValue: data.variableValue ?? "",
    template: data.template ?? "",
    templateOutputFormat: data.templateOutputFormat ?? "text",
    loopExpression: data.loopExpression ?? "$input.items",
    maxIterations: data.maxIterations ?? 25,
    emailTo: data.emailTo ?? "",
    emailSubject: data.emailSubject ?? "",
    emailBody: data.emailBody ?? "",
    systemPrompt: data.systemPrompt ?? "",
    temperature: data.temperature ?? 0.7,
    maxTokens: data.maxTokens ?? 1024,
    responseFormat: data.responseFormat ?? "text",
    inputSchemaJson: data.inputSchemaJson ?? "{}",
    outputSchemaJson: data.outputSchemaJson ?? "{}",
    itemAlias: data.itemAlias ?? "item",
    concurrency: data.concurrency ?? 2,
    mergeStrategy: data.mergeStrategy ?? "all-settled",
    notes: data.notes ?? "",
  }
}

function normalizeWorkflowDefinition(definition: WorkflowDefinition): WorkflowDefinition {
  return {
    ...definition,
    nodes: definition.nodes.map((node, index) => ({
      ...node,
      type: node.type ?? "workflowNode",
      data: normalizeWorkflowNodeData(node.data, {
        kind: node.data.kind ?? "agent",
        label: node.data.label ?? `Step ${index + 1}`,
        prompt: node.data.prompt ?? "Describe what this node should do.",
      }),
    })),
    edges: definition.edges.map((edge) => ({
      ...edge,
      data: {
        condition: edge.data?.condition ?? "",
        successOnly: edge.data?.successOnly ?? false,
      },
    })),
    viewport: definition.viewport ?? { x: 0, y: 0, zoom: 1 },
    resourceBindings: definition.resourceBindings ?? {
      providerId: "provider-openai",
      skillId: "skill-plan",
      documentId: "document-product-manual",
      integrationId: "integration-webhook",
    },
    dryRunInputJson: definition.dryRunInputJson ?? "{\n  \"leadId\": \"LD-1001\"\n}",
    variables: definition.variables ?? [],
    budget: definition.budget ?? { maxSteps: 8, maxDurationMs: 120000 },
  }
}

function getBridge() {
  const bridge = window.suora
  if (!bridge) {
    throw new Error("SUORA IPC bridge is not available.")
  }
  return bridge
}

export function hasSuoraBridge() {
  return typeof window !== "undefined" && Boolean(window.suora)
}

function parseDocumentStructure(structureJson: string | undefined, documentTitle: string) {
  if (!structureJson) {
    return buildDefaultDocumentNodes(documentTitle)
  }

  const parsed = parseObjectJson<{ pages?: DocumentPageRecord[] }>(structureJson, {})
  return normalizeDocumentNodes(parsed.pages ?? [], documentTitle)
}

function parseDocumentGraphEdges(graphJson: string | undefined) {
  const parsed = parseObjectJson<{ edges?: DocumentGraphEdge[] }>(graphJson, {})
  return Array.isArray(parsed.edges) ? parsed.edges : []
}

function parseDocumentSettings(settingsJson: string | undefined) {
  return parseObjectJson<{ isPublic: boolean; includeInLlmsTxt: boolean }>(settingsJson, { isPublic: false, includeInLlmsTxt: true })
}

function parseSkillFiles(filesJson: string | undefined) {
  return parseArrayJson<SkillFileRecord>(filesJson, [])
}

function parseAgentConfig(configJson: string | undefined) {
  return parseObjectJson<AgentConfigRecord>(configJson, createDefaultAgentConfig())
}

function parseIntegrationConfig(configJson: string | undefined): IntegrationConfig {
  return parseObjectJson<IntegrationConfig>(configJson, {
    kind: "http",
    baseUrl: "",
    selectedEndpointId: "",
    endpoints: [],
    method: "GET",
    url: "",
    description: "",
    headersJson: "{}",
    queryJson: "{}",
    bodyJson: "{}",
    authType: "none",
    authConfigJson: "{}",
    parameterSchemaJson: "{}",
  })
}

function parseWorkflowInvocationTraces(traceJson: string | undefined) {
  return parseArrayJson<WorkflowInvocationRecord["traces"][number]>(traceJson, [])
}

export const suoraIpc = {
  system: {
    info: async () => getBridge().system.info(),
    diagnostics: async () => getBridge().system.diagnostics(),
  },
  workspace: {
    getPaths: async () => getBridge().workspace.getPaths(),
    setProxySettings: async (settings: unknown) => getBridge().workspace.setProxySettings(settings),
    getProxySettings: async () => getBridge().workspace.getProxySettings(),
  },
  chats: {
    list: async () => {
      const rows = await getBridge().chats.list() as RawChatSummaryRow[]
      return rows.map(parseChatSummaryRow)
    },
    get: async (chatId: string) => {
      const payload = await getBridge().chats.get(chatId) as { chat: RawChatSummaryRow | null; messages: RawChatMessageRow[] }
      if (!payload.chat) return null
      return { chat: parseChatSummaryRow(payload.chat), messages: payload.messages.map(parseChatMessageRow) } satisfies ChatDetail
    },
    create: async () => {
      const payload = await getBridge().chats.create() as { chat: RawChatSummaryRow; messages: RawChatMessageRow[] }
      return { chat: parseChatSummaryRow(payload.chat), messages: payload.messages.map(parseChatMessageRow) } satisfies ChatDetail
    },
    ensure: async (payload: { chatId: string; title: string; chatbotId: string; summary?: string; sourceType?: "manual" | "channel"; sourceRef?: string | null }) => {
      const result = await getBridge().chats.ensure(payload) as { chat: RawChatSummaryRow | null; messages: RawChatMessageRow[] }
      if (!result.chat) return null
      return { chat: parseChatSummaryRow(result.chat), messages: result.messages.map(parseChatMessageRow) } satisfies ChatDetail
    },
    delete: async (chatId: string) => getBridge().chats.delete(chatId) as Promise<boolean>,
    appendUser: async (chatId: string, content: string, parts?: ChatMessagePart[]) => {
      const payload = await getBridge().chats.appendUser({ chatId, content, parts }) as { chat: RawChatSummaryRow | null; messages: RawChatMessageRow[] } | null
      if (!payload?.chat) return null
      return { chat: parseChatSummaryRow(payload.chat), messages: payload.messages.map(parseChatMessageRow) } satisfies ChatDetail
    },
    appendAssistant: async (chatId: string, content: string, parts?: ChatMessagePart[]) => {
      const payload = await getBridge().chats.appendAssistant({ chatId, content, parts }) as { chat: RawChatSummaryRow | null; messages: RawChatMessageRow[] } | null
      if (!payload?.chat) return null
      return { chat: parseChatSummaryRow(payload.chat), messages: payload.messages.map(parseChatMessageRow) } satisfies ChatDetail
    },
    updateMessageParts: async (chatId: string, messageId: string, parts: ChatMessagePart[]) => {
      const payload = await getBridge().chats.updateMessageParts({ chatId, messageId, parts }) as { chat: RawChatSummaryRow | null; messages: RawChatMessageRow[] } | null
      if (!payload?.chat) return null
      return { chat: parseChatSummaryRow(payload.chat), messages: payload.messages.map(parseChatMessageRow) } satisfies ChatDetail
    },
    getSettings: async () => getBridge().chats.getSettings(),
    saveSettings: async (payload: unknown) => getBridge().chats.saveSettings(payload),
  },
  documents: {
    list: async () => getBridge().documents.list() as Promise<DocumentSummary[]>,
    get: async (documentId: string, versionId?: string) => {
      const payload = await getBridge().documents.get(documentId, versionId) as {
        document: DocumentSummary | null
        versions: Array<{ id: string; major: number; minor: number; isRelease: boolean; createdAt: number; structureJson: string; graphJson: string; settingsJson: string }>
        selectedVersionId: string | null
      }
      if (!payload.document) return null
      const versions = payload.versions.map((version) => ({ ...version, label: getVersionLabel(version) })) as VersionOption[]
      const selectedPayload = payload.versions.find((version) => version.id === payload.selectedVersionId) ?? payload.versions[0]
      return {
        document: payload.document,
        versions,
        latestVersion: versions[0],
        selectedVersion: versions.find((version) => version.id === payload.selectedVersionId) ?? versions[0],
        pages: selectedPayload ? parseDocumentStructure(selectedPayload.structureJson, payload.document.title) : buildDefaultDocumentNodes(payload.document.title),
        graphEdges: selectedPayload ? parseDocumentGraphEdges(selectedPayload.graphJson) : [],
        settings: selectedPayload ? parseDocumentSettings(selectedPayload.settingsJson) : { isPublic: false, includeInLlmsTxt: true },
      } satisfies DocumentDetail
    },
    create: async () => {
      const payload = await getBridge().documents.create() as {
        document: DocumentSummary
        versions: Array<{ id: string; major: number; minor: number; isRelease: boolean; createdAt: number; structureJson: string; graphJson: string; settingsJson: string }>
        selectedVersionId: string
      }
      const versions = payload.versions.map((version) => ({ ...version, label: getVersionLabel(version) })) as VersionOption[]
      const selectedPayload = payload.versions[0]
      return {
        document: payload.document,
        versions,
        latestVersion: versions[0],
        selectedVersion: versions[0],
        pages: parseDocumentStructure(selectedPayload.structureJson, payload.document.title),
        graphEdges: parseDocumentGraphEdges(selectedPayload.graphJson),
        settings: parseDocumentSettings(selectedPayload.settingsJson),
      } satisfies DocumentDetail
    },
    save: async (payload: { id: string; title: string; summary: string; enabled: boolean; pages: DocumentPageRecord[]; graphEdges: DocumentGraphEdge[]; settings: { isPublic: boolean; includeInLlmsTxt: boolean }; selectedVersionId?: string; publish?: boolean }) => {
      const result = await getBridge().documents.save({
        id: payload.id,
        title: payload.title,
        summary: payload.summary,
        enabled: payload.enabled,
        structureJson: JSON.stringify({ pages: payload.pages }),
        graphJson: JSON.stringify({ edges: payload.graphEdges }),
        settingsJson: JSON.stringify(payload.settings),
        selectedVersionId: payload.selectedVersionId,
        publish: payload.publish,
      }) as {
        document: DocumentSummary
        versions: Array<{ id: string; major: number; minor: number; isRelease: boolean; createdAt: number; structureJson: string; graphJson: string; settingsJson: string }>
        selectedVersionId: string | null
      }
      const versions = result.versions.map((version) => ({ ...version, label: getVersionLabel(version) })) as VersionOption[]
      const selectedPayload = result.versions.find((version) => version.id === result.selectedVersionId) ?? result.versions[0]
      return {
        document: result.document,
        versions,
        latestVersion: versions[0],
        selectedVersion: versions.find((version) => version.id === result.selectedVersionId) ?? versions[0],
        pages: parseDocumentStructure(selectedPayload.structureJson, result.document.title),
        graphEdges: parseDocumentGraphEdges(selectedPayload.graphJson),
        settings: parseDocumentSettings(selectedPayload.settingsJson),
      } satisfies DocumentDetail
    },
    delete: async (documentId: string) => getBridge().documents.delete(documentId),
  },
  models: {
    list: async () => {
      const rows = await getBridge().models.list() as RawProviderRow[]
      return rows.map(parseProviderRow)
    },
    get: async (providerId: string) => {
      const row = await getBridge().models.get(providerId) as RawProviderRow | null
      return row ? parseProviderRow(row) : null
    },
    create: async (payload?: Partial<ProviderConfigRecord>) => {
      const row = await getBridge().models.create(payload) as RawProviderRow
      return parseProviderRow(row)
    },
    save: async (provider: ProviderConfigRecord) => {
      const row = await getBridge().models.save({
        id: provider.id,
        title: provider.title,
        providerType: provider.providerType,
        baseUrl: provider.baseUrl,
        apiKey: provider.apiKey,
        modelsJson: JSON.stringify(provider.models),
        enabled: provider.enabled,
      }) as RawProviderRow
      return parseProviderRow(row)
    },
    delete: async (providerId: string) => getBridge().models.delete(providerId),
    discover: async (payload: Pick<ProviderConfigRecord, "providerType" | "baseUrl" | "apiKey">) => {
      return getBridge().models.discover(payload) as Promise<{ models: ProviderConfigRecord["models"]; source: string }>
    },
  },
  skills: {
    list: async () => {
      const rows = await getBridge().skills.list() as Array<{ id: string; title: string; source: string; summary: string; updatedAt: number }>
      return rows as SkillSummary[]
    },
    get: async (skillId: string) => {
      const payload = await getBridge().skills.get(skillId) as {
        skill: { id: string; title: string; source: string; summary: string; updatedAt: number } | null
        versions: Array<{ id: string; major: number; minor: number; isRelease: boolean; createdAt: number; filesJson: string }>
      }
      if (!payload.skill) {
        return null
      }
      const versions = payload.versions.map((version) => ({ ...version, label: getVersionLabel(version) })) as VersionOption[]
      const selectedVersion = versions[0]
      const selectedPayload = payload.versions[0]
      return {
        skill: payload.skill,
        versions,
        latestVersion: versions[0],
        selectedVersion,
        files: selectedPayload ? parseSkillFiles(selectedPayload.filesJson) : [],
      } satisfies SkillConfigRecord
    },
    create: async () => {
      const payload = await getBridge().skills.create() as {
        skill: { id: string; title: string; source: string; summary: string; updatedAt: number }
        versions: Array<{ id: string; major: number; minor: number; isRelease: boolean; createdAt: number; filesJson: string }>
      }
      const versions = payload.versions.map((version) => ({ ...version, label: getVersionLabel(version) })) as VersionOption[]
      return {
        skill: payload.skill,
        versions,
        latestVersion: versions[0],
        selectedVersion: versions[0],
        files: parseSkillFiles(payload.versions[0].filesJson),
      } satisfies SkillConfigRecord
    },
    save: async (payload: { id: string; title: string; source: string; summary: string; files: SkillFileRecord[]; selectedVersionId?: string; publish?: boolean }) => {
      const result = await getBridge().skills.save({ ...payload, filesJson: JSON.stringify(payload.files) }) as {
        skill: { id: string; title: string; source: string; summary: string; updatedAt: number }
        versions: Array<{ id: string; major: number; minor: number; isRelease: boolean; createdAt: number; filesJson: string }>
        selectedVersionId?: string | null
      }
      const versions = result.versions.map((version) => ({ ...version, label: getVersionLabel(version) })) as VersionOption[]
      const selectedVersion = versions.find((version) => version.id === result.selectedVersionId) ?? versions[0]
      return {
        skill: result.skill,
        versions,
        latestVersion: versions[0],
        selectedVersion,
        files: parseSkillFiles((result.versions.find((version) => version.id === selectedVersion.id) ?? result.versions[0]).filesJson),
      } satisfies SkillConfigRecord
    },
    delete: async (skillId: string) => getBridge().skills.delete(skillId),
  },
  agents: {
    list: async () => {
      const rows = await getBridge().agents.list() as AgentSummary[]
      return rows
    },
    get: async (agentId: string, selectedVersionId?: string) => {
      const payload = await getBridge().agents.get(agentId) as {
        agent: AgentSummary | null
        versions: Array<{ id: string; major: number; minor: number; isRelease: boolean; createdAt: number; configJson: string }>
      }
      if (!payload.agent) {
        return null
      }
      const versions = payload.versions.map((version) => ({ ...version, label: getVersionLabel(version) })) as VersionOption[]
      const selectedPayload = payload.versions.find((version) => version.id === selectedVersionId) ?? payload.versions[0]
      if (!selectedPayload || versions.length === 0) {
        const fallbackVersion = { id: "draft", major: 1, minor: 0, isRelease: false, createdAt: Date.now(), label: "v1.0-draft" } satisfies VersionOption
        return {
          agent: payload.agent,
          versions: [fallbackVersion],
          latestVersion: fallbackVersion,
          selectedVersion: fallbackVersion,
          config: createDefaultAgentConfig(),
        } satisfies AgentDetail
      }

      return {
        agent: payload.agent,
        versions,
        latestVersion: versions[0],
        selectedVersion: versions.find((version) => version.id === selectedPayload.id) ?? versions[0],
        config: parseAgentConfig(selectedPayload.configJson),
      } satisfies AgentDetail
    },
    create: async () => {
      const payload = await getBridge().agents.create() as {
        agent: AgentSummary
        versions: Array<{ id: string; major: number; minor: number; isRelease: boolean; createdAt: number; configJson: string }>
      }
      const versions = payload.versions.map((version) => ({ ...version, label: getVersionLabel(version) })) as VersionOption[]
      return {
        agent: payload.agent,
        versions,
        latestVersion: versions[0],
        selectedVersion: versions[0],
        config: parseAgentConfig(payload.versions[0].configJson),
      } satisfies AgentDetail
    },
    save: async (payload: { id: string; title: string; kind: string; summary: string; config: AgentConfigRecord; selectedVersionId?: string; publish?: boolean }) => {
      const result = await getBridge().agents.save({ ...payload, configJson: JSON.stringify(payload.config) }) as {
        agent: AgentSummary
        versions: Array<{ id: string; major: number; minor: number; isRelease: boolean; createdAt: number; configJson: string }>
        selectedVersionId: string | null
      }
      const versions = result.versions.map((version) => ({ ...version, label: getVersionLabel(version) })) as VersionOption[]
      const selectedPayload = result.versions.find((version) => version.id === result.selectedVersionId) ?? result.versions[0]
      return {
        agent: result.agent,
        versions,
        latestVersion: versions[0],
        selectedVersion: versions.find((version) => version.id === selectedPayload.id) ?? versions[0],
        config: parseAgentConfig(selectedPayload.configJson),
      } satisfies AgentDetail
    },
    delete: async (agentId: string) => getBridge().agents.delete(agentId),
    getSettings: async () => getBridge().agents.getSettings() as Promise<string | null>,
    saveSettings: async (payload: unknown) => getBridge().agents.saveSettings(payload),
  },
  integrations: {
    list: async () => {
      const rows = await getBridge().integrations.list() as IntegrationSummary[]
      return rows.map((row) => ({ ...row, enabled: Boolean(row.enabled) }))
    },
    get: async (integrationId: string, selectedVersionId?: string) => {
      const payload = await getBridge().integrations.get(integrationId) as {
        integration: IntegrationSummary | null
        versions: Array<{ id: string; major: number; minor: number; isRelease: boolean; createdAt: number; configJson: string }>
        executions: IntegrationExecutionRecord[]
      }
      if (!payload.integration) {
        return null
      }
      const versions = payload.versions.map((version) => ({ ...version, label: getVersionLabel(version) })) as VersionOption[]
      const selectedPayload = payload.versions.find((version) => version.id === selectedVersionId) ?? payload.versions[0]
      const selectedVersion = versions.find((version) => version.id === selectedPayload?.id) ?? versions[0]
      return {
        integration: { ...payload.integration, enabled: Boolean(payload.integration.enabled) },
        versions,
        latestVersion: versions[0],
        selectedVersion,
        config: parseIntegrationConfig(selectedPayload?.configJson ?? payload.versions[0].configJson),
        executions: payload.executions,
      } satisfies IntegrationDetail
    },
    create: async (payload?: Partial<IntegrationSummary & { configJson: string }>) => {
      const result = await getBridge().integrations.create(payload) as {
        integration: IntegrationSummary
        versions: Array<{ id: string; major: number; minor: number; isRelease: boolean; createdAt: number; configJson: string }>
        executions: IntegrationExecutionRecord[]
      }
      const versions = result.versions.map((version) => ({ ...version, label: getVersionLabel(version) })) as VersionOption[]
      return {
        integration: { ...result.integration, enabled: Boolean(result.integration.enabled) },
        versions,
        latestVersion: versions[0],
        selectedVersion: versions[0],
        config: parseIntegrationConfig(result.versions[0].configJson),
        executions: result.executions,
      } satisfies IntegrationDetail
    },
    fetchApiDoc: async (sourceUrl: string) => getBridge().integrations.fetchApiDoc(sourceUrl) as Promise<string>,
    save: async (payload: { id: string; title: string; kind: string; endpoint: string; config: IntegrationConfig; enabled?: boolean; selectedVersionId?: string; publish?: boolean }) => {
      const result = await getBridge().integrations.save({ ...payload, configJson: JSON.stringify(payload.config) }) as {
        integration: IntegrationSummary
        versions: Array<{ id: string; major: number; minor: number; isRelease: boolean; createdAt: number; configJson: string }>
        executions: IntegrationExecutionRecord[]
      }
      const versions = result.versions.map((version) => ({ ...version, label: getVersionLabel(version) })) as VersionOption[]
      return {
        integration: { ...result.integration, enabled: Boolean(result.integration.enabled) },
        versions,
        latestVersion: versions[0],
        selectedVersion: versions[0],
        config: parseIntegrationConfig(result.versions[0].configJson),
        executions: result.executions,
      } satisfies IntegrationDetail
    },
    setEnabled: async (payload: { id: string; enabled: boolean }) => {
      const result = await getBridge().integrations.setEnabled(payload) as IntegrationSummary
      return { ...result, enabled: Boolean(result.enabled) }
    },
    delete: async (integrationId: string) => getBridge().integrations.delete(integrationId),
    recordExecution: async (payload: { id: string; versionId: string; status: string; input: string; output: string }) => {
      return getBridge().integrations.recordExecution(payload) as Promise<IntegrationExecutionRecord[]>
    },
    execute: async (payload: unknown) => getBridge().integrations.execute(payload),
  },
  workflows: {
    list: async () => {
      const rows = await getBridge().workflows.list() as WorkflowSummary[]
      return rows
    },
    get: async (workflowId: string, selectedVersionId?: string) => {
      const payload = await getBridge().workflows.get(workflowId) as {
        workflow: WorkflowSummary | null
        versions: Array<{ id: string; major: number; minor: number; isRelease: boolean; createdAt: number; definitionJson: string }>
        invocations: Array<{ id: string; versionId: string; status: string; trigger: string; input: string; output: string; traceJson: string; createdAt: number }>
      }
      if (!payload.workflow) {
        return null
      }
      const versions = payload.versions.map((version) => ({ ...version, label: getVersionLabel(version) })) as VersionOption[]
      const selectedPayload = payload.versions.find((version) => version.id === selectedVersionId) ?? payload.versions[0]
      const selectedVersion = versions.find((version) => version.id === selectedPayload?.id) ?? versions[0]
      return {
        workflow: payload.workflow,
        versions,
        latestVersion: versions[0],
        selectedVersion,
        definition: normalizeWorkflowDefinition(parseJson(selectedPayload?.definitionJson, { nodes: [], edges: [], viewport: { x: 0, y: 0, zoom: 1 } } as WorkflowDefinition)),
        invocations: payload.invocations.map((invocation) => ({ ...invocation, traces: parseWorkflowInvocationTraces(invocation.traceJson) })) as WorkflowInvocationRecord[],
      } satisfies WorkflowDetail
    },
    create: async () => {
      const payload = await getBridge().workflows.create() as {
        workflow: WorkflowSummary
        versions: Array<{ id: string; major: number; minor: number; isRelease: boolean; createdAt: number; definitionJson: string }>
        invocations: Array<{ id: string; versionId: string; status: string; trigger: string; input: string; output: string; traceJson: string; createdAt: number }>
      }
      const versions = payload.versions.map((version) => ({ ...version, label: getVersionLabel(version) })) as VersionOption[]
      return {
        workflow: payload.workflow,
        versions,
        latestVersion: versions[0],
        selectedVersion: versions[0],
        definition: normalizeWorkflowDefinition(parseJson(payload.versions[0]?.definitionJson, { nodes: [], edges: [], viewport: { x: 0, y: 0, zoom: 1 } } as WorkflowDefinition)),
        invocations: payload.invocations.map((invocation) => ({ ...invocation, traces: parseWorkflowInvocationTraces(invocation.traceJson) })) as WorkflowInvocationRecord[],
      } satisfies WorkflowDetail
    },
    save: async (payload: { id: string; title: string; summary: string; definition: WorkflowDefinition; selectedVersionId?: string; publish?: boolean }) => {
      const result = await getBridge().workflows.save({ ...payload, definitionJson: JSON.stringify(payload.definition) }) as {
        workflow: WorkflowSummary
        versions: Array<{ id: string; major: number; minor: number; isRelease: boolean; createdAt: number; definitionJson: string }>
        invocations: Array<{ id: string; versionId: string; status: string; trigger: string; input: string; output: string; traceJson: string; createdAt: number }>
      }
      const versions = result.versions.map((version) => ({ ...version, label: getVersionLabel(version) })) as VersionOption[]
      return {
        workflow: result.workflow,
        versions,
        latestVersion: versions[0],
        selectedVersion: versions[0],
        definition: normalizeWorkflowDefinition(parseJson(result.versions[0]?.definitionJson, { nodes: [], edges: [], viewport: { x: 0, y: 0, zoom: 1 } } as WorkflowDefinition)),
        invocations: result.invocations.map((invocation) => ({ ...invocation, traces: parseWorkflowInvocationTraces(invocation.traceJson) })) as WorkflowInvocationRecord[],
      } satisfies WorkflowDetail
    },
    delete: async (workflowId: string) => getBridge().workflows.delete(workflowId) as Promise<boolean>,
    recordInvocation: async (payload: { workflowId: string; versionId: string; status: string; trigger: string; input: string; output: string; traceJson: string }) => {
      return getBridge().workflows.recordInvocation(payload) as Promise<Array<{ id: string; versionId: string; status: string; trigger: string; input: string; output: string; traceJson: string; createdAt: number }>>
    },
  },
  channels: {
    list: async () => {
      const rows = await getBridge().channels.list() as RawChannelRow[]
      return rows.map(parseChannelSummaryRow)
    },
    get: async (channelId: string) => {
      const row = await getBridge().channels.get(channelId) as RawChannelRow | null
      return row ? parseChannelDetailRow(row) : null
    },
    create: async (defaults?: { providerId?: string; modelId?: string }) => {
      const row = await getBridge().channels.create(defaults) as RawChannelRow
      return parseChannelDetailRow(row)
    },
    save: async (payload: ChannelDetail) => {
      const row = await getBridge().channels.save(payload) as RawChannelRow
      return parseChannelDetailRow(row)
    },
    delete: async (channelId: string) => getBridge().channels.delete(channelId) as Promise<{ success: boolean }>,
    startRuntime: async () => getBridge().channels.startRuntime(),
    stopRuntime: async () => getBridge().channels.stopRuntime(),
    getRuntimeStatus: async () => getBridge().channels.getRuntimeStatus(),
    registerRuntime: async () => getBridge().channels.registerRuntime(),
    getWebhookUrl: async (channel: ChannelConfigRecord) => getBridge().channels.getWebhookUrl(channel),
    sendMessage: async (payload: { channelId: string; chatId: string; content: string }) => getBridge().channels.sendMessage(payload),
    sendMessageQueued: async (payload: { channelId: string; chatId: string; content: string }) => getBridge().channels.sendMessageQueued(payload),
    getAccessToken: async (channelId: string) => getBridge().channels.getAccessToken(channelId),
    healthCheck: async (channelId: string) => getBridge().channels.healthCheck(channelId),
    getStreamStatus: async (channelId: string) => getBridge().channels.getStreamStatus(channelId),
    debugSend: async (payload: { channelId: string; content: string }) => getBridge().channels.debugSend(payload),
    startWeChatPersonalLogin: async (channelId?: string, force?: boolean) => getBridge().channels.startWeChatPersonalLogin(channelId, force),
    waitForWeChatPersonalLogin: async (channelId: string | undefined, sessionKey: string, verifyCode?: string, timeoutMs?: number) => getBridge().channels.waitForWeChatPersonalLogin(channelId, sessionKey, verifyCode, timeoutMs),
    getWeChatPersonalQrPreview: async (url: string, waitMs?: number) => getBridge().channels.getWeChatPersonalQrPreview(url, waitMs) as Promise<{ ok?: boolean; image?: string; format?: string; error?: string }>,
  },
  schedulers: {
    list: async () => getBridge().schedulers.list() as Promise<SchedulerDetail[]>,
    get: async (schedulerId: string) => getBridge().schedulers.get(schedulerId) as Promise<SchedulerDetail | null>,
    create: async () => getBridge().schedulers.create() as Promise<SchedulerDetail>,
    save: async (payload: { id: string; title: string; description: string; enabled: boolean; schedule: string; timeZone: string; targetType: string; targetId: string; targetName: string; missedRunPolicy: string; retryLimit: number; retryBackoffSeconds: number; inputPayloadJson: string }) => getBridge().schedulers.save(payload) as Promise<SchedulerDetail>,
  },
  preferences: {
    get: async () => getBridge().preferences.get() as Promise<string | null>,
    save: async (value: string) => getBridge().preferences.save(value) as Promise<string>,
  },
  updater: {
    getState: async () => getBridge().updater.getState(),
    check: async () => getBridge().updater.check(),
  },
  mail: {
    send: async (payload: SendMailPayload) => getBridge().mail.send(payload) as Promise<{ success: boolean; error?: string }>,
  },
  tools: {
    listFiles: async (relativePath?: string) => getBridge().tools.listFiles(relativePath) as Promise<Array<{ name: string; path: string; type: "file" | "directory" }>>,
    readFile: async (relativePath: string) => getBridge().tools.readFile(relativePath) as Promise<{ path: string; content: string }>,
    writeFile: async (payload: { path: string; content: string }) => getBridge().tools.writeFile(payload) as Promise<{ ok: boolean; path: string }>,
    runCommand: async (payload: { command: string; cwd?: string; timeoutMs?: number }) => {
      const bridge = getBridge()
      const preferences = await readToolPreferenceSettings(bridge)
      const mode = preferences.commandConfirmationMode === "never" || preferences.commandConfirmationMode === "always"
        ? preferences.commandConfirmationMode
        : "daily"

      if (shouldConfirmWorkspaceCommand(mode) && typeof window !== "undefined" && typeof window.confirm === "function") {
        const confirmed = window.confirm(["SUORA command guardrail", "", `Command: ${payload.command}`, payload.cwd ? `Directory: ${payload.cwd}` : "Directory: workspace root", "", "Continue execution?"].join("\n"))
        if (!confirmed) {
          return {
            ok: false,
            exitCode: null,
            stdout: "",
            stderr: "Command cancelled by preference guardrail.",
          }
        }

        markWorkspaceCommandConfirmed(mode)
      }

      const env = Object.fromEntries((preferences.globalEnvironmentVariables ?? []).filter((item) => item && typeof item.key === "string" && item.key.trim()).map((item) => [item.key.trim(), typeof item.value === "string" ? item.value : ""]))

      return bridge.tools.runCommand({ ...payload, env }) as Promise<{ ok: boolean; exitCode: number | null; stdout: string; stderr: string }>
    },
    browserNavigate: async (payload: { sessionId?: string; url?: string; visible?: boolean }) => getBridge().tools.browserNavigate(payload) as Promise<{ ok: boolean; url: string; visible: boolean; loading?: boolean; error?: string }>,
    browserState: async (sessionId?: string) => getBridge().tools.browserState(sessionId) as Promise<{ open: boolean; visible: boolean; url: string; loading?: boolean; error?: string }>,
    browserPage: async (payload: { sessionId?: string; includeText?: boolean; includeLinks?: boolean }) => getBridge().tools.browserPage(payload),
    browserClick: async (sessionId: string, selector: string) => getBridge().tools.browserClick({ sessionId, selector }),
    browserFill: async (payload: { sessionId?: string; selector: string; value: string }) => getBridge().tools.browserFill(payload),
    saveFile: async (payload: { defaultName: string; filters?: Array<{ name: string; extensions: string[] }>; dataBase64: string }) => getBridge().tools.saveFile(payload) as Promise<{ ok: boolean; canceled: boolean; path: string | null }>,
    openExternal: async (url: string) => getBridge().tools.openExternal(url) as Promise<{ ok: boolean; url: string }>,
  },
}

async function readToolPreferenceSettings(bridge: ReturnType<typeof getBridge>): Promise<ToolPreferenceSettings> {
  try {
    const raw = await bridge.preferences.get() as string | null
    if (!raw) {
      return {}
    }

    return parseObjectJson<ToolPreferenceSettings>(raw, {})
  } catch {
    if (typeof window === "undefined") {
      return {}
    }

    try {
      const raw = window.localStorage.getItem("suora:preference-settings")
      return parseObjectJson<ToolPreferenceSettings>(raw, {})
    } catch {
      return {}
    }
  }
}

function shouldConfirmWorkspaceCommand(mode: PreferenceCommandConfirmationMode) {
  if (mode === "never") {
    return false
  }

  if (mode === "always") {
    return true
  }

  if (typeof window === "undefined") {
    return false
  }

  const today = new Date().toISOString().slice(0, 10)
  return window.localStorage.getItem(COMMAND_CONFIRMATION_STORAGE_KEY) !== today
}

function markWorkspaceCommandConfirmed(mode: PreferenceCommandConfirmationMode) {
  if (mode !== "daily" || typeof window === "undefined") {
    return
  }

  window.localStorage.setItem(COMMAND_CONFIRMATION_STORAGE_KEY, new Date().toISOString().slice(0, 10))
}