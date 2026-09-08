import type { Edge, Node, Viewport } from "@xyflow/react"
import type { ChatMessagePart } from "@/data/domain/chat-message-parts"

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
  sourceType?: "manual" | "channel"
  sourceRef?: string | null
}

export type ChatMessageRecord = {
  id: string
  role: "user" | "assistant" | "system"
  content: string
  createdAt: number
  parts?: ChatMessagePart[]
  status?: "streaming" | "completed" | "failed" | "stopped"
  error?: string
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
  kind: "start" | "end" | "document-retrieval" | "agent" | "fork" | "join" | "if-else" | "http" | "script" | "variable-assigner" | "template" | "ai-response" | "loop" | "parallel" | "serial" | "toolset" | "webhook" | "wiki-retrieval" | "smtp" | "condition"
  agentId?: string
  task?: string
  description?: string
  enabled?: boolean
  continueOnError?: boolean
  retryCount?: number
  timeoutMs?: number
  modelId?: string
  runIf?: string
  inputTemplate?: string
  outputKey?: string
  maxInputChars?: number
  maxOutputChars?: number
  documentId?: string
  documentName?: string
  queryExpression?: string
  resultLimit?: number
  integrationId?: string
  integrationName?: string
  method?: string
  url?: string
  headersJson?: string
  queryJson?: string
  bodyJson?: string
  runtime?: string
  script?: string
  timeoutSeconds?: number
  branchCount?: number
  joinStrategy?: "wait-all" | "wait-any"
  trueLabel?: string
  falseLabel?: string
  branches?: Array<{
    id: string
    label: string
    expression: string
  }>
  variableName?: string
  variableValue?: string
  template?: string
  templateOutputFormat?: "text" | "json"
  loopExpression?: string
  maxIterations?: number
  emailTo?: string
  emailSubject?: string
  emailBody?: string
  systemPrompt?: string
  temperature?: number
  maxTokens?: number
  responseFormat?: "text" | "json"
  inputSchemaJson?: string
  outputSchemaJson?: string
  itemAlias?: string
  concurrency?: number
  mergeStrategy?: "all-settled" | "fail-fast"
  notes?: string
  executionStatus?: WorkflowNodeTraceRecord["status"]
}

export type WorkflowInputParameter = {
  id: string
  name: string
  description: string
  type: "string" | "number" | "boolean" | "object" | "array"
  defaultValue: string
  required: boolean
}

export type WorkflowEdgeData = {
  condition?: string
  successOnly?: boolean
}

export type WorkflowVariable = {
  id: string
  name: string
  defaultValue: string
  required: boolean
}

export type WorkflowBudget = {
  maxSteps: number
  maxDurationMs: number
}

export type WorkflowNotificationSettings = {
  enabled: boolean
  to: string
  subjectTemplate: string
  includeSummary: boolean
  includeTrace: boolean
  triggerOn: "manual" | "dry-run" | "both"
}

export type WorkflowDefinition = {
  nodes: Node<WorkflowNodeData>[]
  edges: Edge<WorkflowEdgeData>[]
  viewport: Viewport
  resourceBindings?: {
    providerId: string
    skillId: string
    documentId: string
    integrationId: string
  }
  dryRunInputJson?: string
  variables?: WorkflowVariable[]
  budget?: WorkflowBudget
  notifications?: WorkflowNotificationSettings
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
  traceId?: string
  nodeId: string
  label: string
  status: "queued" | "running" | "success" | "error" | "skipped"
  input?: string
  output: string
  startedAt: number
  finishedAt: number
  contextBefore?: WorkflowTraceSnapshot
  contextAfter?: WorkflowTraceSnapshot
}

