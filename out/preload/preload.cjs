"use strict";
const electron = require("electron");
electron.contextBridge.exposeInMainWorld("electron", {
  invoke: (channel, ...args) => {
    return electron.ipcRenderer.invoke(channel, ...args);
  },
  on: (channel, listener) => {
    electron.ipcRenderer.on(channel, listener);
  },
  off: (channel, listener) => {
    electron.ipcRenderer.off(channel, listener);
  }
});
electron.contextBridge.exposeInMainWorld("suora", {
  system: {
    info: () => electron.ipcRenderer.invoke("system:info")
  },
  workspace: {
    getPaths: () => electron.ipcRenderer.invoke("workspace:getPaths"),
    setProxySettings: (settings) => electron.ipcRenderer.invoke("workspace:setProxySettings", settings),
    getProxySettings: () => electron.ipcRenderer.invoke("workspace:getProxySettings")
  },
  chats: {
    list: () => electron.ipcRenderer.invoke("chats:list"),
    get: (chatId) => electron.ipcRenderer.invoke("chats:get", chatId),
    create: () => electron.ipcRenderer.invoke("chats:create"),
    appendUser: (payload) => electron.ipcRenderer.invoke("chats:appendUser", payload),
    appendAssistant: (payload) => electron.ipcRenderer.invoke("chats:appendAssistant", payload),
    getSettings: () => electron.ipcRenderer.invoke("chats:getSettings"),
    saveSettings: (payload) => electron.ipcRenderer.invoke("chats:saveSettings", payload)
  },
  documents: {
    list: () => electron.ipcRenderer.invoke("documents:list"),
    get: (documentId, versionId) => electron.ipcRenderer.invoke("documents:get", documentId, versionId),
    create: () => electron.ipcRenderer.invoke("documents:create"),
    save: (payload) => electron.ipcRenderer.invoke("documents:save", payload),
    delete: (documentId) => electron.ipcRenderer.invoke("documents:delete", documentId)
  },
  db: {
    execute: (payload) => electron.ipcRenderer.invoke("db:execute", payload)
  },
  models: {
    list: () => electron.ipcRenderer.invoke("models:list"),
    get: (providerId) => electron.ipcRenderer.invoke("models:get", providerId),
    create: (payload) => electron.ipcRenderer.invoke("models:create", payload),
    save: (payload) => electron.ipcRenderer.invoke("models:save", payload),
    delete: (providerId) => electron.ipcRenderer.invoke("models:delete", providerId)
  },
  skills: {
    list: () => electron.ipcRenderer.invoke("skills:list"),
    get: (skillId) => electron.ipcRenderer.invoke("skills:get", skillId),
    create: () => electron.ipcRenderer.invoke("skills:create"),
    save: (payload) => electron.ipcRenderer.invoke("skills:save", payload),
    delete: (skillId) => electron.ipcRenderer.invoke("skills:delete", skillId)
  },
  agents: {
    list: () => electron.ipcRenderer.invoke("agents:list"),
    get: (agentId) => electron.ipcRenderer.invoke("agents:get", agentId),
    create: () => electron.ipcRenderer.invoke("agents:create"),
    save: (payload) => electron.ipcRenderer.invoke("agents:save", payload),
    delete: (agentId) => electron.ipcRenderer.invoke("agents:delete", agentId)
  },
  integrations: {
    list: () => electron.ipcRenderer.invoke("integrations:list"),
    get: (integrationId) => electron.ipcRenderer.invoke("integrations:get", integrationId),
    create: (payload) => electron.ipcRenderer.invoke("integrations:create", payload),
    save: (payload) => electron.ipcRenderer.invoke("integrations:save", payload),
    recordExecution: (payload) => electron.ipcRenderer.invoke("integrations:recordExecution", payload),
    execute: (payload) => electron.ipcRenderer.invoke("integration:execute", payload)
  },
  workflows: {
    list: () => electron.ipcRenderer.invoke("workflows:list"),
    get: (workflowId) => electron.ipcRenderer.invoke("workflows:get", workflowId),
    create: () => electron.ipcRenderer.invoke("workflows:create"),
    save: (payload) => electron.ipcRenderer.invoke("workflows:save", payload),
    recordInvocation: (payload) => electron.ipcRenderer.invoke("workflows:recordInvocation", payload)
  },
  channels: {
    list: () => electron.ipcRenderer.invoke("channels:list"),
    get: (channelId) => electron.ipcRenderer.invoke("channels:get", channelId),
    create: () => electron.ipcRenderer.invoke("channels:create"),
    save: (payload) => electron.ipcRenderer.invoke("channels:save", payload),
    delete: (channelId) => electron.ipcRenderer.invoke("channels:delete", channelId)
  },
  schedulers: {
    list: () => electron.ipcRenderer.invoke("schedulers:list"),
    get: (schedulerId) => electron.ipcRenderer.invoke("schedulers:get", schedulerId),
    create: () => electron.ipcRenderer.invoke("schedulers:create"),
    save: (payload) => electron.ipcRenderer.invoke("schedulers:save", payload)
  },
  preferences: {
    get: () => electron.ipcRenderer.invoke("preferences:get"),
    save: (value) => electron.ipcRenderer.invoke("preferences:save", value)
  },
  updater: {
    getState: () => electron.ipcRenderer.invoke("updater:getState"),
    check: () => electron.ipcRenderer.invoke("updater:check")
  }
});
