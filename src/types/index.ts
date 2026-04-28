// Type definitions for the application

export type ActiveModule = 'chat' | 'pipeline' | 'timer' | 'agents' | 'skills' | 'models' | 'mcp' | 'settings'

export type Provider = string

export type ThemeMode = 'light' | 'dark' | 'system'
export type FontSize = 'small' | 'medium' | 'large'
export type CodeFont = 'default' | 'fira-code' | 'jetbrains-mono' | 'source-code-pro' | 'cascadia-code' | 'consolas'
export type BubbleStyle = 'default' | 'minimal' | 'bordered' | 'glassmorphism'

// ─── Notification Center ───────────────────────────────────────────

export type NotificationType = 'info' | 'success' | 'warning' | 'error'

export interface AppNotification {
  id: string
  type: NotificationType
  title: string
  message?: string
  timestamp: number
  read: boolean
  /** Optional action: module to navigate to */
  action?: { module: ActiveModule; label?: string }
}

// ─── Model Usage Statistics ────────────────────────────────────────

export interface ModelUsageStats {
  modelId: string
  callCount: number
  totalPromptTokens: number
  totalCompletionTokens: number
  totalTokens: number
  lastUsed: number
}

export interface Model {
  id: string
  name: string
  provider: string          // provider config id
  providerType: string      // 'anthropic' | 'openai' | 'google' | 'ollama' | 'openai-compatible'
  modelId: string           // actual model identifier sent to API
  apiKey?: string
  baseUrl?: string
  isDefault?: boolean
  enabled: boolean
}

// ─── Tool System (aligned with Claude Code patterns) ──────────────

export type ToolCallStatus = 'pending' | 'running' | 'completed' | 'error'

export interface ToolOutputEnvelope {
  status: ToolCallStatus
  summary: string
  dataRef?: string
  dataPreview?: string
  warnings?: string[]
  durationMs?: number
  outputChars?: number
  storedExternally?: boolean
}

export interface ToolCall {
  id: string
  toolName: string
  input: Record<string, unknown>
  output?: string
  outputEnvelope?: ToolOutputEnvelope
  status: ToolCallStatus
  startedAt: number
  completedAt?: number
  durationMs?: number
}

/** Permission check result — mirrors Claude Code's PermissionResult */
export type PermissionBehavior = 'allow' | 'deny' | 'ask'

export interface PermissionResult {
  behavior: PermissionBehavior
  explanation?: string
  updatedInput?: Record<string, unknown>
}

/**
 * Tool metadata — mirrors Claude Code's buildTool() pattern.
 * Each tool in builtinToolDefs has a corresponding ToolMeta entry
 * that describes its capabilities and safety characteristics.
 */
export interface ToolMeta {
  /** Display name for UI (e.g. "Read file.ts") */
  userFacingName: string | ((input?: Record<string, unknown>) => string)
  /** Whether the tool only reads data and never modifies state */
  isReadOnly: boolean
  /** Whether the tool can cause irreversible changes */
  isDestructive: boolean
  /** Whether the tool is safe to run concurrently with other tools */
  isConcurrencySafe: boolean
  /** Whether user confirmation is required before execution */
  requiresConfirmation: boolean
  /** Search hint for tool discovery (like Claude Code's searchHint) */
  searchHint?: string
}

/** Represents an ordered segment in an assistant message */
export type ContentPart =
  | { type: 'text'; text: string }
  | { type: 'tool-call'; toolCallId: string }

export interface MessageAttachment {
  id: string
  type: 'image' | 'file' | 'audio'
  name: string         // filename
  mimeType: string     // e.g., 'image/png', 'text/plain', 'audio/webm'
  data: string         // base64 encoded data (image/audio) or text content (file)
  size: number         // file size in bytes
  duration?: number    // audio duration in seconds
}

export interface RuntimeSnapshot {
  runId: string
  sessionId?: string
  messageId?: string
  agentId?: string
  agentName?: string
  modelId?: string
  modelName?: string
  toolNames?: string[]
  systemPromptHash?: string
  startedAt: number
}

export interface MessageErrorInfo {
  category: 'provider' | 'tool' | 'pipeline' | 'validation' | 'cancelled' | 'unknown'
  retryable: boolean
  hint?: string
  rawSanitized: string
  source?: string
}

