import type { ChannelConfigRecord } from "@/data/domain/channel-models"
import type { RuntimeChannelMessage } from "@electron/others/channels/channel-runtime-types"

type DingTalkBotMessage = { msgId?: string; text?: { content?: string }; senderStaffId?: string; senderId?: string; senderNick?: string; conversationId?: string; conversationType?: string; createAt?: number; sessionWebhook?: string }
type StreamEvent = { headers?: { eventId?: string }; data: string }

export function parseDingTalkStreamMessage(event: StreamEvent, channel: ChannelConfigRecord): { message: RuntimeChannelMessage; sessionWebhook?: string } | null {
  let body: DingTalkBotMessage
  try { body = JSON.parse(event.data) as DingTalkBotMessage } catch { return null }
  const message: RuntimeChannelMessage = {
    id: body.msgId || event.headers?.eventId || `stream-${Date.now()}`,
    channelId: channel.id,
    platform: "dingtalk",
    senderId: body.senderStaffId || body.senderId || "",
    senderName: body.senderNick || body.senderStaffId || body.senderId || "",
    content: body.text?.content?.trim() || "",
    timestamp: body.createAt || Date.now(),
    messageType: "text",
    chatId: body.conversationId,
    chatType: body.conversationType === "2" ? "group" : "private",
  }
  return { message, sessionWebhook: body.sessionWebhook }
}
