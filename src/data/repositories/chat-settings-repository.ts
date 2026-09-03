import { hasSuoraBridge, suoraIpc } from "@/lib/ipc"
import { getPreferenceSettings } from "@/data/repositories/preference-repository"

export type ChatModelConfig = {
  providerId: string
  providerType: "ollama" | "openai" | "anthropic" | "openai-compatible" | "google"
  modelId: string
  baseUrl: string
  apiKey: string
  systemPrompt: string
}

export type ProxyConfig = {
  enabled: boolean
  type: "http" | "https" | "socks5"
  host: string
  port: number
  username: string
  password: string
  rejectUnauthorized: boolean
  ignoreSslErrors: boolean
}

export type ChatRuntimeSettings = {
  model: ChatModelConfig
  proxy: ProxyConfig
  requestTimeoutMs: number
}

export type ChatSessionSettings = {
  runtime: ChatRuntimeSettings
  selectedAgentId: string
}

type StoredChatSessionSettings = {
  runtime?: Partial<ChatRuntimeSettings>
  selectedAgentId?: string
}

type ChatSettingsStore = {
  defaultRuntime?: Partial<ChatRuntimeSettings>
  defaultSelectedAgentId?: string
  drafts?: Record<string, string>
  chats?: Record<string, StoredChatSessionSettings>
}

const DEFAULT_SETTINGS: ChatRuntimeSettings = {
  model: {
    providerId: "provider-ollama",
    providerType: "ollama",
    modelId: "llama3.1",
    baseUrl: "http://localhost:11434/v1",
    apiKey: "",
    systemPrompt: "You are SUORA, a desktop AI workbench assistant. Use tools when they help answer grounded workspace questions.",
  },
  proxy: {
    enabled: false,
    type: "http",
    host: "",
    port: 0,
    username: "",
    password: "",
    rejectUnauthorized: true,
    ignoreSslErrors: false,
  },
  requestTimeoutMs: 0,
}

const CHAT_SETTINGS_STORAGE_KEY = "suora:chat-settings"

function readBrowserSettings() {
  if (typeof window === "undefined") {
    return null
  }

  return window.localStorage.getItem(CHAT_SETTINGS_STORAGE_KEY)
}

function writeBrowserSettings(store: ChatSettingsStore) {
  if (typeof window === "undefined") {
    return
  }

  window.localStorage.setItem(CHAT_SETTINGS_STORAGE_KEY, JSON.stringify(store))
}

async function readSettingsValue() {
  if (hasSuoraBridge()) {
    try {
      return await suoraIpc.chats.getSettings() as string | null
    } catch {
      return readBrowserSettings()
    }
  }

  return readBrowserSettings()
}

async function saveSettingsStore(store: ChatSettingsStore) {
  if (hasSuoraBridge()) {
    try {
      await suoraIpc.chats.saveSettings(store)
      return
    } catch {
      writeBrowserSettings(store)
      return
    }
  }

  writeBrowserSettings(store)
}

function parseRuntimeSettings(value?: Partial<ChatRuntimeSettings> | null): ChatRuntimeSettings {
  try {
    return {
      model: { ...DEFAULT_SETTINGS.model, ...(value?.model ?? {}) },
      proxy: { ...DEFAULT_SETTINGS.proxy, ...(value?.proxy ?? {}) },
      requestTimeoutMs: typeof value?.requestTimeoutMs === "number" && Number.isFinite(value.requestTimeoutMs) ? value.requestTimeoutMs : DEFAULT_SETTINGS.requestTimeoutMs,
    }
  } catch {
    return DEFAULT_SETTINGS
  }
}

function parseStore(value?: string | null): ChatSettingsStore {
  if (!value) {
    return {}
  }

  try {
    const parsed = JSON.parse(value) as Partial<ChatRuntimeSettings> & ChatSettingsStore

    if (parsed.model || parsed.proxy) {
      return {
        defaultRuntime: parsed,
        defaultSelectedAgentId: "agent-general-assistant",
        drafts: {},
        chats: {},
      }
    }

    return {
      defaultRuntime: parsed.defaultRuntime,
      defaultSelectedAgentId: parsed.defaultSelectedAgentId,
      drafts: parsed.drafts ?? {},
      chats: parsed.chats ?? {},
    }
  } catch {
    return {}
  }
}

