import { appendAssistantChatMessage, appendUserChatMessage, ensureChatDetail, getChatDetail } from "@/data/repositories/chat-repository"
import { getAgentDetail } from "@/data/repositories/agent-repository"
import { emitDataChanged } from "@/data/repositories/data-events"
import { getChatSessionSettings, saveChatSessionSettings } from "@/data/repositories/chat-settings-repository"
import { getModelProvider } from "@/data/repositories/model-config-repository"
import { sendChannelReply } from "@/data/repositories/channel-repository"
import { showToast } from "@/lib/app-toast"
import { hasSuoraBridge } from "@/lib/ipc"
import { streamChatAgentResponse, type ChatAgentEvent } from "@/services/ai-service"
import { createPersistedAssistantPayload } from "@/views/chats/chat-controller-utils"
import { applyEventToAssistantResponseParts, finalizeAssistantResponseParts } from "@/views/chats/assistant-response-parts"
import type { AssistantResponsePart } from "@/views/chats/components/chat-assistant-response-group"
import type { ChannelConfigRecord, ChatDetail } from "@/data/domain/models"

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
  await appendUserChatMessage(chatId, event.message.content)

  const settings = await getChatSessionSettings(chatId)
  const selectedAgentId = event.channel.replyAgentId || settings.selectedAgentId
  const agentDetail = selectedAgentId ? await getAgentDetail(selectedAgentId) : null
  const channelConfiguredProvider = event.channel.providerId ? await getModelProvider(event.channel.providerId).catch(() => null) : null
  const agentConfiguredProvider = agentDetail?.config.providerId ? await getModelProvider(agentDetail.config.providerId).catch(() => null) : null
  const activeProvider = event.channel.providerId && event.channel.modelId && channelConfiguredProvider
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

  let finalText = ""
  let errorPartIndex = 0
  let streamedParts: AssistantResponsePart[] = []
  const history = await getChatDetail(chatId).catch(() => null as ChatDetail | null)
  if (!history) {
    return
  }

  for await (const aiEvent of streamChatAgentResponse(history.messages, nextSettings.runtime, { selectedAgentId: selectedAgentId || undefined })) {
    if (aiEvent.type === "error") {
      errorPartIndex += 1
    }
    streamedParts = applyEventToAssistantResponseParts(streamedParts, aiEvent as ChatAgentEvent, errorPartIndex)
    if (aiEvent.type === "text-delta") {
      finalText += aiEvent.text
    }
  }

  const finalizedParts = finalizeAssistantResponseParts(streamedParts)
  const { persistedText, persistedParts } = createPersistedAssistantPayload(finalText, finalizedParts, false)
  if (persistedText.trim() || persistedParts.length > 0) {
    await appendAssistantChatMessage(chatId, persistedText.trim(), persistedParts)
    emitDataChanged("/chats")
  }

  if (event.channel.autoReply && event.message.chatId && persistedText.trim()) {
    const result = await sendChannelReply({ channelId: event.channel.id, chatId: event.message.chatId, content: persistedText.trim() })
    emitDataChanged("/channels")
    if (!result.success) {
      showToast({ title: "Channel reply failed", description: result.error || "Unknown error", type: "error" })
    }
  }
}

export function initChannelRuntimeListener() {
  if (!hasSuoraBridge() || !window.electron?.on || !window.electron?.off) {
    return () => undefined
  }

  const handler = (...args: unknown[]) => {
    const payload = args[1] as ChannelRuntimeEvent | undefined
    if (!payload) {
      return
    }

    void handleChannelRuntimeEvent(payload).catch((error) => {
      showToast({ title: "Channel runtime failed", description: error instanceof Error ? error.message : String(error), type: "error" })
    })
  }

  window.electron.on("channel:message", handler)
  return () => {
    window.electron?.off?.("channel:message", handler)
  }
}