import {
  appendChatMessage,
  createChat,
  deleteChat,
  ensureChat,
  getChatSettings,
  getChat,
  listChats,
  saveChatSettings,
  updateChatMessageParts,
} from "@/electron/app/chats/repository"
import { getPreferenceValue } from "@/electron/app/preferences/repository"
import {
  type ChatRuntimeSettingsPayload,
  type ChatSettingsStorePayload,
  parseStoredChatSettingsStore,
  parseAppendAssistantPayload,
  parseAppendUserPayload,
  parseUpdateMessagePartsPayload,
} from "@/electron/app/chats/chat-schemas"
import { normalizeChatAgentMaxSteps } from "@/electron/app/chats/chat-agent-loop-policy"
import type { ChatRuntimeSettings, ChatSessionSettings } from "@/types/chat"

export const chatApplicationService = {
  list: () => listChats(),
  get: (chatId: string) => getChat(chatId),
  create: () => createChat(),
  ensure: (payload: Parameters<typeof ensureChat>[0]) => ensureChat(payload),
  remove: (chatId: string) => deleteChat(chatId),
  appendUser: (value: unknown) => appendChatMessage(parseAppendUserPayload(value), "user"),
  appendAssistant: (value: unknown) => appendChatMessage(parseAppendAssistantPayload(value), "assistant"),
  updateMessageParts: (value: unknown) => updateChatMessageParts(parseUpdateMessagePartsPayload(value)),
  getSettings: () => getChatSettings(),
  saveSettings: (
    value:
      | ChatRuntimeSettingsPayload
      | {
          defaultRuntime?: ChatRuntimeSettingsPayload
          chats?: Record<string, { runtime?: ChatRuntimeSettingsPayload; selectedAgentId?: string }>
        },
  ) => saveChatSettings(value),
  async getSessionSettings(chatId?: string | null): Promise<ChatSessionSettings> {
    const store: ChatSettingsStorePayload = parseStoredChatSettingsStore(await getChatSettings())?.store ?? {}
    const chat = chatId ? store.chats?.[chatId] : undefined
    const preference = parseJson(await getPreferenceValue())
    const defaultRuntime = normalizeRuntime(store.defaultRuntime)
    return {
      runtime: normalizeRuntime({
        ...defaultRuntime,
        model: { ...defaultRuntime.model, ...(chat?.runtime?.model ?? {}) },
        proxy: { ...defaultRuntime.proxy, ...(chat?.runtime?.proxy ?? {}) },
        requestTimeoutMs:
          chat?.runtime?.requestTimeoutMs ??
          store.defaultRuntime?.requestTimeoutMs ??
          preference.chatRequestTimeoutMs ??
          0,
        maxSteps: chat?.runtime?.maxSteps ?? defaultRuntime.maxSteps,
      }),
      selectedAgentId:
        chat?.selectedAgentId?.trim() || store.defaultSelectedAgentId?.trim() || "agent-general-assistant",
    }
  },
  async saveSessionSettings(payload: {
    chatId?: string | null
    runtime: ChatRuntimeSettingsPayload
    selectedAgentId: string
  }): Promise<ChatSessionSettings> {
    const store: ChatSettingsStorePayload = parseStoredChatSettingsStore(await getChatSettings())?.store ?? {}
    const runtime = normalizeRuntime(payload.runtime)
    const nextStore = {
      defaultRuntime: store.defaultRuntime,
      defaultSelectedAgentId: store.defaultSelectedAgentId,
      chats: { ...(store.chats ?? {}) },
    }
    const selectedAgentId = payload.selectedAgentId.trim() || "agent-general-assistant"
    if (payload.chatId) nextStore.chats[payload.chatId] = { runtime, selectedAgentId }
    else {
      nextStore.defaultRuntime = runtime
      nextStore.defaultSelectedAgentId = selectedAgentId
    }
    await saveChatSettings({ version: 2, store: nextStore })
    return { runtime, selectedAgentId }
  },
}

function parseJson(value: string | null) {
  try {
    return (value ? JSON.parse(value) : {}) as { chatRequestTimeoutMs?: number }
  } catch {
    return {}
  }
}

function normalizeRuntime(value?: Partial<ChatRuntimeSettingsPayload> | null): ChatRuntimeSettings {
  const model: Partial<ChatRuntimeSettingsPayload["model"]> = value?.model ?? {}
  const proxy: Partial<ChatRuntimeSettingsPayload["proxy"]> = value?.proxy ?? {}
  const requestTimeoutMs = typeof value?.requestTimeoutMs === "number" && value.requestTimeoutMs > 0 ? value.requestTimeoutMs : 0
  const proxyPort = typeof proxy.port === "number" && Number.isFinite(proxy.port) ? proxy.port : 0
  return {
    model: {
      providerId: model.providerId?.trim() || model.providerType || "provider-ollama",
      providerType: model.providerType || "ollama",
      modelId: model.modelId?.trim() || "llama3.1",
      baseUrl: model.baseUrl?.trim() || "http://localhost:11434/v1",
      apiKey: model.apiKey || "",
      systemPrompt: model.systemPrompt?.trim() || "You are SUORA, a desktop AI workbench assistant.",
    },
    proxy: {
      enabled: Boolean(proxy.enabled),
      type: proxy.type || "http",
      host: proxy.host?.trim() || "",
      port: proxyPort,
      username: proxy.username?.trim() || "",
      password: proxy.password || "",
      rejectUnauthorized: proxy.rejectUnauthorized ?? true,
      ignoreSslErrors: proxy.ignoreSslErrors ?? false,
    },
    requestTimeoutMs,
    maxSteps: normalizeChatAgentMaxSteps(value?.maxSteps),
  }
}