export interface CancellationMetadata {
  cancelledAt: number
  cancelReason: string
  partialContentLength: number
}

export interface Message {
  id: string
  role: 'user' | 'assistant' | 'tool'
  content: string
  timestamp: number
  modelUsed?: string
  agentId?: string
  isStreaming?: boolean
  isError?: boolean            // true when message represents an API error
  toolCalls?: ToolCall[]       // tool invocations by the assistant
  contentParts?: ContentPart[] // ordered segments (text + tool-calls interleaved)
  attachments?: MessageAttachment[]  // image attachments for vision models
  tokenUsage?: { promptTokens: number; completionTokens: number; totalTokens: number }
  feedback?: 'positive' | 'negative'
  runtime?: RuntimeSnapshot
  errorInfo?: MessageErrorInfo
  cancellation?: CancellationMetadata
  contextSummary?: string
}

export interface Session {
  id: string
  title: string
  createdAt: number
  updatedAt: number
  agentId?: string
  modelId?: string
  messages: Message[]
}

// ─── Agent with self-learning & customization ──────────────────────

export type MemoryScope = 'session' | 'global'

export interface AgentMemoryEntry {
  id: string
  content: string
  type: 'insight' | 'preference' | 'correction' | 'knowledge'
  scope: MemoryScope       // 'session' = tied to current session, 'global' = persists across all sessions
  createdAt: number
  source: string           // session id that generated this
  embedding?: number[]     // optional pre-computed embedding vector (for future use with real embedding APIs)
}

export interface Agent {
  id: string
  name: string
  avatar?: string
  /** Agent color for visual distinction in UI (hex string, e.g. '#3B82F6') — aligned with Claude Code's agent color coding */
  color?: string
  systemPrompt: string
  modelId: string
  /**
   * Skill IDs assigned to this agent.
   * Skills provide prompt-based knowledge — agents decide which tools to use autonomously.
   * All built-in tools are always available. Skills only add domain expertise via prompts.
   */
  skills: string[]
  temperature?: number
  maxTokens?: number
  enabled: boolean
  // Customization
  greeting?: string         // custom greeting message
  responseStyle?: 'concise' | 'detailed' | 'balanced'
  /** Hint for when this agent should be auto-selected (Claude Code's whenToUse) */
  whenToUse?: string
  /** Allowlist: restrict to specific tool names (empty = all tools available) */
  allowedTools?: string[]
  /** Denylist: block specific tools (like Claude Code's disallowedTools) */
  disallowedTools?: string[]
  /** Max agentic turns before stopping (like Claude Code's maxTurns) */
  maxTurns?: number
  /** Permission mode override (like Claude Code's permissionMode) */
  permissionMode?: 'default' | 'acceptEdits' | 'plan' | 'bypassPermissions'
  // Memory
  memories: AgentMemoryEntry[]
  /** Whether agent stores memory via memory_store tool (tool-based, not keyword detection) */
  autoLearn: boolean
}

// ─── Agent-to-Agent Communication ───────────────────────────────────

export type AgentMessageType = 'request' | 'response' | 'notification'
export type AgentMessageStatus = 'pending' | 'processing' | 'completed' | 'failed'

export interface AgentMessage {
  id: string
  fromAgentId: string
  toAgentId: string
  content: string
  type: AgentMessageType
  status: AgentMessageStatus
  timestamp: number
  parentMessageId?: string   // for threading
  result?: string
}

// ─── Skill System (prompt-based, aligned with skills.sh ecosystem) ──

/**
 * Skill source — where this skill was loaded from.
 * - 'local': Created locally in the workspace skills/ directory
 * - 'project': From .agents/skills/ or .claude/skills/ in the project
 * - 'user': From user-level global skills directory (~/.suora/skills/)
 * - 'registry': Installed from a skill registry (skills.sh, GitHub, custom)
 */
export type SkillSource = 'local' | 'project' | 'user' | 'registry' | 'workspace' | 'agent-dir' | 'claude-dir'

/**
 * Skill execution context — how the skill is activated.
 * - 'inline': Skill prompt is injected directly into the system prompt
 * - 'fork': Skill runs as a sub-agent conversation
 */