export type WorkflowTraceSnapshot = {
  schemaVersion: 1
  input: unknown
  current: unknown
  vars: Record<string, unknown>
  steps: Record<string, unknown>
  truncated: boolean
  redactedPaths: string[]
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
  enabled: boolean
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

export type HttpIntegrationAuthType = "none" | "bearer" | "basic" | "api-key" | "custom"

export type HttpEndpointBodyMode = "none" | "json" | "form-data" | "x-www-form-urlencoded"

export type HttpEndpointParameterLocation = "path" | "query" | "header" | "form-data" | "json"

export type HttpEndpointParameter = {
  id: string
  name: string
  in: HttpEndpointParameterLocation
  type: string
  required: boolean
  description: string
  defaultValue: string
}

export type HttpEndpointConfig = {
  id: string
  name: string
  description: string
  method: string
  path: string
  bodyMode: HttpEndpointBodyMode
  headersJson: string
  queryJson: string
  bodyJson: string
  parameterSchemaJson: string
  responseSchemaJson: string
  responseDescription: string
  parameters: HttpEndpointParameter[]
}

export type HttpIntegrationConfig = {
  kind: "http"
  baseUrl: string
  selectedEndpointId: string
  endpoints: HttpEndpointConfig[]
  method: string
  url: string
  description: string
  headersJson: string
  queryJson: string
  bodyJson: string
  authType: HttpIntegrationAuthType
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
  description: string
  runtime: string
  timeoutMs: number
  inputSchemaJson: string
  outputSchemaJson: string
  selectedScriptId: string
  scripts: ScriptWorkbenchItem[]
}

export type McpToolRecord = {
  id: string
  name: string
  description: string
  inputSchemaJson: string
}

export type McpIntegrationConfig = {
  kind: "mcp"
  description: string
  endpoint: string
  launchCommand: string
  protocols: string[]
  authModes: string[]
  authConfigJson: string
  toolCatalogJson: string
  tools: McpToolRecord[]
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
  enabled: boolean
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
  docsUrl?: string
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
  maxSteps?: number
  workflowIds?: string[]
  skillIds: string[]
  toolsetIds: string[]
  documentIds?: string[]
  privateToolIds?: string[]
}

export type AgentSummary = {
  id: string
  title: string
  kind: string
  summary: string
  updatedAt: number
  isDisabled?: boolean
  source?: "custom" | "system"
}

export type AgentDetail = {
  agent: AgentSummary
  versions: VersionOption[]
  latestVersion: VersionOption
  selectedVersion: VersionOption
  config: AgentConfigRecord
}

export type ChannelPlatform =
  | "web"
  | "email"
  | "wechat"
  | "wechat_personal"
  | "wechat_official"
  | "wechat_miniprogram"
  | "feishu"
  | "dingtalk"
  | "telegram"
  | "teams"
  | "custom"

export type ChannelStatus = "inactive" | "active" | "error"

export type ChannelConnectionMode = "webhook" | "stream"

export type WeChatPersonalBindingStatus = "unbound" | "pending" | "bound" | "error"

export type WeChatPersonalQrUiStatus = "wait" | "scaned" | "need_verifycode"

export type ChannelBindingState = "unconfigured" | "draft" | "ready" | "connected" | "error"

export type EmailFilterField = "subject" | "from" | "to" | "cc" | "body" | "has_attachment"

export type EmailFilterOperator = "contains" | "not_contains" | "equals" | "starts_with" | "ends_with" | "regex" | "is_true"

export type EmailActionType = "auto_reply" | "forward" | "label" | "agent_process" | "webhook"

export type EmailFilterRule = {
  id: string
  field: EmailFilterField
  operator: EmailFilterOperator
  value: string
  enabled: boolean
}

export type EmailAction = {
  id: string
  type: EmailActionType
  value?: string
  enabled: boolean
  useAgent?: boolean
}

export type ChannelMessageRecord = {
  id: string
  direction: "incoming" | "outgoing" | "system"
  senderName: string
  senderId: string
  content: string
  status: "received" | "sent" | "failed"
  createdAt: number
}

export type ChannelConversationEntry = {
  role: "user" | "assistant"
  content: string
  timestamp: number
}

export type ChannelUserRecord = {
  id: string
  channelId: string
  senderName: string
  senderId: string
  firstSeenAt: number
  lastActiveAt: number
  messageCount: number
  conversationHistory: ChannelConversationEntry[]
}

export type ChannelHealthRecord = {
  isHealthy: boolean | null
  lastCheckAt?: number
  latencyMs?: number
  errorCount: number
  lastError?: string
}

export type ChannelDebugEntry = {
  id: string
  timestamp: number
  tone: "info" | "success" | "error"
  text: string
}

export type ChannelConfigRecord = {
  id: string
  title: string
  description?: string
  platform: ChannelPlatform
  catalogId?: string
  bindingState?: ChannelBindingState
  enabled: boolean
  status: ChannelStatus
  connectionMode: ChannelConnectionMode
  webhookPath: string
  webhookSecret: string
  autoReply: boolean
  replyAgentId: string
  providerId?: string
  modelId?: string
  createdAt: number
  updatedAt: number
  lastMessageAt?: number
  messageCount: number
  appId?: string
  appSecret?: string
  callbackUrl?: string
  verificationToken?: string
  encryptKey?: string
  telegramBotToken?: string
  teamsAppId?: string
  teamsAppPassword?: string
  teamsTenantId?: string
  teamsWebhookUrl?: string
  teamsBotEndpoint?: string
  wechatCorpId?: string
  wechatAgentId?: string
  wechatToken?: string
  wechatEncodingAesKey?: string
  wechatOfficialAppId?: string
  wechatOfficialAppSecret?: string
  wechatOfficialToken?: string
  wechatMiniProgramAppId?: string
  wechatMiniProgramAppSecret?: string
  wechatMiniProgramToken?: string
  wechatMiniProgramEncodingAesKey?: string
  wechatPersonalWebhookUrl?: string
  wechatPersonalAuthToken?: string
  wechatPersonalQrCodeUrl?: string
  wechatPersonalBindingStatus?: WeChatPersonalBindingStatus
  wechatPersonalQrStatus?: WeChatPersonalQrUiStatus
  wechatPersonalSessionKey?: string
  wechatPersonalBotToken?: string
  wechatPersonalBaseUrl?: string
  wechatPersonalAccountId?: string
  wechatPersonalUserId?: string
  feishuAppId?: string
  feishuAppSecret?: string
  feishuVerificationToken?: string
  feishuEncryptKey?: string
  feishuWebhookUrl?: string
  dingtalkClientId?: string
  dingtalkClientSecret?: string
  dingtalkRobotCode?: string
  dingtalkWebhookUrl?: string
  dingtalkSigningSecret?: string
  customWebhookUrl?: string
  customWebsocketUrl?: string
  customWebsocketProtocol?: string
  customAuthHeader?: string
  customAuthValue?: string
  customPayloadTemplate?: string
  customPlatformName?: string
  customPlatformIcon?: string
  emailImapHost?: string
  emailImapPort?: number
  emailImapUser?: string
  emailImapPassword?: string
  emailImapTls?: boolean
  emailImapMailbox?: string
  emailSmtpHost?: string
  emailSmtpPort?: number
  emailSmtpUser?: string
  emailSmtpPassword?: string
  emailSmtpTls?: boolean
  emailUseGlobalMailService?: boolean
  emailFromName?: string
  emailFromAddress?: string
  emailPollInterval?: number
  emailFilters?: EmailFilterRule[]
  emailActions?: EmailAction[]
  emailMarkAsRead?: boolean
}

export type ChannelRuntimeState = {
  messages: ChannelMessageRecord[]
  users: ChannelUserRecord[]
  health: ChannelHealthRecord
  debugLog: ChannelDebugEntry[]
}

export type ChannelSummary = {
  id: string
  title: string
  platform: ChannelPlatform
  catalogId?: string
  connectionMode?: ChannelConnectionMode
  bindingState?: ChannelBindingState
  enabled: boolean
  status: ChannelStatus
  updatedAt: number
  lastMessageAt?: number
  messageCount: number
  meta?: string
  customPlatformName?: string
  customPlatformIcon?: string
}

export type ChannelDetail = {
  channel: ChannelConfigRecord
  runtime: ChannelRuntimeState
}

export type SimpleCatalogItem = {
  id: string
  title: string
  kind: string
  meta?: string
  updatedAt: number
}