import type { StateCreator } from 'zustand'
import type { MarketplaceSettings, Model, ProviderConfig, ToolSecuritySettings } from '@/types'
import { updateCachedWorkspacePath } from '@/services/fileStorage'
import type { AppStore } from '@/store/appStore'

export type ModelConfigSlice = Pick<
  AppStore,
  | 'models'
  | 'selectedModel'
  | 'setSelectedModel'
  | 'addModel'
  | 'updateModel'
  | 'removeModel'
  | 'providerConfigs'
  | 'addProviderConfig'
  | 'updateProviderConfig'
  | 'removeProviderConfig'
  | 'setProviderConfigs'
  | 'syncModelsFromConfigs'
  | 'workspacePath'
  | 'setWorkspacePath'
  | 'apiKeys'
  | 'setApiKey'
  | 'plugins'
  | 'setPlugin'
  | 'toolSecurity'
  | 'setToolSecurity'
  | 'marketplace'
  | 'setMarketplace'
>

export const DEFAULT_TOOL_SECURITY: ToolSecuritySettings = {
  allowedDirectories: [],
  blockedCommands: ['rm -rf', 'del /f /q', 'format', 'shutdown'],
  requireConfirmation: true,
}

export const DEFAULT_MARKETPLACE: MarketplaceSettings = {
  source: 'official',
  privateUrl: '',
  registrySources: [],
}

function getElectron() {
  return (window as unknown as {
    electron?: { invoke: (channel: string, ...args: unknown[]) => Promise<unknown> }
  }).electron
}

function buildModelsFromProviderConfigs(providerConfigs: ProviderConfig[]): Model[] {
  const models: Model[] = []

  for (const providerConfig of providerConfigs) {
    for (const providerModel of providerConfig.models) {
      if (!providerModel.enabled) continue

      models.push({
        id: `${providerConfig.id}:${providerModel.modelId}`,
        name: providerModel.name || providerModel.modelId,
        provider: providerConfig.id,
        providerType: providerConfig.providerType,
        modelId: providerModel.modelId,
        apiKey: providerConfig.apiKey,
        baseUrl: providerConfig.baseUrl,
        isDefault: false,
        enabled: true,
      })
    }
  }

  if (models.length > 0) {
    models[0] = { ...models[0], isDefault: true }
  }

  return models
}

export const createModelConfigSlice: StateCreator<AppStore, [], [], ModelConfigSlice> = (set, get) => ({
  models: [],
  selectedModel: null,
  setSelectedModel: (model) => set({ selectedModel: model }),
  addModel: (model) => set((state) => ({ models: [...state.models, model] })),
  updateModel: (id, data) => set((state) => ({
    models: state.models.map((model) => (model.id === id ? { ...model, ...data } : model)),
  })),
  removeModel: (id) => set((state) => ({
    models: state.models.filter((model) => model.id !== id),
    selectedModel: state.selectedModel?.id === id ? null : state.selectedModel,
  })),
  providerConfigs: [],
  addProviderConfig: (config) => set((state) => ({
    providerConfigs: [...state.providerConfigs, config],
  })),
  updateProviderConfig: (id, config) => set((state) => ({
    providerConfigs: state.providerConfigs.map((providerConfig) => (
      providerConfig.id === id ? { ...providerConfig, ...config } : providerConfig
    )),
  })),
  removeProviderConfig: (id) => set((state) => ({
    providerConfigs: state.providerConfigs.filter((providerConfig) => providerConfig.id !== id),
  })),
  setProviderConfigs: (configs) => set({ providerConfigs: configs }),
  syncModelsFromConfigs: () => {
    const newModels = buildModelsFromProviderConfigs(get().providerConfigs)
    const modelIds = new Set(newModels.map((m) => m.id))
    const staleSessionIds = new Set(
      get().sessions.filter((s) => s.modelId && !modelIds.has(s.modelId)).map((s) => s.id)
    )
    set((state) => {
      const selectedModel = state.selectedModel
        ? newModels.find((model) => model.id === state.selectedModel?.id) ?? (newModels[0] ?? null)
        : (newModels[0] ?? null)

      return {
        models: newModels,
        selectedModel,
        sessions: staleSessionIds.size > 0
          ? state.sessions.map((s) => staleSessionIds.has(s.id) ? { ...s, modelId: undefined } : s)
          : state.sessions,
      }
    })
  },
  workspacePath: '',
  setWorkspacePath: (workspacePath) => {
    set({ workspacePath })
    updateCachedWorkspacePath(workspacePath)
    const electron = getElectron()
    if (electron) electron.invoke('workspace:init', workspacePath).catch(() => {})
  },
  apiKeys: {},
  setApiKey: (provider, key) => set((state) => ({
    apiKeys: { ...state.apiKeys, [provider]: key },
  })),
  plugins: {},
  setPlugin: (name, config) => set((state) => ({
    plugins: { ...state.plugins, [name]: config },
  })),
  toolSecurity: DEFAULT_TOOL_SECURITY,
  setToolSecurity: (data) => set((state) => ({
    toolSecurity: { ...state.toolSecurity, ...data },
  })),
  marketplace: DEFAULT_MARKETPLACE,
  setMarketplace: (data) => set((state) => ({
    marketplace: { ...state.marketplace, ...data },
  })),
})