export type SkillExecutionContext = 'inline' | 'fork'

/**
 * Frontmatter metadata parsed from SKILL.md files.
 * Aligned with the open agent skills specification (skills.sh / agentskills.io).
 */
export interface SkillFrontmatter {
  name: string
  description: string
  /** Optional list of allowed tools (if empty, agent decides autonomously) */
  allowedTools?: string[]
  /** Hint for when this skill should be used (used by model for auto-invocation) */
  whenToUse?: string
  /** Arguments hint displayed in UI (e.g., "<file-path> [max-issues]") */
  argumentHint?: string
  /** Named arguments for parameterized skills */
  arguments?: string[]
  /** Version string (semver) */
  version?: string
  /** Whether users can invoke this skill directly (e.g., /skill-name) */
  userInvocable?: boolean
  /** Execution context: inline (inject into prompt) or fork (sub-agent) */
  context?: SkillExecutionContext
  /** Sub-agent type when context is 'fork' */
  agent?: string
  /** Icon identifier for UI display */
  icon?: string
  /** Skill category for organization */
  category?: string
  /** Author name */
  author?: string
}

/**
 * Reference file that gets loaded into the skill's prompt at runtime.
 */
export interface SkillReferenceFile {
  path: string            // relative or absolute file path
  label?: string          // optional display label (e.g., "API Documentation")
}

/**
 * Information about where a registry skill was installed from.
 */
export interface SkillInstallInfo {
  /** Registry source ID that this skill was installed from */
  sourceId: string
  /** Full repository identifier (e.g., 'vercel-labs/agent-skills') */
  repository: string
  /** Specific skill name within the repository */
  skillName: string
  /** Installed version / commit hash */
  installedVersion: string
  /** Timestamp of installation */
  installedAt: number
  /** Timestamp of last update check */
  lastCheckedAt?: number
  /** Whether an update is available */
  updateAvailable?: boolean
  /** Latest available version */
  latestVersion?: string
}

/**
 * Skill — prompt-based capability for AI agents.
 *
 * Skills are SKILL.md files with YAML frontmatter + markdown instructions.
 * They provide procedural knowledge (prompts) that enhance agent capabilities.
 * Tools are NOT specified in skills — agents decide which tools to use autonomously.
 *
 * Aligned with:
 * - Claude Code skill system (prompt-based, SKILL.md format)
 * - skills.sh open ecosystem (install from GitHub repos)
 * - Open Agent Skills specification (agentskills.io)
 */
export interface Skill {
  id: string
  name: string
  description: string
  /** Whether this skill is currently active */
  enabled: boolean
  /** Where this skill was loaded from */
  source: SkillSource
  /** Markdown instructions — the core of the skill (injected into system prompt) */
  content: string
  /** Parsed frontmatter metadata */
  frontmatter: SkillFrontmatter
  /** Optional allowed tools hint (from frontmatter, empty = agent decides) */
  allowedTools?: string[]
  /** When to use hint for auto-invocation */
  whenToUse?: string
  /** Execution context */
  context: SkillExecutionContext
  /** External reference files loaded into prompt at runtime */
  referenceFiles?: SkillReferenceFile[]
  /** Installation info for registry-sourced skills */
  installInfo?: SkillInstallInfo
  /** File path on disk (for local/project/user skills) */
  filePath?: string
  /** Skill directory root (for accessing auxiliary files like scripts) */
  skillRoot?: string
  /** Metadata for display */
  icon?: string
  category?: string
  author?: string
  version?: string
  /** Marketplace statistics (for registry skills) */
  downloads?: number
  rating?: number

  // ─── Legacy fields (backward compatibility) ──────────────────
  /** @deprecated Use source instead. Kept for backward compat with old store data. */
  type?: 'builtin' | 'custom' | 'marketplace'
  /** @deprecated Use content instead */
  prompt?: string
  /** @deprecated Tools are no longer defined in skills. Agents decide tools. */
  tools?: SkillTool[]
  /** @deprecated Custom code is no longer part of the skill system */
  customCode?: string
  /** @deprecated Use frontmatter.allowedTools instead */
  config?: Record<string, unknown>
  /** @deprecated Use installInfo or frontmatter instead */
  dependencies?: SkillDependency[]
  /** @deprecated Version changelog */
  changelog?: string
}

