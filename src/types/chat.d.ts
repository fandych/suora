export type ChatMessageCursor = {
  createdAt: number
  id: string
}

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
  nextCursor?: ChatMessageCursor | null
}

export type ChatErrorKind = "step-limit" | "timeout" | "tool" | "permission" | "request" | "unknown"

export type ChatToolActivity = {
  id: string
  toolName: string
  input?: Record<string, unknown>
  output?: string
  error?: string
  stopped?: boolean
}

export type ChatAttachmentRecord = {
  id: string
  sourceKey: string
  name: string
  mediaType: string
  data: string
  kind: "image" | "file"
  sizeBytes?: number
}

export type ChatMessagePart =
  | { id: string; type: "text"; content: string; isPending?: boolean }
  | { id: string; type: "tool"; activity: ChatToolActivity }
  | { id: string; type: "attachment"; attachment: ChatAttachmentRecord }

export type ChatAgentEvent =
  | { type: "text-delta"; text: string }
  | { type: "tool-call"; toolCallId: string; toolName: string; input: Record<string, unknown> }
  | { type: "tool-result"; toolCallId: string; toolName: string; output: string }
  | { type: "error"; error: string; errorKind: ChatErrorKind }

export type ChatAttachment = ChatAttachmentRecord
export type ChatRuntimeToolActivity = ChatToolActivity

export type ChatModelConfig = {
  providerId: string
  providerType: string
  modelId: string
  baseUrl: string
  apiKey: string
  systemPrompt: string
}

export type ProxyConfig = {
  enabled: boolean
  type: "http" | "https" | "socks5"
  host: string
  port: number
  username: string
  password: string
  rejectUnauthorized: boolean
  ignoreSslErrors: boolean
}

export type ChatRuntimeSettings = {
  model: ChatModelConfig
  proxy: ProxyConfig
  requestTimeoutMs: number
  maxSteps: number
}

export type ChatSessionSettings = { runtime: ChatRuntimeSettings; selectedAgentId: string }
export type ChatRuntimeStatus = {
  requestId: string
  chatId: string
  status: "running" | "completed" | "failed" | "cancelled"
  error?: string
  errorKind?: ChatErrorKind
  updatedAt: number
}

export type AssistantResponsePart =
  | { id: string; type: "text"; content: string; isPending?: boolean }
  | { id: string; type: "tool"; activity: ChatToolActivity; stepLabel?: string }
