import https from "node:https"

import WebSocket from "ws"

import type { ChannelConfigRecord } from "@/data/domain/models"
import { httpRequest } from "@electron/others/channels/channel-runtime-helpers"
import type { RuntimeChannelMessage } from "@electron/others/channels/channel-runtime-types"

type StreamConnectionInfo = {
  endpoint: string
  ticket: string
}

type StreamEventHeader = {
  eventId: string
  eventBorn: string
  eventCorpId: string
  eventType: string
  eventUnifiedAppId: string
  contentType?: string
  time?: string
  topic?: string
}

type StreamEvent = {
  specVersion: string
  type: string
  headers: StreamEventHeader
  data: string
}

type DingTalkBotMessage = {
  msgId?: string
  msgtype?: string
  text?: { content?: string }
  senderStaffId?: string
  senderId?: string
  senderNick?: string
  conversationId?: string
  conversationType?: string
  createAt?: number
  sessionWebhook?: string
  sessionWebhookExpiredTime?: number
}

export type StreamMessageHandler = (channel: ChannelConfigRecord, message: RuntimeChannelMessage, sessionWebhook?: string) => Promise<void>

export class DingTalkStreamClient {
  private channel: ChannelConfigRecord
  private ws: WebSocket | null = null
  private messageHandler: StreamMessageHandler | null = null
  private reconnecting = false
  private reconnectAttempts = 0
  private readonly maxReconnectAttempts = 50
  private readonly reconnectBaseDelay = 3000
  private pingInterval: ReturnType<typeof setInterval> | null = null
  private dedupCleanupInterval: ReturnType<typeof setInterval> | null = null
  private readonly processedEvents = new Map<string, number>()
  private readonly dedupTTL = 5 * 60 * 1000
  private closed = false

  constructor(channel: ChannelConfigRecord) {
    this.channel = channel
  }

  onMessage(handler: StreamMessageHandler) {
    this.messageHandler = handler
  }

  updateChannel(channel: ChannelConfigRecord) {
    this.channel = channel
  }

  async connect(): Promise<void> {
    const clientId = this.channel.dingtalkClientId || this.channel.appId
    const clientSecret = this.channel.dingtalkClientSecret || this.channel.appSecret
    if (!clientId || !clientSecret) {
      throw new Error("DingTalk stream requires client ID and client secret")
    }

    this.closed = false
    this.reconnectAttempts = 0
    this.startDedupCleanup()

    const connection = await this.openConnection(clientId, clientSecret)
    await this.connectWebSocket(connection)
  }

  async disconnect(): Promise<void> {
    this.closed = true
    this.stopHeartbeat()
    this.stopDedupCleanup()
    this.processedEvents.clear()

    if (this.ws) {
      try {
        this.ws.close(1000, "Client disconnect")
      } catch {
        // Ignore close errors.
      }
      this.ws = null
    }
  }

  isConnected() {
    return this.ws !== null && this.ws.readyState === WebSocket.OPEN
  }