// ─── Legacy type aliases (backward compatibility) ──────────────────

/** @deprecated Use Skill.allowedTools instead */
export interface SkillTool {
  id: string
  name: string
  description: string
  params: SkillToolParam[]
}

/** @deprecated Use Skill.allowedTools instead */
export interface SkillToolParam {
  name: string
  type: 'string' | 'number' | 'boolean'
  description: string
  required: boolean
}

// ─── Skill Registry Sources ────────────────────────────────────────

/**
 * A skill registry source — where skills can be discovered and installed from.
 * Users can add custom sources alongside the default skills.sh.
 */
export interface SkillRegistrySource {
  id: string
  /** Display name (e.g., 'skills.sh', 'My Company Skills') */
  name: string
  /** Source type */
  type: 'skills.sh' | 'github' | 'gitlab' | 'local' | 'custom'
  /** URL or path to the source */
  url: string
  /** Whether this source is enabled */
  enabled: boolean
  /** Whether this is a built-in source (cannot be removed) */
  builtin?: boolean
  /** Optional description */
  description?: string
  /** Optional icon */
  icon?: string
  /** Last time the source was synced */
  lastSyncAt?: number
}

/**
 * A skill available for installation from a registry source.
 */
export interface RegistrySkillEntry {
  /** Unique key: 'source/repo/skill-name' */
  id: string
  name: string
  description: string
  author: string
  version: string
  repository: string
  sourceId: string
  /** Download/usage count */
  downloads: number
  /** Rating (0-5) */
  rating: number
  icon?: string
  category?: string
  /** Whether already installed locally */
  installed: boolean
  /** Whether an update is available */
  updateAvailable?: boolean
  /** URL to the skill in the registry */
  url?: string
  /** Raw content preview (first ~200 chars of SKILL.md body) */
  preview?: string
}

// ─── Marketplace Settings ──────────────────────────────────────────

/** @deprecated Use RegistrySkillEntry instead */
export interface MarketplaceSkill {
  id: string
  name: string
  description: string
  author: string
  version: string
  downloads: number
  rating: number
  icon: string
  category: string
  tools: SkillTool[]
  installed: boolean
}

export type TimerType = 'once' | 'interval' | 'cron'

export interface ScheduledTask {
  id: string
  name: string
  type: TimerType
  /** For 'once': ISO date string; for 'interval': repeat period in minutes; for 'cron': cron expression */
  schedule: string
  /** Action to perform: 'notify' sends a desktop notification, 'prompt' sends a prompt to an agent, 'pipeline' runs a saved pipeline */
  action: 'notify' | 'prompt' | 'pipeline'
  /** Notification body or agent prompt text */
  prompt?: string
  /** Agent ID to execute when action is 'prompt' */
  agentId?: string
  /** Pipeline ID to execute when action is 'pipeline' */
  pipelineId?: string
  enabled: boolean
  createdAt: number
  updatedAt: number
  lastRun?: number
  nextRun?: number
}

export interface TimerExecution {
  id: string
  timerId: string
  firedAt: number
  action: 'notify' | 'prompt' | 'pipeline'
  prompt?: string
  agentId?: string
  pipelineId?: string
  pipelineExecutionId?: string
  /** Session ID created for agent prompt executions */
  sessionId?: string
  status: 'success' | 'error'
  error?: string
}

export interface PluginManifest {
  name: string
  version: string
  author?: string
  description?: string
  hooks?: string[]
  config?: Record<string, unknown>
}

export interface ToolSecuritySettings {
  allowedDirectories: string[]
  blockedCommands: string[]
  requireConfirmation: boolean
}

// ─── Skill Security (signing) ──────────────────────────────────────

export interface SkillSignature {
  hash: string           // SHA-256 hash of the skill content
  signedAt: number       // timestamp
  signedBy: string       // who/what signed it (e.g. 'user', 'marketplace')
  verified: boolean      // whether the hash still matches current content
}

// ─── Event-Driven Automation ───────────────────────────────────────

export type EventTriggerType = 'file_change' | 'clipboard_change' | 'schedule' | 'app_start'

