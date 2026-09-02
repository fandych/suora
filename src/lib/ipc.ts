import type { AgentConfigRecord, AgentDetail, AgentSummary, ChatDetail, ChatSummary, DocumentDetail, DocumentGraphEdge, DocumentPageRecord, DocumentSummary, IntegrationConfig, IntegrationDetail, IntegrationExecutionRecord, IntegrationSummary, ProviderConfigRecord, SchedulerDetail, SimpleCatalogItem, SkillConfigRecord, SkillFileRecord, SkillSummary, VersionOption, WorkflowDefinition, WorkflowDetail, WorkflowInvocationRecord, WorkflowSummary } from "@/data/domain/models"
import { getVersionLabel } from "@/data/domain/versioning"
import { buildDefaultDocumentNodes, normalizeDocumentNodes } from "@/lib/document-tree"

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
  updatedAt: number
}

function parseProviderRow(row: RawProviderRow): ProviderConfigRecord {
  return {
    id: row.id,
    title: row.title,
    providerType: row.providerType,
    baseUrl: row.baseUrl,
    apiKey: row.apiKey,
    enabled: Boolean(row.enabled),
    models: JSON.parse(row.modelsJson) as ProviderConfigRecord["models"],
    updatedAt: row.updatedAt,
  }
}

function parseChannelRow(row: RawChannelRow): SimpleCatalogItem {
  return {
    id: row.id,
    title: row.title,
    kind: row.platform,
    meta: row.platform,
    updatedAt: row.updatedAt,
  }
}

function getBridge() {
  const bridge = window.suora
  if (!bridge) {
    throw new Error("SUORA IPC bridge is not available.")
  }
  return bridge
}

function parseDocumentStructure(structureJson: string | undefined, documentTitle: string) {
  if (!structureJson) {
    return buildDefaultDocumentNodes(documentTitle)
  }

  const parsed = JSON.parse(structureJson) as { pages?: DocumentPageRecord[] }
  return normalizeDocumentNodes(parsed.pages ?? [], documentTitle)
}

