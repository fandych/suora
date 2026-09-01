import type { Edge, Node, Viewport } from "@xyflow/react"

import type {
  ResolvedSecondarySidebarGroup,
  ResolvedSecondarySidebarItem,
} from "@/views/nav-config"

export type SidebarGroupData = ResolvedSecondarySidebarGroup
export type SidebarItemData = ResolvedSecondarySidebarItem

export type ChatSummary = {
  id: string
  title: string
  chatbotId: string
  summary: string
  updatedAt: number
}

export type ChatMessageRecord = {
  id: string
  role: "user" | "assistant" | "system"
  content: string
  createdAt: number
}

export type ChatDetail = {
  chat: ChatSummary
  messages: ChatMessageRecord[]
}

export type VersionOption = {
  id: string
  major: number
  minor: number
  isRelease: boolean
  createdAt: number
  label: string
}

export type WorkflowNodeData = {
  label: string
  prompt: string
  kind: "start" | "agent" | "condition" | "output"
}

export type WorkflowDefinition = {
  nodes: Node<WorkflowNodeData>[]
  edges: Edge[]
  viewport: Viewport
  resourceBindings?: {
    providerId: string
    skillId: string
    documentId: string
    integrationId: string
  }
  dryRunInputJson?: string
}

export type WorkflowSummary = {
  id: string
  title: string
  summary: string
  updatedAt: number
}

export type WorkflowInvocationRecord = {
  id: string
  versionId: string
  status: string
  trigger: string
  input: string
  output: string
  traces: WorkflowNodeTraceRecord[]
  createdAt: number
}

export type WorkflowNodeTraceRecord = {
  nodeId: string
  label: string
  status: "queued" | "running" | "success" | "error"
  output: string
  startedAt: number
  finishedAt: number
}

export type WorkflowDetail = {
  workflow: WorkflowSummary
  versions: VersionOption[]
  latestVersion: VersionOption
  selectedVersion: VersionOption
  definition: WorkflowDefinition
  invocations: WorkflowInvocationRecord[]
}

export type SkillFileRecord = {
  path: string
  content: string
  language: string
  kind?: "file" | "directory"
  executable?: boolean
}

export type SkillSummary = {
  id: string
  title: string
  source: string
  summary: string
  updatedAt: number
}

export type SkillDetail = {
  skill: SkillSummary
  versions: VersionOption[]
  latestVersion: VersionOption
  selectedVersion: VersionOption
  files: SkillFileRecord[]
}

export type DocumentPageRecord = {
  id: string
  title: string
  content: string
  type?: "document" | "folder"
  parentId?: string | null
}

export type DocumentGraphEdge = {
  id: string
  source: string
  target: string
  label: string
  status: "pending" | "approved" | "rejected"
  confidence: number
}

export type DocumentSettings = {
  isPublic: boolean
  includeInLlmsTxt: boolean
}

export type DocumentSummary = {
  id: string
  title: string
  summary: string
  updatedAt: number
}

export type DocumentDetail = {
  document: DocumentSummary
  versions: VersionOption[]
  latestVersion: VersionOption
  selectedVersion: VersionOption
  pages: DocumentPageRecord[]
  graphEdges: DocumentGraphEdge[]
  settings: DocumentSettings
}

export type HttpIntegrationConfig = {
  kind: "http"
  method: string
  url: string
  description: string
  headersJson: string
  queryJson: string
  bodyJson: string
  authType: "none" | "bearer" | "basic" | "api-key"
  authConfigJson: string
  parameterSchemaJson: string
}

export type ScriptWorkbenchItem = {
  id: string
  name: string
  handler: string
  code: string
}

export type ScriptIntegrationConfig = {
  kind: "scripts"
  runtime: string
  timeoutMs: number
  inputSchemaJson: string
  outputSchemaJson: string
  selectedScriptId: string
  scripts: ScriptWorkbenchItem[]
}

export type McpIntegrationConfig = {
  kind: "mcp"
  endpoint: string
  launchCommand: string
  protocols: string[]
  authModes: string[]
  authConfigJson: string
}

export type IntegrationConfig =
  | HttpIntegrationConfig
  | ScriptIntegrationConfig
  | McpIntegrationConfig

export type IntegrationSummary = {
  id: string
  title: string
  kind: string
  endpoint: string
  updatedAt: number
}

export type IntegrationDetail = {
  integration: IntegrationSummary
  versions: VersionOption[]
  latestVersion: VersionOption
  selectedVersion: VersionOption
  config: IntegrationConfig
  executions: IntegrationExecutionRecord[]
}

export type IntegrationExecutionRecord = {
  id: string
  versionId: string
  status: string
  input: string
  output: string
  createdAt: number
}

export type SchedulerTargetType = "workflow" | "agent"

export type SchedulerMissedRunPolicy = "skip" | "catch-up"

export type SchedulerDetail = {
  id: string
  title: string
  description: string
  enabled: boolean
  schedule: string
  timeZone: string
  targetType: SchedulerTargetType
  targetId: string
  targetName: string
  missedRunPolicy: SchedulerMissedRunPolicy
  retryLimit: number
  retryBackoffSeconds: number
  inputPayloadJson: string
  updatedAt: number
}

export type ProviderModelCapability = "toolcalling" | "vision" | "embedding" | "structuredOutput"

export type ProviderApiMode = "messages" | "responses" | "completions"

export type ProviderModelRecord = {
  id: string
  name: string
  enabled: boolean
  capabilities?: ProviderModelCapability[]
  apiModes?: ProviderApiMode[]
  contextWindow?: number
  maxOutputTokens?: number
  supportsParallelToolCalls?: boolean
  supportsReasoning?: boolean
}

export type ProviderConfigRecord = {
  id: string
  title: string
  providerType: string
  baseUrl: string
  apiKey: string
  enabled: boolean
  models: ProviderModelRecord[]
  updatedAt: number
}

export type ProviderPreset = {
  providerType: string
  title: string
  description: string
  baseUrl: string
  models: ProviderModelRecord[]
}

export type SkillConfigRecord = {
  skill: SkillSummary
  versions: VersionOption[]
  latestVersion: VersionOption
  selectedVersion: VersionOption
  files: SkillFileRecord[]
}

export type AgentConfigRecord = {
  instructions: string
  providerId: string
  modelId: string
  skillIds: string[]
  toolsetIds: string[]
}

export type AgentSummary = {
  id: string
  title: string
  kind: string
  summary: string
  updatedAt: number
}

export type AgentDetail = {
  agent: AgentSummary
  versions: VersionOption[]
  latestVersion: VersionOption
  selectedVersion: VersionOption
  config: AgentConfigRecord
}

export type SimpleCatalogItem = {
  id: string
  title: string
  kind: string
  meta?: string
  updatedAt: number
}

export type DashboardSnapshot = {
  storage: "ready" | "error"
  counts: {
    chats: number
    workflows: number
    skills: number
    documents: number
    agents: number
    providers: number
  }
}