export interface EventTrigger {
  id: string
  name: string
  type: EventTriggerType
  /** For file_change: glob pattern; for schedule: cron expression; for others: unused */
  pattern?: string
  /** Agent ID to handle the event */
  agentId: string
  /** Prompt template to send to the agent (supports {{file}}, {{content}} placeholders) */
  promptTemplate: string
  enabled: boolean
  createdAt: number
  lastTriggered?: number
}

// ─── File Attachment ───────────────────────────────────────────────

export interface FileAttachment {
  id: string
  name: string
  mimeType: string
  size: number
  data: string           // base64 encoded data
}

export interface MarketplaceSettings {
  source: 'official' | 'private'
  privateUrl: string
  /** Custom skill registry sources (skills.sh is always included as built-in) */
  registrySources: SkillRegistrySource[]
}

// ─── Provider Configuration ────────────────────────────────────────

export interface ProviderModelEntry {
  modelId: string
  name: string
  enabled: boolean
  temperature?: number
  maxTokens?: number
}

export interface ProviderConfig {
  id: string              // unique key, e.g. 'anthropic', 'my-deepseek'
  name: string            // display name, e.g. 'Anthropic', 'My DeepSeek'
  apiKey: string
  baseUrl: string
  providerType:
    | 'anthropic'           // Anthropic Claude
    | 'openai'              // OpenAI official
    | 'google'              // Google Gemini
    | 'ollama'              // Local Ollama
    | 'deepseek'            // DeepSeek (China)
    | 'zhipu'               // 智谱 AI (China)
    | 'minimax'             // MiniMax (China)
    | 'groq'                // Groq (fast inference)
    | 'together'            // Together AI
    | 'fireworks'           // Fireworks AI
    | 'perplexity'          // Perplexity AI
    | 'cohere'              // Cohere
    | 'openai-compatible'   // Generic OpenAI-compatible
  models: ProviderModelEntry[]
}

export interface ExternalDirectoryConfig {
  path: string
  enabled: boolean
  type: 'agents' | 'skills'
}

export interface WorkspaceSettings {
  providers: ProviderConfig[]
  externalDirectories?: ExternalDirectoryConfig[]
}

// ─── Channel Integration ───────────────────────────────────────────

export type ChannelPlatform =
  | 'wechat'              // WeChat Work (企业微信)
  | 'wechat_official'     // WeChat Official Account (微信公众号)
  | 'wechat_miniprogram'  // WeChat Mini Program (微信小程序)
  | 'feishu'              // Feishu / Lark (飞书)
  | 'dingtalk'            // DingTalk (钉钉)
  | 'slack'               // Slack
  | 'telegram'            // Telegram
  | 'discord'             // Discord
  | 'teams'               // Microsoft Teams
  | 'custom'              // User-defined custom channel
export type ChannelStatus = 'active' | 'inactive' | 'error'

export interface ChannelMessage {
  id: string
  channelId: string
  platform: ChannelPlatform
  senderId: string
  senderName?: string
  content: string
  timestamp: number
  messageType: 'text' | 'image' | 'file' | 'voice'
  chatId?: string  // Group/conversation ID
  chatType?: 'private' | 'group'
}

export type ChannelConnectionMode = 'webhook' | 'stream'

export interface ChannelConfig {
  id: string
  name: string
  platform: ChannelPlatform
  enabled: boolean
  status: ChannelStatus

  // Connection mode: webhook (HTTP callback) or stream (WebSocket long connection)
  connectionMode: ChannelConnectionMode

  // Webhook configuration (used when connectionMode = 'webhook')
  webhookPath: string      // e.g., '/webhook/feishu/xxxx'
  webhookSecret?: string   // For signature verification

  // Platform-specific config (common)
  appId?: string
  appSecret?: string
  verificationToken?: string
  encryptKey?: string

  // Slack-specific config
  slackBotToken?: string         // xoxb-* Bot User OAuth Token
  slackSigningSecret?: string    // Signing secret for verifying webhook requests

  // Telegram-specific config
  telegramBotToken?: string      // Bot token from @BotFather

  // Discord-specific config
  discordBotToken?: string       // Discord bot token
  discordApplicationId?: string  // Discord application ID

