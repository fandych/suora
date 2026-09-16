import type { ChannelConfigRecord } from "@/types/channel"

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

export type TokenCacheEntry = {
  token: string
  expiresAt: number
}

export type WeChatWebhookPayload = {
  ToUserName: string
  FromUserName: string
  CreateTime: string
  MsgType: "text" | "image" | "voice" | "video" | "shortvideo" | "location" | "link" | "event" | string
  Content?: string
  PicUrl?: string
  MediaId?: string
  Format?: string
  Recognition?: string
  ThumbMediaId?: string
  Location_X?: string
  Location_Y?: string
  Scale?: string
  Label?: string
  Title?: string
  Description?: string
  Url?: string
  Event?: string
  EventKey?: string
  Ticket?: string
  raw: Record<string, unknown>
}
