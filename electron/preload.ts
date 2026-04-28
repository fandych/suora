import { contextBridge, ipcRenderer } from 'electron'

// Only allow known IPC channels to prevent arbitrary main-process calls
const ALLOWED_INVOKE_CHANNELS = [
  'system:getDefaultWorkspacePath',
  'system:homePath',
  'system:ensureDirectory',
  'system:info',
  'system:notify',
  'system:screenshot',
  'workspace:init',
  'workspace:getBootConfig',
  'workspace:setExternalDirectories',
  'store:load',
  'store:save',
  'store:remove',
  'db:getSnapshot',
  'db:saveStateSlice',
  'db:loadPersistedStore',
  'db:savePersistedStore',
  'db:deletePersistedStore',
  'db:listEntities',
  'db:saveEntity',
  'db:deleteEntity',
  'safe-storage:encrypt',
  'safe-storage:decrypt',
  'safe-storage:isAvailable',
  'app:setAutoStart',
  'app:getAutoStart',
  'fs:listDir',
  'fs:readFile',
  'fs:readFileRange',
  'fs:writeFile',
  'fs:deleteFile',
  'fs:deleteDir',
  'fs:editFile',
  'fs:searchFiles',
  'fs:moveFile',
  'fs:copyFile',
  'fs:stat',
  'fs:glob',
  'git:status',
  'git:diff',
  'git:log',
  'git:add',
  'git:commit',
  'shell:exec',
  'shell:openUrl',
  'web:search',
  'web:fetch',
  'clipboard:read',
  'clipboard:write',
  'timer:list',
  'timer:create',
  'timer:update',
  'timer:delete',
  'timer:history',
  'timer:updateExecution',
  'browser:navigate',
  'browser:screenshot',
  'browser:evaluate',
  'browser:extractLinks',
  'browser:extractText',
  'browser:fillForm',
  'browser:click',
  'fs:watch:start',
  'fs:watch:stop',
  'log:write',
  'channel:start',
  'channel:stop',
  'channel:status',
  'channel:register',
  'channel:getWebhookUrl',
  'channel:sendMessage',
  'channel:sendMessageQueued',
  'channel:getAccessToken',
  'channel:healthCheck',
  'channel:streamStatus',
  'channel:debugSend',
  'updater:check',
  'updater:getVersion',
  'email:send',
  'email:test',
  'deep-link:getProtocol',
  'crash:report',
  'crash:getLogs',
  'crash:clearLogs',
  'perf:getMetrics',
  'iconify:listCollections',
  'iconify:loadCollection',
  'iconify:getIconNames',
]

const ALLOWED_SEND_CHANNELS = [
  'app:ready',
]

const ALLOWED_RECEIVE_CHANNELS = [
  'app:update',
  'timer:fired',
  'fs:watch:changed',
  'channel:message',
  'updater:available',
  'deep-link',
]

contextBridge.exposeInMainWorld('electron', {
  invoke: (channel: string, ...args: unknown[]) => {
    if (!ALLOWED_INVOKE_CHANNELS.includes(channel)) {
      return Promise.reject(new Error(`IPC channel not allowed: ${channel}`))
    }
    return ipcRenderer.invoke(channel, ...args)
  },
  on: (channel: string, listener: (...args: unknown[]) => void) => {
    if (!ALLOWED_RECEIVE_CHANNELS.includes(channel)) return
    ipcRenderer.on(channel, listener)
  },
  off: (channel: string, listener: (...args: unknown[]) => void) => {
    if (!ALLOWED_RECEIVE_CHANNELS.includes(channel)) return
    ipcRenderer.off(channel, listener)
  },
  send: (channel: string, ...args: unknown[]) => {
    if (!ALLOWED_SEND_CHANNELS.includes(channel)) return
    ipcRenderer.send(channel, ...args)
  },
})
