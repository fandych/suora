import { contextBridge, ipcRenderer } from "electron"

import type { SendMailPayload } from "@/types/electron"
import { channelApi } from "@/electron/preload/channels/channel-api"

const allowedInvokeChannels = new Set([
  "ai:fetch:abort",
  "ai:fetch:start",
  "channel:wechatPersonalQrPreview",
  "integration:execute",
])

const allowedEventChannels = new Set([
  "ai:fetch:event",
  "channel:message",
  "workflow:run:event",
  "tools:browserStateChanged",
])

contextBridge.exposeInMainWorld("electron", {
  invoke: (channel: string, ...args: unknown[]) => {
    if (!allowedInvokeChannels.has(channel)) {
      throw new Error(`Direct invoke channel is blocked in preload: ${channel}`)
    }

    return ipcRenderer.invoke(channel, ...args)
  },
  on: (channel: string, listener: (...args: unknown[]) => void) => {
    if (!allowedEventChannels.has(channel)) {
      throw new Error(`Direct event subscription is blocked in preload: ${channel}`)
    }

    ipcRenderer.on(channel, listener)
  },
  off: (channel: string, listener: (...args: unknown[]) => void) => {
    if (!allowedEventChannels.has(channel)) {
      throw new Error(`Direct event subscription is blocked in preload: ${channel}`)
    }

    ipcRenderer.off(channel, listener)
  },
})