  // Teams-specific config
  teamsAppId?: string            // Microsoft App ID (from Azure Bot registration)
  teamsAppPassword?: string      // Microsoft App Password (client secret)
  teamsTenantId?: string         // Azure AD Tenant ID (optional, for single-tenant apps)

  // WeChat Official Account specific config
  wechatOfficialAppId?: string   // Official Account AppID
  wechatOfficialAppSecret?: string
  wechatOfficialToken?: string   // Token for message verification

  // Custom channel config (user-defined webhook integration)
  customWebhookUrl?: string      // URL to send outgoing messages to
  customAuthHeader?: string      // e.g., "Authorization: Bearer xxx" or custom header
  customAuthValue?: string       // Auth header value
  customPayloadTemplate?: string // JSON template for outgoing payload, use {{content}} and {{chatId}} placeholders
  customPlatformName?: string    // Display name for the custom platform (e.g., "My Bot", "LINE")
  customPlatformIcon?: string    // Icon name or short text as icon (e.g., "ui-robot")

  // Behavior
  autoReply: boolean
  replyAgentId: string     // Which agent handles messages from this channel
  allowedChats?: string[]  // Whitelist of chat IDs (empty = all allowed)

  // Stats
  createdAt: number
  lastMessageAt?: number
  messageCount: number
}

export interface ChannelResponse {
  success: boolean
  message?: string
  data?: unknown
}

// ─── Channel Message History ───────────────────────────────────────

export type ChannelMessageDirection = 'incoming' | 'outgoing'

export interface ChannelHistoryMessage {
  id: string
  channelId: string
  direction: ChannelMessageDirection
  platform: ChannelPlatform
  senderId: string
  senderName?: string
  content: string
  timestamp: number
  status: 'sent' | 'delivered' | 'failed' | 'pending'
  retryCount?: number
}

// ─── Channel Access Token ──────────────────────────────────────────

export interface ChannelAccessToken {
  channelId: string
  token: string
  expiresAt: number
  refreshAt: number       // when to refresh (e.g., 5 min before expiry)
  lastRefreshed: number
}

// ─── Channel Health & Debug ────────────────────────────────────────

export interface ChannelHealthStatus {
  channelId: string
  isHealthy: boolean
  lastCheckAt: number
  latencyMs?: number
  errorCount: number
  lastError?: string
}

// ─── Channel Multi-User Support ────────────────────────────────────

export interface ChannelUser {
  id: string               // Unique key: `${channelId}:${senderId}`
  channelId: string
  senderId: string         // Platform-specific user ID
  senderName: string       // Display name
  platform: ChannelPlatform
  firstSeenAt: number      // Timestamp of first interaction
  lastActiveAt: number     // Timestamp of last message
  messageCount: number     // Total messages from this user
  // Per-user conversation context (recent messages for multi-turn conversations)
  conversationHistory: ChannelUserConversationMessage[]
}

export interface ChannelUserConversationMessage {
  role: 'user' | 'assistant'
  content: string
  timestamp: number
}

// ─── Plugin System ─────────────────────────────────────────────────

export type PluginStatus = 'installed' | 'enabled' | 'disabled' | 'error'

export type PluginHookType =
  | 'beforeMessage'
  | 'afterResponse'
  | 'onAgentExecute'
  | 'onSessionCreate'
  | 'onSessionDelete'
  | 'onAppStart'
  | 'onAppStop'

export interface PluginInfo {
  id: string
  name: string
  version: string
  author: string
  description: string
  status: PluginStatus
  hooks: PluginHookType[]
  config: Record<string, unknown>
  installedAt: number
  icon?: string
  homepage?: string
  error?: string
  permissions?: PluginPermission[]
  configSchema?: Record<string, PluginConfigField>
  settingsUI?: boolean
  messageRenderer?: boolean
  latestVersion?: string        // for update detection
  entryPoint?: string
}

// ─── Agent Version Management ──────────────────────────────────────

export interface AgentVersion {
  id: string
  agentId: string
  version: number
  snapshot: Omit<Agent, 'memories'>   // full agent config snapshot (minus memories)
  createdAt: number
  label?: string
}

// ─── Agent Performance Stats ───────────────────────────────────────

