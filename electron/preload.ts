import { contextBridge, ipcRenderer } from "electron"

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
    appendUser: (payload: unknown) => ipcRenderer.invoke("chats:appendUser", payload),
    appendAssistant: (payload: unknown) => ipcRenderer.invoke("chats:appendAssistant", payload),
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
    recordInvocation: (payload: unknown) => ipcRenderer.invoke("workflows:recordInvocation", payload),
  },
  channels: {
    list: () => ipcRenderer.invoke("channels:list"),
    get: (channelId: string) => ipcRenderer.invoke("channels:get", channelId),
    create: () => ipcRenderer.invoke("channels:create"),
    save: (payload: unknown) => ipcRenderer.invoke("channels:save", payload),
    delete: (channelId: string) => ipcRenderer.invoke("channels:delete", channelId),
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
})

export {}