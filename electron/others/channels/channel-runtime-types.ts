import type { ChannelConfigRecord } from "@/data/domain/models"

export type RuntimeChannelMessage = {
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

export type RuntimeChannelEvent = {
  channel: ChannelConfigRecord
  message: RuntimeChannelMessage
  rawEvent: unknown
}

export type RuntimeMessageHandler = (event: RuntimeChannelEvent) => Promise<void>

export type ChannelHealthStatus = {
  isHealthy: boolean
  latencyMs: number
  error?: string
}

export type ChannelWebhookResponse = {
  success: boolean
  url?: string
  error?: string
}