export interface AgentPerformanceStats {
  agentId: string
  totalCalls: number
  totalTokens: number
  avgResponseTimeMs: number
  responseTimes: number[]     // last 50 response times
  lastUsed: number
  errorCount: number
}

export interface AgentPipelineStep {
  agentId: string
  task: string
  name?: string
  enabled?: boolean
  continueOnError?: boolean
  retryCount?: number
  timeoutMs?: number
  maxInputChars?: number
  maxOutputChars?: number
  outputType?: 'text' | 'json' | 'file' | 'table'
  /**
   * Optional condition expression evaluated before the step runs. When the
   * expression is falsy the step is recorded as 'skipped' with the failed
   * condition as the reason. Supports references to previous steps
   * (e.g. `step1.status == 'success'`, `previous.output contains 'approved'`)
   * and pipeline variables (`vars.NAME != ''`). Multiple clauses may be
   * combined with `&&` (AND).
   */
  runIf?: string
}

export type AgentPipelineTrigger = 'manual' | 'timer' | 'chat'

/**
 * Declarative variable definition for an `AgentPipeline`. Values are supplied
 * at run time (manual run dialog, timer trigger, or chat-command named args)
 * and are referenced inside step tasks / `runIf` conditions as `{{vars.name}}`.
 */
export interface AgentPipelineVariable {
  name: string
  label?: string
  description?: string
  defaultValue?: string
  required?: boolean
}

export interface AgentPipeline {
  id: string
  name: string
  description?: string
  steps: AgentPipelineStep[]
  variables?: AgentPipelineVariable[]
  createdAt: number
  updatedAt: number
  lastRunAt?: number
}

export interface PipelineStepUsage {
  promptTokens: number
  completionTokens: number
  totalTokens: number
}

export interface AgentPipelineExecutionStep {
  id: string
  runId?: string
  stepIndex: number
  agentId: string
  name?: string
  task: string
  input: string
  output?: string
  status: 'success' | 'error' | 'skipped'
  startedAt: number
  completedAt: number
  durationMs: number
  attempts?: number
  error?: string
  outputType?: AgentPipelineStep['outputType']
  outputRef?: string
  warnings?: string[]
  recoveryActions?: PipelineRecoveryAction[]
  /** Token usage reported by the model provider for this step. */
  usage?: PipelineStepUsage
  /** When `status === 'skipped'`, the reason the step was skipped (e.g. condition not met). */
  skipReason?: string
}

export interface PipelineRecoveryAction {
  id: 'retry-step' | 'rerun-from-step' | 'skip-step' | 'open-agent' | 'open-model' | 'edit-pipeline'
  label: string
  stepIndex?: number
  agentId?: string
  modelId?: string
}

export interface PipelineRuntimeSnapshot {
  runId: string
  agentIds: string[]
  modelIds: string[]
  startedAt: number
  trigger: AgentPipelineTrigger
  validationWarnings?: string[]
  /** Variable values supplied to this run; surfaced for debugging and replay. */
  variables?: Record<string, string>
}

export interface AgentPipelineExecution {
  id: string
  runId?: string
  pipelineId: string
  pipelineName: string
  trigger: AgentPipelineTrigger
  timerId?: string
  startedAt: number
  completedAt: number
  status: 'success' | 'error'
  steps: AgentPipelineExecutionStep[]
  finalOutput?: string
  error?: string
  runtime?: PipelineRuntimeSnapshot
  recoveryActions?: PipelineRecoveryAction[]
  /** Aggregated token usage across all successful steps. */
  usage?: PipelineStepUsage
}

// ─── i18n ──────────────────────────────────────────────────────────

export type AppLocale = 'en' | 'zh' | 'ja' | 'ko' | 'fr' | 'de' | 'es' | 'pt' | 'ru' | 'ar'

// ─── Email Configuration ──────────────────────────────────────────

export interface EmailConfig {
  smtpHost: string
  smtpPort: number
  secure: boolean           // true for TLS (465), false for STARTTLS (587)
  username: string
  password: string          // stored encrypted via safe-storage
  fromName: string          // display name in From header
  fromAddress: string       // email address in From header
  enabled: boolean
}

// ─── Environment Variables ────────────────────────────────────────

