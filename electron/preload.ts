import { contextBridge, ipcRenderer } from "electron"

import type { SendMailPayload } from "@electron/types"

contextBridge.exposeInMainWorld("electron", {
  invoke: (channel: string, ...args: unknown[]) => {
    return ipcRenderer.invoke(channel, ...args)
  },
  on: (channel: string, listener: (...args: unknown[]) => void) => {
    ipcRenderer.on(channel, listener)
  },
  off: (channel: string, listener: (...args: unknown[]) => void) => {
    ipcRenderer.off(channel, listener)
  },
})

contextBridge.exposeInMainWorld("suora", {
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
  },
  documents: {
    list: () => ipcRenderer.invoke("documents:list"),
    get: (documentId: string, versionId?: string) => ipcRenderer.invoke("documents:get", documentId, versionId),
    create: () => ipcRenderer.invoke("documents:create"),
    save: (payload: unknown) => ipcRenderer.invoke("documents:save", payload),
    delete: (documentId: string) => ipcRenderer.invoke("documents:delete", documentId),
  },
  db: {
    execute: (payload: unknown) => ipcRenderer.invoke("db:execute", payload),
  },
  models: {
    list: () => ipcRenderer.invoke("models:list"),
    get: (providerId: string) => ipcRenderer.invoke("models:get", providerId),
    create: (payload?: unknown) => ipcRenderer.invoke("models:create", payload),
    save: (payload: unknown) => ipcRenderer.invoke("models:save", payload),
    delete: (providerId: string) => ipcRenderer.invoke("models:delete", providerId),
  },
  skills: {
    list: () => ipcRenderer.invoke("skills:list"),
    get: (skillId: string) => ipcRenderer.invoke("skills:get", skillId),
    create: () => ipcRenderer.invoke("skills:create"),
    save: (payload: unknown) => ipcRenderer.invoke("skills:save", payload),
    delete: (skillId: string) => ipcRenderer.invoke("skills:delete", skillId),
  },
  agents: {
    list: () => ipcRenderer.invoke("agents:list"),
    get: (agentId: string) => ipcRenderer.invoke("agents:get", agentId),
    create: () => ipcRenderer.invoke("agents:create"),
    save: (payload: unknown) => ipcRenderer.invoke("agents:save", payload),
    delete: (agentId: string) => ipcRenderer.invoke("agents:delete", agentId),
    getSettings: () => ipcRenderer.invoke("agents:getSettings"),
    saveSettings: (payload: unknown) => ipcRenderer.invoke("agents:saveSettings", payload),
  },
  integrations: {
    list: () => ipcRenderer.invoke("integrations:list"),
    get: (integrationId: string) => ipcRenderer.invoke("integrations:get", integrationId),
    create: (payload?: unknown) => ipcRenderer.invoke("integrations:create", payload),
    save: (payload: unknown) => ipcRenderer.invoke("integrations:save", payload),
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
  },
  channels: {
    list: () => ipcRenderer.invoke("channels:list"),
    get: (channelId: string) => ipcRenderer.invoke("channels:get", channelId),
    create: () => ipcRenderer.invoke("channels:create"),
    save: (payload: unknown) => ipcRenderer.invoke("channels:save", payload),
    delete: (channelId: string) => ipcRenderer.invoke("channels:delete", channelId),
    startRuntime: () => ipcRenderer.invoke("channel:start"),
    stopRuntime: () => ipcRenderer.invoke("channel:stop"),
    getRuntimeStatus: () => ipcRenderer.invoke("channel:status"),
    registerRuntime: () => ipcRenderer.invoke("channel:register"),
    getWebhookUrl: (channel: unknown) => ipcRenderer.invoke("channel:getWebhookUrl", channel),
    sendMessage: (payload: unknown) => ipcRenderer.invoke("channel:sendMessage", payload),
    sendMessageQueued: (payload: unknown) => ipcRenderer.invoke("channel:sendMessageQueued", payload),
    getAccessToken: (channelId: string) => ipcRenderer.invoke("channel:getAccessToken", channelId),
    healthCheck: (channelId: string) => ipcRenderer.invoke("channel:healthCheck", channelId),
    getStreamStatus: (channelId: string) => ipcRenderer.invoke("channel:streamStatus", channelId),
    debugSend: (payload: unknown) => ipcRenderer.invoke("channel:debugSend", payload),
    startWeChatPersonalLogin: (force?: boolean) => ipcRenderer.invoke("channel:wechatPersonalLoginStart", force),
    waitForWeChatPersonalLogin: (sessionKey: string, verifyCode?: string, timeoutMs?: number) => ipcRenderer.invoke("channel:wechatPersonalLoginWait", sessionKey, verifyCode, timeoutMs),
    getWeChatPersonalQrPreview: (url: string, waitMs?: number) => ipcRenderer.invoke("channel:wechatPersonalQrPreview", url, waitMs),
  },
  schedulers: {
    list: () => ipcRenderer.invoke("schedulers:list"),
    get: (schedulerId: string) => ipcRenderer.invoke("schedulers:get", schedulerId),
    create: () => ipcRenderer.invoke("schedulers:create"),
    save: (payload: unknown) => ipcRenderer.invoke("schedulers:save", payload),
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
    saveFile: (payload: unknown) => ipcRenderer.invoke("tools:saveFile", payload),
    openExternal: (url: string) => ipcRenderer.invoke("tools:openExternal", url),
  },
})

export {}