  private async openConnection(clientId: string, clientSecret: string): Promise<StreamConnectionInfo> {
    const response = await httpRequest("https://api.dingtalk.com/v1.0/gateway/connections/open", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        clientId,
        clientSecret,
        subscriptions: [
          { type: "EVENT", topic: "/v1.0/im/bot/messages/get" },
          { type: "CALLBACK", topic: "/v1.0/im/bot/messages/get" },
        ],
        ua: "suora/1.0",
      }),
    })

    const data = response.data as { endpoint?: string; ticket?: string; code?: string; message?: string }
    if (!data.endpoint || !data.ticket) {
      throw new Error(`DingTalk stream open failed: ${data.message || data.code || "no endpoint returned"}`)
    }

    return {
      endpoint: data.endpoint,
      ticket: data.ticket,
    }
  }

  private connectWebSocket(connection: StreamConnectionInfo): Promise<void> {
    return new Promise((resolve, reject) => {
      const url = `${connection.endpoint}?ticket=${encodeURIComponent(connection.ticket)}`
      const agent = new https.Agent({ rejectUnauthorized: true, keepAlive: true })
      this.ws = new WebSocket(url, {
        agent,
        headers: { "User-Agent": "suora/1.0" },
        handshakeTimeout: 15_000,
      })

      let settled = false
      const connectTimer = setTimeout(() => {
        if (!settled) {
          settled = true
          try {
            this.ws?.terminate()
          } catch {
            // Ignore terminate errors.
          }
          reject(new Error("WebSocket connection timeout"))
        }
      }, 30_000)

      this.ws.on("open", () => {
        if (settled) return
        settled = true
        clearTimeout(connectTimer)
        this.reconnectAttempts = 0
        this.startHeartbeat()
        resolve()
      })

      this.ws.on("message", (raw) => {
        try {
          const text = typeof raw === "string" ? raw : raw.toString()
          void this.handleStreamMessage(text)
        } catch (error) {
          if (!settled) {
            settled = true
            clearTimeout(connectTimer)
            reject(error instanceof Error ? error : new Error(String(error)))
          }
        }
      })

      this.ws.on("close", (code, reason) => {
        clearTimeout(connectTimer)
        this.cleanup()
        if (!settled) {
          settled = true
          reject(new Error(`WebSocket closed during handshake: code=${code}; reason=${reason.toString()}`))
        } else if (!this.closed) {
          void this.scheduleReconnect()
        }
      })

      this.ws.on("error", (error) => {
        clearTimeout(connectTimer)
        if (!settled) {
          settled = true
          reject(error)
        }
      })
    })
  }

  private async handleStreamMessage(raw: string) {
    let event: StreamEvent
    try {
      event = JSON.parse(raw) as StreamEvent
    } catch {
      return
    }

    const eventType = event.headers?.eventType || event.type || ""
    const topic = event.headers?.topic || ""
    if (eventType === "SYSTEM" || event.type === "SYSTEM") {
      this.sendAck(event.headers?.eventId || "", { message: "pong" })
      return
    }

    const eventId = event.headers?.eventId
    if (eventId && this.processedEvents.has(eventId)) {
      this.sendAck(eventId, { message: "ok" })
      return
    }

    if (topic === "/v1.0/im/bot/messages/get" || eventType === "chat_bot_message") {
      await this.handleBotMessage(event)
      return
    }

    if (eventId) {
      this.processedEvents.set(eventId, Date.now())
      this.sendAck(eventId, { message: "ok" })
    }
  }

  private async handleBotMessage(event: StreamEvent) {
    let body: DingTalkBotMessage
    try {
      body = typeof event.data === "string" ? JSON.parse(event.data) as DingTalkBotMessage : event.data as unknown as DingTalkBotMessage
    } catch {
      this.sendAck(event.headers?.eventId || "", { message: "ok" })
      return
    }

    const message: RuntimeChannelMessage = {
      id: body.msgId || event.headers?.eventId || `stream-${Date.now()}`,
      channelId: this.channel.id,
      platform: "dingtalk",
      senderId: body.senderStaffId || body.senderId || "",
      senderName: body.senderNick || body.senderStaffId || body.senderId || "",
      content: body.text?.content?.trim() || "",
      timestamp: body.createAt || Date.now(),
      messageType: "text",
      chatId: body.conversationId,
      chatType: body.conversationType === "2" ? "group" : "private",
    }

    const eventId = event.headers?.eventId || ""
    if (eventId) {
      this.processedEvents.set(eventId, Date.now())
    }

    if (message.content && this.messageHandler) {
      await this.messageHandler(this.channel, message, body.sessionWebhook)
    }

    this.sendAck(eventId, { message: "ok" })
  }

  private sendAck(eventId: string, data: Record<string, string>) {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      return
    }

    this.ws.send(JSON.stringify({
      code: 200,
      headers: { contentType: "application/json", messageId: eventId },
      message: "OK",
      data: JSON.stringify(data),
    }))
  }

  private startHeartbeat() {
    this.stopHeartbeat()
    this.pingInterval = setInterval(() => {
      if (this.ws && this.ws.readyState === WebSocket.OPEN) {
        this.ws.ping()
      }
    }, 30_000)
  }

  private stopHeartbeat() {
    if (this.pingInterval) {
      clearInterval(this.pingInterval)
      this.pingInterval = null
    }
  }

  private cleanup() {
    this.stopHeartbeat()
    this.stopDedupCleanup()
  }

  private startDedupCleanup() {
    this.stopDedupCleanup()
    this.dedupCleanupInterval = setInterval(() => {
      const cutoff = Date.now() - this.dedupTTL
      for (const [id, timestamp] of this.processedEvents) {
        if (timestamp < cutoff) {
          this.processedEvents.delete(id)
        }
      }
    }, 60_000)
  }

  private stopDedupCleanup() {
    if (this.dedupCleanupInterval) {
      clearInterval(this.dedupCleanupInterval)
      this.dedupCleanupInterval = null
    }
  }

  private async scheduleReconnect() {
    if (this.closed || this.reconnecting) return
    if (this.reconnectAttempts >= this.maxReconnectAttempts) return

    this.reconnecting = true
    this.reconnectAttempts += 1

    const delay = Math.min(this.reconnectBaseDelay * Math.pow(2, this.reconnectAttempts - 1), 60_000)
    const jitter = delay * (0.8 + Math.random() * 0.4)
    await new Promise((resolve) => setTimeout(resolve, jitter))

    if (this.closed) {
      this.reconnecting = false
      return
    }

    try {
      const clientId = this.channel.dingtalkClientId || this.channel.appId
      const clientSecret = this.channel.dingtalkClientSecret || this.channel.appSecret
      if (!clientId || !clientSecret) {
        throw new Error("Missing DingTalk stream credentials")
      }
      const connection = await this.openConnection(clientId, clientSecret)
      await this.connectWebSocket(connection)
    } finally {
      this.reconnecting = false
      if (!this.closed && (!this.ws || this.ws.readyState !== WebSocket.OPEN)) {
        void this.scheduleReconnect()
      }
    }
  }
}

export async function replyViaDingTalkSessionWebhook(sessionWebhook: string, content: string) {
  try {
    const response = await httpRequest(sessionWebhook, {
      method: "POST",
      headers: { "Content-Type": "application/json; charset=utf-8" },
      body: JSON.stringify({
        msgtype: "text",
        text: { content },
      }),
    })
    const data = response.data as { errcode?: number; errmsg?: string }
    if (data.errcode && data.errcode !== 0) {
      return { success: false, error: data.errmsg || "Reply failed" }
    }
    return { success: true }
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : String(error) }
  }
}