export interface EnvVariable {
  key: string             // variable name, e.g. 'DB_PASSWORD'
  value: string           // variable value (stored encrypted via safe-storage)
  description?: string    // optional human-readable description
  secret: boolean         // true = masked in UI and logs
  createdAt: number
  updatedAt: number
}

// ─── Proxy/Network Settings ───────────────────────────────────────

export interface ProxySettings {
  enabled: boolean
  type: 'http' | 'https' | 'socks5'
  host: string
  port: number
  username?: string
  password?: string
}

// ─── Onboarding ────────────────────────────────────────────────────

export interface OnboardingState {
  completed: boolean
  currentStep: number
  skipped: boolean
}

// ─── Plugin Permission Model ───────────────────────────────────────

export type PluginPermission =
  | 'messages:read'        // read chat messages
  | 'messages:write'       // modify/send messages
  | 'agents:read'          // read agent configs
  | 'agents:write'         // modify agent configs
  | 'skills:read'          // read skill definitions
  | 'skills:write'         // modify skills
  | 'sessions:read'        // read session data
  | 'sessions:write'       // create/modify sessions
  | 'settings:read'        // read settings
  | 'settings:write'       // modify settings
  | 'tools:register'       // register new AI SDK tools
  | 'ui:extend'            // inject UI components
  | 'network:outbound'     // make external HTTP requests
  | 'filesystem:read'      // read files
  | 'filesystem:write'     // write files

export interface PluginAPIContext {
  /** Current plugin id */
  pluginId: string
  /** Granted permissions */
  permissions: PluginPermission[]
  /** Host API surface accessible to plugins */
  api: {
    messages: {
      getHistory: (sessionId: string) => { role: string; content: string }[]
      sendToAgent: (agentId: string, message: string) => Promise<string>
    }
    agents: {
      list: () => { id: string; name: string }[]
      getById: (id: string) => { id: string; name: string; systemPrompt: string } | null
    }
    sessions: {
      getCurrent: () => { id: string; title: string } | null
      create: (title: string) => string
    }
    settings: {
      get: (key: string) => unknown
      set: (key: string, value: unknown) => void
    }
    tools: {
      register: (name: string, definition: unknown) => void
      unregister: (name: string) => void
    }
    ui: {
      showNotification: (message: string, type?: 'info' | 'success' | 'warning' | 'error') => void
    }
  }
}

// ─── Plugin Manifest (extended) ────────────────────────────────────

export interface PluginManifestV2 {
  id: string
  name: string
  version: string
  author: string
  description: string
  homepage?: string
  icon?: string
  hooks: PluginHookType[]
  permissions: PluginPermission[]
  config?: Record<string, PluginConfigField>
  minAppVersion?: string
  entryPoint?: string        // relative path to main module
  settingsUI?: boolean       // whether plugin provides custom settings component
  messageRenderer?: boolean  // whether plugin provides custom message renderer
}

export interface PluginConfigField {
  type: 'string' | 'number' | 'boolean' | 'select'
  label: string
  description?: string
  default?: unknown
  options?: { label: string; value: unknown }[]  // for type='select'
  required?: boolean
}

// ─── MCP System ───────────────────────────────────────────────────

export type MCPTransport = 'stdio' | 'http' | 'sse' | 'ws'

export type MCPServerScope = 'workspace' | 'user'

export type MCPServerStatus = 'connected' | 'disconnected' | 'connecting' | 'failed'

export interface MCPServerConfig {
  id: string
  name: string
  enabled: boolean
  transport: MCPTransport
  scope: MCPServerScope
  command?: string
  args?: string[]
  env?: Record<string, string>
  url?: string
  headers?: Record<string, string>
  status?: MCPServerStatus
  lastConnectedAt?: number
  error?: string
  tools?: string[]
}

// ─── Skill Version Management ──────────────────────────────────────

export interface SkillVersion {
  id: string
  skillId: string
  version: string           // semver string
  snapshot: Omit<Skill, 'id'>
  createdAt: number
  label?: string
}

// ─── Skill Dependency ──────────────────────────────────────────────

export interface SkillDependency {
  skillId: string            // required skill ID
  minVersion?: string        // minimum version (semver)
  optional?: boolean         // true = soft dependency
}
