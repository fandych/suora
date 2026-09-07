export {}

import type { SendMailPayload } from "@electron/types"

declare global {
  interface Window {
    electron?: {
      invoke: (channel: string, ...args: unknown[]) => Promise<unknown>
      on: (channel: string, listener: (...args: unknown[]) => void) => void
      off: (channel: string, listener: (...args: unknown[]) => void) => void
    }
    suora?: {
      system: {
        info: () => Promise<unknown>
        diagnostics: () => Promise<unknown>
      }
      workspace: {
        getPaths: () => Promise<unknown>
        setProxySettings: (settings: unknown) => Promise<unknown>
        getProxySettings: () => Promise<unknown>
      }
      chats: {
        list: () => Promise<unknown>
        get: (chatId: string) => Promise<unknown>
        create: (defaults?: unknown) => Promise<unknown>
        ensure: (payload: unknown) => Promise<unknown>
        delete: (chatId: string) => Promise<unknown>
        appendUser: (payload: unknown) => Promise<unknown>
        appendAssistant: (payload: unknown) => Promise<unknown>
        updateMessageParts: (payload: unknown) => Promise<unknown>
        getSettings: () => Promise<unknown>
        saveSettings: (payload: unknown) => Promise<unknown>
      }
      documents: {
        list: () => Promise<unknown>
        get: (documentId: string, versionId?: string) => Promise<unknown>
        create: () => Promise<unknown>
        save: (payload: unknown) => Promise<unknown>
        delete: (documentId: string) => Promise<unknown>
      }
      db: {
        execute: (payload: unknown) => Promise<unknown>
      }
      models: {
        list: () => Promise<unknown>
        get: (providerId: string) => Promise<unknown>
        create: (payload?: unknown) => Promise<unknown>
        save: (payload: unknown) => Promise<unknown>
        delete: (providerId: string) => Promise<unknown>
        discover: (payload: unknown) => Promise<unknown>
      }
      skills: {
        list: () => Promise<unknown>
        listExternal: () => Promise<unknown>
        get: (skillId: string) => Promise<unknown>
        create: () => Promise<unknown>
        save: (payload: unknown) => Promise<unknown>
        delete: (skillId: string) => Promise<unknown>
      }
      agents: {
        list: () => Promise<unknown>
        get: (agentId: string) => Promise<unknown>
        create: () => Promise<unknown>
        save: (payload: unknown) => Promise<unknown>
        delete: (agentId: string) => Promise<unknown>
        getSettings: () => Promise<unknown>
        saveSettings: (payload: unknown) => Promise<unknown>
      }
      integrations: {
        list: () => Promise<unknown>
        get: (integrationId: string) => Promise<unknown>
        create: (payload?: unknown) => Promise<unknown>
        save: (payload: unknown) => Promise<unknown>
        recordExecution: (payload: unknown) => Promise<unknown>
        execute: (payload: unknown) => Promise<unknown>
      }
      workflows: {
        list: () => Promise<unknown>
        get: (workflowId: string) => Promise<unknown>
        create: () => Promise<unknown>
        save: (payload: unknown) => Promise<unknown>
        delete: (workflowId: string) => Promise<unknown>
        recordInvocation: (payload: unknown) => Promise<unknown>
      }
      channels: {
        list: () => Promise<unknown>
        get: (channelId: string) => Promise<unknown>
        create: (defaults?: unknown) => Promise<unknown>
        save: (payload: unknown) => Promise<unknown>
        delete: (channelId: string) => Promise<unknown>
        startRuntime: () => Promise<unknown>
        stopRuntime: () => Promise<unknown>
        getRuntimeStatus: () => Promise<unknown>
        registerRuntime: () => Promise<unknown>
        getWebhookUrl: (channel: unknown) => Promise<unknown>
        sendMessage: (payload: unknown) => Promise<unknown>
        sendMessageQueued: (payload: unknown) => Promise<unknown>
        getAccessToken: (channelId: string) => Promise<unknown>
        healthCheck: (channelId: string) => Promise<unknown>
        getStreamStatus: (channelId: string) => Promise<unknown>
        debugSend: (payload: unknown) => Promise<unknown>
        startWeChatPersonalLogin: (channelId?: string, force?: boolean) => Promise<unknown>
        waitForWeChatPersonalLogin: (channelId: string | undefined, sessionKey: string, verifyCode?: string, timeoutMs?: number) => Promise<unknown>
        getWeChatPersonalQrPreview: (url: string, waitMs?: number) => Promise<unknown>
      }
      schedulers: {
        list: () => Promise<unknown>
        get: (schedulerId: string) => Promise<unknown>
        create: () => Promise<unknown>
        save: (payload: unknown) => Promise<unknown>
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