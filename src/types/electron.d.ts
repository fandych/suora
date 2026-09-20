import type { RecentlyDeletedResourceEntry, RecentlyDeletedRestoreResult, RecentlyDeletedResourceKind } from "@/types/system"
import type {
  WorkflowRunAccepted,
  WorkflowRunCancelResult,
  WorkflowRunEvent,
  WorkflowRunStartCommand,
} from "@/types/workflow"
import type { BrowserWindow } from "electron"
import type { ClientRequest } from "node:http"
import type { DatabaseSync } from "node:sqlite"

export {}

type SendMailPayload = {
  to: string
  subject: string
  content: string
  html?: string
  attachments?: Array<{
    filename?: string
    content?: string
    dataBase64?: string
    path?: string
    href?: string
    contentType?: string
    cid?: string
    encoding?: "base64" | "hex" | "binary" | "quoted-printable"
  }>
}

export type { SendMailPayload }
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
  requestTimeoutMs?: number
  maxSteps?: number
}

export type QueryMethod = "run" | "all" | "values" | "get"

export type QueryPayload = {
  sql: string
  params: unknown[]
  method: QueryMethod
}

export type SqliteDatabase = DatabaseSync

export type BrowserWindowState = {
  open: boolean
  visible: boolean
  url: string
  loading?: boolean
  error?: string
}

export type BrowserPageSnapshot = BrowserWindowState & {
  title: string
  text?: string
  links?: Array<{ text: string; href: string }>
  clicked?: string
  filled?: string
}

export type AiFetchStartPayload = {
  url: string
  method?: string
  headers?: Record<string, string>
  bodyText?: string
  bodyBase64?: string
  timeoutMs?: number
}

export type AppState = {
  isDev: boolean
  mainWindow: BrowserWindow | null
  browserWindow: BrowserWindow | null
  browserWindows: Map<string, BrowserWindow>
  sqlite: SqliteDatabase | null
  activeAiRequests: Map<string, ClientRequest>
  currentProxySettings: ProxySettings
}