export const suoraIpc = {
  system: {
    info: async () => getBridge().system.info(),
  },
  workspace: {
    getPaths: async () => getBridge().workspace.getPaths(),
    setProxySettings: async (settings: unknown) => getBridge().workspace.setProxySettings(settings),
    getProxySettings: async () => getBridge().workspace.getProxySettings(),
  },
  chats: {
    list: async () => getBridge().chats.list() as Promise<ChatSummary[]>,
    get: async (chatId: string) => {
      const payload = await getBridge().chats.get(chatId) as { chat: ChatSummary | null; messages: ChatDetail["messages"] }
      if (!payload.chat) return null
      return { chat: payload.chat, messages: payload.messages } satisfies ChatDetail
    },
    create: async () => {
      const payload = await getBridge().chats.create() as { chat: ChatSummary; messages: ChatDetail["messages"] }
      return { chat: payload.chat, messages: payload.messages } satisfies ChatDetail
    },
    appendUser: async (chatId: string, content: string) => {
      const payload = await getBridge().chats.appendUser({ chatId, content }) as { chat: ChatSummary | null; messages: ChatDetail["messages"] } | null
      if (!payload?.chat) return null
      return { chat: payload.chat, messages: payload.messages } satisfies ChatDetail
    },
    appendAssistant: async (chatId: string, content: string) => {
      const payload = await getBridge().chats.appendAssistant({ chatId, content }) as { chat: ChatSummary | null; messages: ChatDetail["messages"] } | null
      if (!payload?.chat) return null
      return { chat: payload.chat, messages: payload.messages } satisfies ChatDetail
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
        graphEdges: selectedPayload ? (JSON.parse(selectedPayload.graphJson) as { edges: DocumentGraphEdge[] }).edges : [],
        settings: selectedPayload ? JSON.parse(selectedPayload.settingsJson) : { isPublic: false, includeInLlmsTxt: true },
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
        graphEdges: JSON.parse(selectedPayload.graphJson).edges as DocumentGraphEdge[],
        settings: JSON.parse(selectedPayload.settingsJson),
      } satisfies DocumentDetail
    },
    save: async (payload: { id: string; title: string; summary: string; pages: DocumentPageRecord[]; graphEdges: DocumentGraphEdge[]; settings: { isPublic: boolean; includeInLlmsTxt: boolean }; selectedVersionId?: string; publish?: boolean }) => {
      const result = await getBridge().documents.save({
        id: payload.id,
        title: payload.title,
        summary: payload.summary,
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
        graphEdges: JSON.parse(selectedPayload.graphJson).edges as DocumentGraphEdge[],
        settings: JSON.parse(selectedPayload.settingsJson),
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
        files: selectedPayload ? JSON.parse(selectedPayload.filesJson) as SkillFileRecord[] : [],
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
        files: JSON.parse(payload.versions[0].filesJson) as SkillFileRecord[],
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
        files: JSON.parse((result.versions.find((version) => version.id === selectedVersion.id) ?? result.versions[0]).filesJson) as SkillFileRecord[],
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
      return {
        agent: payload.agent,
        versions,
        latestVersion: versions[0],
        selectedVersion: versions.find((version) => version.id === selectedPayload.id) ?? versions[0],
        config: JSON.parse(selectedPayload.configJson) as AgentConfigRecord,
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
        config: JSON.parse(payload.versions[0].configJson) as AgentConfigRecord,
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
        config: JSON.parse(selectedPayload.configJson) as AgentConfigRecord,
      } satisfies AgentDetail
    },
    delete: async (agentId: string) => getBridge().agents.delete(agentId),
  },
  integrations: {
    list: async () => {
      const rows = await getBridge().integrations.list() as IntegrationSummary[]
      return rows
    },
    get: async (integrationId: string) => {
      const payload = await getBridge().integrations.get(integrationId) as {
        integration: IntegrationSummary | null
        versions: Array<{ id: string; major: number; minor: number; isRelease: boolean; createdAt: number; configJson: string }>
        executions: IntegrationExecutionRecord[]
      }
      if (!payload.integration) {
        return null
      }
      const versions = payload.versions.map((version) => ({ ...version, label: getVersionLabel(version) })) as VersionOption[]
      return {
        integration: payload.integration,
        versions,
        latestVersion: versions[0],
        selectedVersion: versions[0],
        config: JSON.parse(payload.versions[0].configJson) as IntegrationConfig,
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
        integration: result.integration,
        versions,
        latestVersion: versions[0],
        selectedVersion: versions[0],
        config: JSON.parse(result.versions[0].configJson) as IntegrationConfig,
        executions: result.executions,
      } satisfies IntegrationDetail
    },
    save: async (payload: { id: string; title: string; kind: string; endpoint: string; config: IntegrationConfig; publish?: boolean }) => {
      const result = await getBridge().integrations.save({ ...payload, configJson: JSON.stringify(payload.config) }) as {
        integration: IntegrationSummary
        versions: Array<{ id: string; major: number; minor: number; isRelease: boolean; createdAt: number; configJson: string }>
        executions: IntegrationExecutionRecord[]
      }
      const versions = result.versions.map((version) => ({ ...version, label: getVersionLabel(version) })) as VersionOption[]
      return {
        integration: result.integration,
        versions,
        latestVersion: versions[0],
        selectedVersion: versions[0],
        config: JSON.parse(result.versions[0].configJson) as IntegrationConfig,
        executions: result.executions,
      } satisfies IntegrationDetail
    },
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
    get: async (workflowId: string) => {
      const payload = await getBridge().workflows.get(workflowId) as {
        workflow: WorkflowSummary | null
        versions: Array<{ id: string; major: number; minor: number; isRelease: boolean; createdAt: number; definitionJson: string }>
        invocations: Array<{ id: string; versionId: string; status: string; trigger: string; input: string; output: string; traceJson: string; createdAt: number }>
      }
      if (!payload.workflow) {
        return null
      }
      const versions = payload.versions.map((version) => ({ ...version, label: getVersionLabel(version) })) as VersionOption[]
      return {
        workflow: payload.workflow,
        versions,
        latestVersion: versions[0],
        selectedVersion: versions[0],
        definition: JSON.parse(payload.versions[0].definitionJson) as WorkflowDefinition,
        invocations: payload.invocations.map((invocation) => ({ ...invocation, traces: JSON.parse(invocation.traceJson) })) as WorkflowInvocationRecord[],
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
        definition: JSON.parse(payload.versions[0].definitionJson) as WorkflowDefinition,
        invocations: payload.invocations.map((invocation) => ({ ...invocation, traces: JSON.parse(invocation.traceJson) })) as WorkflowInvocationRecord[],
      } satisfies WorkflowDetail
    },
    save: async (payload: { id: string; title: string; summary: string; definition: WorkflowDefinition; publish?: boolean }) => {
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
        definition: JSON.parse(result.versions[0].definitionJson) as WorkflowDefinition,
        invocations: result.invocations.map((invocation) => ({ ...invocation, traces: JSON.parse(invocation.traceJson) })) as WorkflowInvocationRecord[],
      } satisfies WorkflowDetail
    },
    recordInvocation: async (payload: { workflowId: string; versionId: string; status: string; trigger: string; input: string; output: string; traceJson: string }) => {
      return getBridge().workflows.recordInvocation(payload) as Promise<Array<{ id: string; versionId: string; status: string; trigger: string; input: string; output: string; traceJson: string; createdAt: number }>>
    },
  },
  channels: {
    list: async () => {
      const rows = await getBridge().channels.list() as RawChannelRow[]
      return rows.map(parseChannelRow)
    },
    get: async (channelId: string) => {
      const row = await getBridge().channels.get(channelId) as RawChannelRow | null
      return row ? parseChannelRow(row) : null
    },
    create: async () => {
      const row = await getBridge().channels.create() as RawChannelRow
      return parseChannelRow(row)
    },
    save: async (payload: { id: string; title: string; platform: string }) => {
      const row = await getBridge().channels.save(payload) as RawChannelRow
      return parseChannelRow(row)
    },
    delete: async (channelId: string) => getBridge().channels.delete(channelId) as Promise<{ success: boolean }>,
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
}