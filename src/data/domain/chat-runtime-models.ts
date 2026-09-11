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

export type ChatSessionSettings = {
  runtime: ChatRuntimeSettings
  selectedAgentId: string
}
