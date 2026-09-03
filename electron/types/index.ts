import type { ClientRequest } from "node:http"
import type { BrowserWindow } from "electron"
import type { DatabaseSync } from "node:sqlite"

export type SqliteDatabase = DatabaseSync

export type QueryMethod = "run" | "all" | "values" | "get"

export type ProxySettings = {
  enabled: boolean
  type: "http" | "https" | "socks5"
  host: string
  port: number
  username?: string
  password?: string
  rejectUnauthorized?: boolean
  ignoreSslErrors?: boolean
}

export type QueryPayload = {
  sql: string
  params: unknown[]
  method: QueryMethod
}

export type AiFetchStartPayload = {
  url: string
  method?: string
  headers?: Record<string, string>
  bodyText?: string
  bodyBase64?: string
  timeoutMs?: number
}

export type IntegrationExecutePayload = {
  kind: "http" | "scripts" | "mcp"
  config: Record<string, unknown>
  inputJson?: string
}

export type SendMailPayload = {
  to: string
  subject: string
  content: string
}

export type ChatRuntimeSettingsPayload = {
  model: {
    providerId: string
    providerType: string
    modelId: string
    baseUrl: string
    apiKey: string
    systemPrompt: string
  }
  proxy: ProxySettings
}

export type AppState = {
  isDev: boolean
  mainWindow: BrowserWindow | null
  browserWindow: BrowserWindow | null
  sqlite: SqliteDatabase | null
  activeAiRequests: Map<string, ClientRequest>
  currentProxySettings: ProxySettings
}