function sanitizeRuntimeSettings(settings: ChatRuntimeSettings): ChatRuntimeSettings {
  return {
    model: {
      ...settings.model,
      providerId: settings.model.providerId.trim() || settings.model.providerType,
      modelId: settings.model.modelId.trim(),
      baseUrl: settings.model.baseUrl.trim(),
      apiKey: settings.model.apiKey,
      systemPrompt: settings.model.systemPrompt.trim(),
    },
    proxy: {
      ...settings.proxy,
      host: settings.proxy.host.trim(),
      username: settings.proxy.username.trim(),
      password: settings.proxy.password,
      port: Number.isFinite(settings.proxy.port) ? settings.proxy.port : 0,
    },
    requestTimeoutMs: Number.isFinite(settings.requestTimeoutMs) && settings.requestTimeoutMs > 0 ? settings.requestTimeoutMs : 0,
  }
}

export async function getChatSessionSettings(chatId?: string | null): Promise<ChatSessionSettings> {
  const value = await readSettingsValue()
  const store = parseStore(value)
  const chatSettings = chatId ? store.chats?.[chatId] : undefined
  const preferences = await getPreferenceSettings().catch(() => null)
  const defaultRuntime = parseRuntimeSettings(store.defaultRuntime)
  const runtime = parseRuntimeSettings({
    model: { ...defaultRuntime.model, ...(chatSettings?.runtime?.model ?? {}) },
    proxy: { ...defaultRuntime.proxy, ...(chatSettings?.runtime?.proxy ?? {}) },
    requestTimeoutMs: chatSettings?.runtime?.requestTimeoutMs ?? defaultRuntime.requestTimeoutMs ?? preferences?.chatRequestTimeoutMs ?? DEFAULT_SETTINGS.requestTimeoutMs,
  })

  return {
    runtime,
    selectedAgentId: chatSettings?.selectedAgentId ?? store.defaultSelectedAgentId ?? "agent-general-assistant",
  }
}

export async function saveChatSessionSettings(chatId: string | null, settings: ChatSessionSettings) {
  const value = await readSettingsValue()
  const store = parseStore(value)
  const runtime = sanitizeRuntimeSettings(settings.runtime)

  const nextStore: ChatSettingsStore = {
    defaultRuntime: store.defaultRuntime,
    defaultSelectedAgentId: store.defaultSelectedAgentId,
    drafts: store.drafts ?? {},
    chats: { ...(store.chats ?? {}) },
  }

  if (chatId) {
    nextStore.chats![chatId] = {
      runtime,
      selectedAgentId: settings.selectedAgentId.trim(),
    }
  } else {
    nextStore.defaultRuntime = runtime
    nextStore.defaultSelectedAgentId = settings.selectedAgentId.trim()
  }

  await saveSettingsStore(nextStore)

  return {
    runtime,
    selectedAgentId: settings.selectedAgentId.trim(),
  } satisfies ChatSessionSettings
}

export async function getChatDraft(chatId?: string | null) {
  const value = await readSettingsValue()
  const store = parseStore(value)
  const draftKey = chatId ?? "__draft__"
  return store.drafts?.[draftKey] ?? ""
}

export async function saveChatDraft(chatId: string | null, draft: string) {
  const value = await readSettingsValue()
  const store = parseStore(value)
  const draftKey = chatId ?? "__draft__"

  const nextStore: ChatSettingsStore = {
    defaultRuntime: store.defaultRuntime,
    defaultSelectedAgentId: store.defaultSelectedAgentId,
    drafts: { ...(store.drafts ?? {}) },
    chats: { ...(store.chats ?? {}) },
  }

  nextStore.drafts![draftKey] = draft
  await saveSettingsStore(nextStore)
  return draft
}

export async function getChatRuntimeSettings(chatId?: string | null) {
  const session = await getChatSessionSettings(chatId)
  return session.runtime
}

export async function saveChatRuntimeSettings(settings: ChatRuntimeSettings, chatId?: string | null) {
  const session = await saveChatSessionSettings(chatId ?? null, {
    runtime: settings,
    selectedAgentId: "agent-general-assistant",
  })
  return session.runtime
}