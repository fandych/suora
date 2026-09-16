import { ensureChatDetail } from "@/services/chat-service"
import { getAgentDetail } from "@/services/agent-service"
import { emitDataChanged } from "@/services/data-events"
import { getChatSessionSettings, saveChatSessionSettings } from "@/services/chat-service"
import { getModelProvider } from "@/services/model-service"
import { sendChannelReply } from "@/services/channel-service"
import { showToast } from "@/services/toast-service"
import { hasAppBridge } from "@/services/bridge"
import { ChatApi } from "@/services/chat-service"
import type { ChannelConfigRecord } from "@/types/channel"
import type { ChatDetail } from "@/types/chat"

type ChannelRuntimeEvent = {
  channel: ChannelConfigRecord
  message: {
    id: string
    channelId: string
    platform: ChannelConfigRecord["platform"]
    senderId: string
    senderName: string
    content: string
    timestamp: number
    messageType: "text" | "image" | "file" | "voice"
    chatId?: string
    chatType?: "private" | "group"
  }
  rawEvent: unknown
}

function buildChannelChatId(channelId: string, senderId: string) {
  return `chat-channel-${channelId}-${senderId.replace(/[^a-zA-Z0-9-_]+/g, "-")}`
}

async function ensureChannelChat(event: ChannelRuntimeEvent) {
  const targetChatId = buildChannelChatId(event.channel.id, event.message.chatId || event.message.senderId || "guest")
  const ensured = await ensureChatDetail({
    chatId: targetChatId,
    title: `${event.channel.title} · ${event.message.senderName || event.message.senderId}`,
    chatbotId: event.channel.replyAgentId || "assistant-main",
    summary: event.message.content.slice(0, 120),
    sourceType: "channel",
    sourceRef: event.channel.id,
  })
  return { chat: ensured.chat, created: ensured.messages.length === 0, detail: ensured }
}

async function handleChannelRuntimeEvent(event: ChannelRuntimeEvent) {
  emitDataChanged("/channels")
  const ensured = await ensureChannelChat(event)
  const chatId = ensured.chat.id
  const settings = await getChatSessionSettings(chatId)
  const selectedAgentId = event.channel.replyAgentId || settings.selectedAgentId
  const agentDetail = selectedAgentId ? await getAgentDetail(selectedAgentId) : null
  const channelConfiguredProvider = event.channel.providerId
    ? await getModelProvider(event.channel.providerId).catch(() => null)
    : null
  const agentConfiguredProvider = agentDetail?.config.providerId
    ? await getModelProvider(agentDetail.config.providerId).catch(() => null)
    : null
  const activeProvider =
    event.channel.providerId && event.channel.modelId && channelConfiguredProvider
      ? {
          provider: channelConfiguredProvider,
          modelId: event.channel.modelId,
        }
      : agentDetail?.config.providerId && agentDetail.config.modelId && agentConfiguredProvider
        ? {
            provider: agentConfiguredProvider,
            modelId: agentDetail.config.modelId,
          }
        : null
  const nextSettings = activeProvider
    ? {
        runtime: {
          ...settings.runtime,
          model: {
            ...settings.runtime.model,
            providerId: activeProvider.provider.id,
            providerType: activeProvider.provider.providerType,
            baseUrl: activeProvider.provider.baseUrl,
            apiKey: activeProvider.provider.apiKey,
            modelId: activeProvider.modelId,
          },
        },
        selectedAgentId,
      }
    : { runtime: settings.runtime, selectedAgentId }
  await saveChatSessionSettings(chatId, nextSettings)

  const sent = await ChatApi.sendMessage(chatId, { content: event.message.content })
  const runtimeResult = await new Promise<{ detail?: ChatDetail; error?: string }>((resolve) => {
    const listener = (...args: unknown[]) => {
      const payload = args[1] as { requestId?: string; type?: string; detail?: ChatDetail; error?: string } | undefined
      if (payload?.requestId !== sent.requestId) return
      if (payload.type === "completed" || payload.type === "error") {
        ChatApi.offRuntimeEvent(listener)
        resolve(payload)
      }
    }
    ChatApi.onRuntimeEvent(listener)
  })
  if (runtimeResult.error) throw new Error(runtimeResult.error)
  const assistant = runtimeResult.detail?.messages.at(-1)
  const persistedText = assistant?.role === "assistant" ? assistant.content : ""
  emitDataChanged("/chats")

  if (event.channel.autoReply && event.message.chatId && persistedText.trim()) {
    const result = await sendChannelReply({
      channelId: event.channel.id,
      chatId: event.message.chatId,
      content: persistedText.trim(),
    })
    emitDataChanged("/channels")
    if (!result.success) {
      showToast({ title: "Channel reply failed", description: result.error || "Unknown error", type: "error" })
    }
  }
}

export function initChannelRuntimeListener() {
  if (!hasAppBridge() || !window.electron?.on || !window.electron?.off) {
    return () => undefined
  }

  const handler = (...args: unknown[]) => {
    const payload = args[1] as ChannelRuntimeEvent | undefined
    if (!payload) {
      return
    }

    void handleChannelRuntimeEvent(payload).catch((error) => {
      showToast({
        title: "Channel runtime failed",
        description: error instanceof Error ? error.message : String(error),
        type: "error",
      })
    })
  }

  window.electron.on("channel:message", handler)
  return () => {
    window.electron?.off?.("channel:message", handler)
  }
}
