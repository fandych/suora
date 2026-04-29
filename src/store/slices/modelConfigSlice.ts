import type { StateCreator } from 'zustand'
import type { MarketplaceSettings, Model, ProviderConfig, ProviderPreset, ToolSecuritySettings } from '@/types'
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
  sandboxMode: 'workspace',
}

export const DEFAULT_MARKETPLACE: MarketplaceSettings = {
  source: 'official',
  privateUrl: '',
  registrySources: [],
}

export const PROVIDER_PRESETS: ProviderPreset[] = [
  {
    id: 'openai',
    name: 'OpenAI',
    providerType: 'openai',
    baseUrl: '',
    description: 'Official OpenAI API with GPT models.',
    requiresApiKey: true,
    defaultModels: [
      { modelId: 'gpt-4.1', name: 'GPT-4.1', enabled: true },
      { modelId: 'gpt-4.1-mini', name: 'GPT-4.1 Mini', enabled: false },
    ],
  },
  {
    id: 'anthropic',
    name: 'Anthropic',
    providerType: 'anthropic',
    baseUrl: '',
    description: 'Claude models from Anthropic.',
    requiresApiKey: true,
    defaultModels: [
      { modelId: 'claude-sonnet-4-5', name: 'Claude Sonnet 4.5', enabled: true },
    ],
  },
  {
    id: 'google',
    name: 'Google Gemini',
    providerType: 'google',
    baseUrl: 'https://generativelanguage.googleapis.com/v1beta/openai',
    description: 'Gemini through the OpenAI-compatible endpoint.',
    requiresApiKey: true,
    defaultModels: [
      { modelId: 'gemini-2.5-pro', name: 'Gemini 2.5 Pro', enabled: true },
      { modelId: 'gemini-2.5-flash', name: 'Gemini 2.5 Flash', enabled: false },
    ],
  },
  {
    id: 'ollama',
    name: 'Ollama Local',
    providerType: 'ollama',
    baseUrl: 'http://localhost:11434/v1',
    description: 'Local Ollama server; no API key required.',
    requiresApiKey: false,
    defaultModels: [
      { modelId: 'llama3.1', name: 'Llama 3.1', enabled: true },
    ],
  },
  {
    id: 'dashscope',
    name: 'DashScope',
    providerType: 'openai-compatible',
    baseUrl: 'https://dashscope.aliyuncs.com/compatible-mode/v1',
    description: 'Alibaba Cloud DashScope OpenAI-compatible API.',
    requiresApiKey: true,
    defaultModels: [
      { modelId: 'qwen-plus', name: 'Qwen Plus', enabled: true },
    ],
  },
  {
    id: 'kimi',
    name: 'Kimi',
    providerType: 'openai-compatible',
    baseUrl: 'https://api.moonshot.cn/v1',
    description: 'Moonshot Kimi OpenAI-compatible API.',
    requiresApiKey: true,
    defaultModels: [
      { modelId: 'moonshot-v1-8k', name: 'Moonshot v1 8K', enabled: true },
    ],
  },
  {
    id: 'openai-compatible',
    name: 'OpenAI Compatible',
    providerType: 'openai-compatible',
    baseUrl: '',
    description: 'Custom provider that follows the OpenAI chat completions API.',
    requiresApiKey: true,
    defaultModels: [],
  },
]

function getElectron() {
  if (typeof window === 'undefined') return undefined
  return (window as unknown as {
    electron?: { invoke: (channel: string, ...args: unknown[]) => Promise<unknown> }
  }).electron
}

export function normalizeToolSecuritySettings(settings?: Partial<ToolSecuritySettings>): ToolSecuritySettings {
  return {
    allowedDirectories: Array.isArray(settings?.allowedDirectories) ? settings.allowedDirectories : [],
    blockedCommands: Array.isArray(settings?.blockedCommands) ? settings.blockedCommands : DEFAULT_TOOL_SECURITY.blockedCommands,
    requireConfirmation: settings?.requireConfirmation ?? DEFAULT_TOOL_SECURITY.requireConfirmation,
    sandboxMode: settings?.sandboxMode === 'relaxed' ? 'relaxed' : 'workspace',
  }
}

export function syncToolSecurityToElectron(settings?: Partial<ToolSecuritySettings>): void {
  const electron = getElectron()
  if (!electron) return
  const normalized = normalizeToolSecuritySettings(settings)
  electron.invoke('workspace:setToolSecurity', {
    allowedDirectories: normalized.allowedDirectories,
    blockedCommands: normalized.blockedCommands,
    sandboxMode: normalized.sandboxMode,
  }).catch(() => {})
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
    syncToolSecurityToElectron(get().toolSecurity)
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
  setToolSecurity: (data) => {
    const next = normalizeToolSecuritySettings({ ...get().toolSecurity, ...data })
    set({ toolSecurity: next })
    syncToolSecurityToElectron(next)
  },
  marketplace: DEFAULT_MARKETPLACE,
  setMarketplace: (data) => set((state) => ({
    marketplace: { ...state.marketplace, ...data },
  })),
})