declare global {
  interface Window {
    electron?: {
      invoke: (channel: string, ...args: unknown[]) => Promise<unknown>
      on: (channel: string, listener: (...args: unknown[]) => void) => void
      off: (channel: string, listener: (...args: unknown[]) => void) => void
    }
    app?: {
      system: {
        info: () => Promise<unknown>
        diagnostics: () => Promise<unknown>
        listRecentlyDeleted: (kind?: RecentlyDeletedResourceKind) => Promise<RecentlyDeletedResourceEntry[]>
        restoreRecentlyDeleted: (entryId: string) => Promise<RecentlyDeletedRestoreResult>
      }
      workspace: {
        getPaths: () => Promise<unknown>
        setProxySettings: (settings: unknown) => Promise<unknown>
        getProxySettings: () => Promise<unknown>
      }
      chats: {
        list: () => Promise<unknown>
        get: (payload: string | { chatId: string; limit?: number; beforeCursor?: { createdAt: number; id: string } }) => Promise<unknown>
        create: (defaults?: unknown) => Promise<unknown>
        ensure: (payload: unknown) => Promise<unknown>
        delete: (chatId: string) => Promise<unknown>
        appendUser: (payload: unknown) => Promise<unknown>
        appendAssistant: (payload: unknown) => Promise<unknown>
        updateMessageParts: (payload: unknown) => Promise<unknown>
        getSettings: () => Promise<unknown>
        saveSettings: (payload: unknown) => Promise<unknown>
        getSessionSettings: (chatId?: string | null) => Promise<unknown>
        saveSessionSettings: (payload: unknown) => Promise<unknown>
        sendMessage: (payload: unknown) => Promise<unknown>
        cancelRuntime: (requestId: string) => Promise<unknown>
        getRuntimeStatus: (requestId: string) => Promise<unknown>
        retryToolActivity: (payload: unknown) => Promise<unknown>
        onRuntimeEvent: (listener: (...args: unknown[]) => void) => void
        offRuntimeEvent: (listener: (...args: unknown[]) => void) => void
      }
      documents: {
        list: () => Promise<unknown>
        get: (documentId: string, versionId?: string) => Promise<unknown>
        getFileTree: (documentId: string, versionId?: string) => Promise<unknown>
        getFile: (documentId: string, fileId: string, versionId?: string) => Promise<unknown>
        create: () => Promise<unknown>
        createWithMetadata: (payload: unknown) => Promise<unknown>
        save: (payload: unknown) => Promise<unknown>
        delete: (documentId: string) => Promise<unknown>
      }
      database: {
        ping: () => Promise<unknown>
        syncChannelCatalog: (payload: unknown) => Promise<unknown>
      }
      models: {
        list: () => Promise<unknown>
        get: (providerId: string) => Promise<unknown>
        create: (payload?: unknown) => Promise<unknown>
        save: (payload: unknown) => Promise<unknown>
        delete: (providerId: string) => Promise<unknown>
        discover: (payload: unknown) => Promise<unknown>
        configured: () => Promise<unknown>
        listPresets: () => Promise<unknown>
        getPreset: (providerType: string) => Promise<unknown>
        getDefaultBaseUrl: (providerType: string) => Promise<unknown>
        allowsNoKey: (providerType: string) => Promise<unknown>
        getDiscoveryState: (payload: unknown) => Promise<unknown>
      }
      skills: {
        listAll: (options?: unknown) => Promise<unknown>
        listExternal: () => Promise<unknown>
        get: (skillId: string) => Promise<unknown>
        getExternal: (skillId: string) => Promise<unknown>
        getFileTree: (skillId: string) => Promise<unknown>
        getFile: (skillId: string, filePath: string) => Promise<unknown>
        create: () => Promise<unknown>
        save: (payload: unknown) => Promise<unknown>
        delete: (skillId: string) => Promise<unknown>
      }
      agents: {
        listAll: (options?: unknown) => Promise<unknown>
        get: (agentId: string) => Promise<unknown>
        create: () => Promise<unknown>
        save: (payload: unknown) => Promise<unknown>
        delete: (agentId: string) => Promise<unknown>
        getSettings: () => Promise<unknown>
        saveSettings: (payload: unknown) => Promise<unknown>
      }
      integrations: {
        list: () => Promise<unknown>
        get: (integrationId: string, versionId?: string) => Promise<unknown>
        create: (payload?: unknown) => Promise<unknown>
        fetchApiDoc: (sourceUrl: string) => Promise<unknown>
        save: (payload: unknown) => Promise<unknown>
        setEnabled: (payload: unknown) => Promise<unknown>
        delete: (integrationId: string) => Promise<unknown>
        recordExecution: (payload: unknown) => Promise<unknown>
        execute: (payload: unknown) => Promise<unknown>
      }
      workflows: {
        list: () => Promise<unknown>
        get: (workflowId: string, versionId?: string) => Promise<unknown>
        create: () => Promise<unknown>
        save: (payload: unknown) => Promise<unknown>
        delete: (workflowId: string) => Promise<unknown>
        recordInvocation: (payload: unknown) => Promise<unknown>
        startRun: (payload: WorkflowRunStartCommand) => Promise<WorkflowRunAccepted>
        cancelRun: (requestId: string) => Promise<WorkflowRunCancelResult>
        onRunEvent: (listener: (_event: Electron.IpcRendererEvent, payload: WorkflowRunEvent) => void) => void
        offRunEvent: (listener: (_event: Electron.IpcRendererEvent, payload: WorkflowRunEvent) => void) => void
      }
      channels: {
        listAll: () => Promise<unknown>
        get: (channelId: string) => Promise<unknown>
        create: (defaults?: unknown) => Promise<unknown>
        save: (payload: unknown) => Promise<unknown>
        delete: (channelId: string) => Promise<unknown>
        startRuntime: () => Promise<unknown>
        syncRuntime: () => Promise<unknown>
        stopRuntime: () => Promise<unknown>
        getRuntimeStatus: () => Promise<unknown>
        registerRuntime: () => Promise<unknown>
        getWebhookUrl: (payload: { id: string }) => Promise<unknown>
        sendMessage: (payload: unknown) => Promise<unknown>
        sendMessageQueued: (payload: unknown) => Promise<unknown>
        getAccessToken: (channelId: string) => Promise<unknown>
        healthCheck: (channelId: string) => Promise<unknown>
        getStreamStatus: (channelId: string) => Promise<unknown>
        debugSend: (payload: unknown) => Promise<unknown>
        startWeChatPersonalLogin: (channelId?: string, force?: boolean) => Promise<unknown>
        waitForWeChatPersonalLogin: (
          channelId: string | undefined,
          sessionKey: string,
          verifyCode?: string,
          timeoutMs?: number,
        ) => Promise<unknown>
        getWeChatPersonalQrPreview: (url: string, waitMs?: number) => Promise<unknown>
      }
      schedulers: {
        list: () => Promise<unknown>
        get: (schedulerId: string) => Promise<unknown>
        create: () => Promise<unknown>
        save: (payload: unknown) => Promise<unknown>
        setEnabled: (payload: unknown) => Promise<unknown>
        listRuns: (schedulerId: string) => Promise<unknown>
        delete: (schedulerId: string) => Promise<unknown>
      }
      preferences: {
        get: () => Promise<unknown>
        save: (value: string) => Promise<unknown>
      }
      updater: {
        getState: () => Promise<unknown>
        check: () => Promise<unknown>
      }
      mail: {
        send: (payload: SendMailPayload) => Promise<unknown>
      }
      tools: {
        listFiles: (relativePath?: string) => Promise<unknown>
        readFile: (relativePath: string) => Promise<unknown>
        writeFile: (payload: unknown) => Promise<unknown>
        runCommand: (payload: unknown) => Promise<unknown>
        browserNavigate: (payload: unknown) => Promise<unknown>
        browserState: (sessionId?: string) => Promise<unknown>
        browserPage: (payload: unknown) => Promise<unknown>
        browserClick: (payload: unknown) => Promise<unknown>
        browserFill: (payload: unknown) => Promise<unknown>
        saveFile: (payload: unknown) => Promise<unknown>
        openExternal: (url: string) => Promise<unknown>
      }
    }
  }
}
