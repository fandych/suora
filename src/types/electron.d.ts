export {}

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
      }
      workspace: {
        getPaths: () => Promise<unknown>
        setProxySettings: (settings: unknown) => Promise<unknown>
        getProxySettings: () => Promise<unknown>
      }
      chats: {
        list: () => Promise<unknown>
        get: (chatId: string) => Promise<unknown>
        create: () => Promise<unknown>
        appendUser: (payload: unknown) => Promise<unknown>
        appendAssistant: (payload: unknown) => Promise<unknown>
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
      }
      skills: {
        list: () => Promise<unknown>
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
        recordInvocation: (payload: unknown) => Promise<unknown>
      }
      channels: {
        list: () => Promise<unknown>
        get: (channelId: string) => Promise<unknown>
        create: () => Promise<unknown>
        save: (payload: unknown) => Promise<unknown>
        delete: (channelId: string) => Promise<unknown>
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
      tools: {
        listFiles: (relativePath?: string) => Promise<unknown>
        readFile: (relativePath: string) => Promise<unknown>
        writeFile: (payload: unknown) => Promise<unknown>
        runCommand: (payload: unknown) => Promise<unknown>
        openExternal: (url: string) => Promise<unknown>
      }
    }
  }
}