contextBridge.exposeInMainWorld("app", {
  system: {
    info: () => ipcRenderer.invoke("system:info"),
    diagnostics: () => ipcRenderer.invoke("system:diagnostics"),
  },
  workspace: {
    getPaths: () => ipcRenderer.invoke("workspace:getPaths"),
    setProxySettings: (settings: unknown) => ipcRenderer.invoke("workspace:setProxySettings", settings),
    getProxySettings: () => ipcRenderer.invoke("workspace:getProxySettings"),
  },
  chats: {
    list: () => ipcRenderer.invoke("chats:list"),
    get: (chatId: string) => ipcRenderer.invoke("chats:get", chatId),
    create: () => ipcRenderer.invoke("chats:create"),
    ensure: (payload: unknown) => ipcRenderer.invoke("chats:ensure", payload),
    delete: (chatId: string) => ipcRenderer.invoke("chats:delete", chatId),
    appendUser: (payload: unknown) => ipcRenderer.invoke("chats:appendUser", payload),
    appendAssistant: (payload: unknown) => ipcRenderer.invoke("chats:appendAssistant", payload),
    updateMessageParts: (payload: unknown) => ipcRenderer.invoke("chats:updateMessageParts", payload),
    getSettings: () => ipcRenderer.invoke("chats:getSettings"),
    saveSettings: (payload: unknown) => ipcRenderer.invoke("chats:saveSettings", payload),
    getSessionSettings: (chatId?: string | null) => ipcRenderer.invoke("chats:getSessionSettings", chatId),
    saveSessionSettings: (payload: unknown) => ipcRenderer.invoke("chats:saveSessionSettings", payload),
    sendMessage: (payload: unknown) => ipcRenderer.invoke("chats:sendMessage", payload),
    cancelRuntime: (requestId: string) => ipcRenderer.invoke("chats:runtime:cancel", requestId),
    retryToolActivity: (payload: unknown) => ipcRenderer.invoke("chats:retryToolActivity", payload),
    onRuntimeEvent: (listener: (...args: unknown[]) => void) => ipcRenderer.on("chat-runtime-listener", listener),
    offRuntimeEvent: (listener: (...args: unknown[]) => void) => ipcRenderer.off("chat-runtime-listener", listener),
  },
  documents: {
    list: () => ipcRenderer.invoke("documents:list"),
    get: (documentId: string, versionId?: string) => ipcRenderer.invoke("documents:get", documentId, versionId),
    getFileTree: (documentId: string, versionId?: string) =>
      ipcRenderer.invoke("documents:getFileTree", documentId, versionId),
    getFile: (documentId: string, fileId: string, versionId?: string) =>
      ipcRenderer.invoke("documents:getFile", documentId, fileId, versionId),
    create: () => ipcRenderer.invoke("documents:create"),
    createWithMetadata: (payload: unknown) => ipcRenderer.invoke("documents:createWithMetadata", payload),
    save: (payload: unknown) => ipcRenderer.invoke("documents:save", payload),
    delete: (documentId: string) => ipcRenderer.invoke("documents:delete", documentId),
  },
  database: {
    ping: () => ipcRenderer.invoke("database:ping"),
    syncChannelCatalog: (payload: unknown) => ipcRenderer.invoke("database:syncChannelCatalog", payload),
  },
  models: {
    list: () => ipcRenderer.invoke("models:list"),
    get: (providerId: string) => ipcRenderer.invoke("models:get", providerId),
    create: (payload?: unknown) => ipcRenderer.invoke("models:create", payload),
    save: (payload: unknown) => ipcRenderer.invoke("models:save", payload),
    delete: (providerId: string) => ipcRenderer.invoke("models:delete", providerId),
    discover: (payload: unknown) => ipcRenderer.invoke("models:discover", payload),
    configured: () => ipcRenderer.invoke("models:configured"),
    listPresets: () => ipcRenderer.invoke("models:preset:list"),
    getPreset: (providerType: string) => ipcRenderer.invoke("models:preset:get", providerType),
    getDefaultBaseUrl: (providerType: string) => ipcRenderer.invoke("models:preset:defaultBaseUrl", providerType),
    allowsNoKey: (providerType: string) => ipcRenderer.invoke("models:preset:allowsNoKey", providerType),
    getDiscoveryState: (payload: unknown) => ipcRenderer.invoke("models:preset:discoveryState", payload),
  },
  skills: {
    listAll: () => ipcRenderer.invoke("skills:list"),
    listExternal: () => ipcRenderer.invoke("skills:listExternal"),
    get: (skillId: string) => ipcRenderer.invoke("skills:get", skillId),
    getExternal: (skillId: string) => ipcRenderer.invoke("skills:getExternal", skillId),
    getFileTree: (skillId: string, versionId?: string) => ipcRenderer.invoke("skills:getFileTree", skillId, versionId),
    getFile: (skillId: string, filePath: string, versionId?: string) =>
      ipcRenderer.invoke("skills:getFile", skillId, filePath, versionId),
    create: () => ipcRenderer.invoke("skills:create"),
    save: (payload: unknown) => ipcRenderer.invoke("skills:save", payload),
    delete: (skillId: string) => ipcRenderer.invoke("skills:delete", skillId),
  },
  agents: {
    listAll: (options?: unknown) => ipcRenderer.invoke("agents:list", options),
    get: (agentId: string) => ipcRenderer.invoke("agents:get", agentId),
    create: () => ipcRenderer.invoke("agents:create"),
    save: (payload: unknown) => ipcRenderer.invoke("agents:save", payload),
    delete: (agentId: string) => ipcRenderer.invoke("agents:delete", agentId),
    getSettings: () => ipcRenderer.invoke("agents:getSettings"),
    saveSettings: (payload: unknown) => ipcRenderer.invoke("agents:saveSettings", payload),
  },
  integrations: {
    list: () => ipcRenderer.invoke("integrations:list"),
    get: (integrationId: string, versionId?: string) =>
      ipcRenderer.invoke("integrations:get", integrationId, versionId),
    create: (payload?: unknown) => ipcRenderer.invoke("integrations:create", payload),
    fetchApiDoc: (sourceUrl: string) => ipcRenderer.invoke("integrations:fetchApiDoc", sourceUrl),
    save: (payload: unknown) => ipcRenderer.invoke("integrations:save", payload),
    setEnabled: (payload: unknown) => ipcRenderer.invoke("integrations:setEnabled", payload),
    delete: (integrationId: string) => ipcRenderer.invoke("integrations:delete", integrationId),
    recordExecution: (payload: unknown) => ipcRenderer.invoke("integrations:recordExecution", payload),
    execute: (payload: unknown) => ipcRenderer.invoke("integration:execute", payload),
  },
  workflows: {
    list: () => ipcRenderer.invoke("workflows:list"),
    get: (workflowId: string) => ipcRenderer.invoke("workflows:get", workflowId),
    create: () => ipcRenderer.invoke("workflows:create"),
    save: (payload: unknown) => ipcRenderer.invoke("workflows:save", payload),
    delete: (workflowId: string) => ipcRenderer.invoke("workflows:delete", workflowId),
    recordInvocation: (payload: unknown) => ipcRenderer.invoke("workflows:recordInvocation", payload),
    startRun: (payload: unknown) => ipcRenderer.invoke("workflows:run:start", payload),
    cancelRun: (requestId: string) => ipcRenderer.invoke("workflows:run:cancel", requestId),
    onRunEvent: (listener: (...args: unknown[]) => void) => ipcRenderer.on("workflow:run:event", listener),
    offRunEvent: (listener: (...args: unknown[]) => void) => ipcRenderer.off("workflow:run:event", listener),
  },
  channels: channelApi,
  schedulers: {
    list: () => ipcRenderer.invoke("schedulers:list"),
    get: (schedulerId: string) => ipcRenderer.invoke("schedulers:get", schedulerId),
    create: () => ipcRenderer.invoke("schedulers:create"),
    save: (payload: unknown) => ipcRenderer.invoke("schedulers:save", payload),
    setEnabled: (payload: unknown) => ipcRenderer.invoke("schedulers:setEnabled", payload),
    listRuns: (schedulerId: string) => ipcRenderer.invoke("schedulers:listRuns", schedulerId),
    delete: (schedulerId: string) => ipcRenderer.invoke("schedulers:delete", schedulerId),
  },
  preferences: {
    get: () => ipcRenderer.invoke("preferences:get"),
    save: (value: string) => ipcRenderer.invoke("preferences:save", value),
  },
  updater: {
    getState: () => ipcRenderer.invoke("updater:getState"),
    check: () => ipcRenderer.invoke("updater:check"),
  },
  mail: {
    send: (payload: SendMailPayload) => ipcRenderer.invoke("mail:send", payload),
  },
  tools: {
    listFiles: (relativePath?: string) => ipcRenderer.invoke("tools:listFiles", relativePath),
    readFile: (relativePath: string) => ipcRenderer.invoke("tools:readFile", relativePath),
    writeFile: (payload: unknown) => ipcRenderer.invoke("tools:writeFile", payload),
    runCommand: (payload: unknown) => ipcRenderer.invoke("tools:runCommand", payload),
    browserNavigate: (payload: unknown) => ipcRenderer.invoke("tools:browserNavigate", payload),
    browserState: (sessionId?: string) => ipcRenderer.invoke("tools:browserState", sessionId),
    browserPage: (payload: unknown) => ipcRenderer.invoke("tools:browserPage", payload),
    browserClick: (payload: unknown) => ipcRenderer.invoke("tools:browserClick", payload),
    browserFill: (payload: unknown) => ipcRenderer.invoke("tools:browserFill", payload),
    saveFile: (payload: unknown) => ipcRenderer.invoke("tools:saveFile", payload),
    openExternal: (url: string) => ipcRenderer.invoke("tools:openExternal", url),
  },
})

export {}
