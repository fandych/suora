import WebSocket from "ws"

import type { ChannelConfigRecord } from "@/data/domain/models"
import type { RuntimeChannelMessage } from "@electron/others/channels/channel-runtime-types"

export type CustomSocketMessageHandler = (channel: ChannelConfigRecord, message: RuntimeChannelMessage, rawEvent: unknown) => Promise<void>

export class CustomWebSocketClient {
  private channel: ChannelConfigRecord
  private socket: WebSocket | null = null
  private handler: CustomSocketMessageHandler | null = null
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null
  private reconnectAttempts = 0
  private closed = false

  constructor(channel: ChannelConfigRecord) {
    this.channel = channel
  }

  onMessage(handler: CustomSocketMessageHandler) {
    this.handler = handler
  }

  updateChannel(channel: ChannelConfigRecord) {
    this.channel = channel
  }

  connect() {
    const endpoint = this.channel.customWebsocketUrl?.trim()
    if (!endpoint) {
      throw new Error("Custom WebSocket URL is empty")
    }

    this.closed = false
    const protocols = this.channel.customWebsocketProtocol?.trim()
      ? [this.channel.customWebsocketProtocol.trim()]
      : undefined

    this.socket = new WebSocket(endpoint, protocols)
    this.socket.on("open", () => {
      this.reconnectAttempts = 0
    })
    this.socket.on("message", (data) => {
      void this.handleMessage(typeof data === "string" ? data : data.toString())
    })
    this.socket.on("close", () => {
      this.socket = null
      if (!this.closed) {
        this.scheduleReconnect()
      }
    })
    this.socket.on("error", () => {
      if (!this.closed) {
        this.scheduleReconnect()
      }
    })
  }

  disconnect() {
    this.closed = true
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer)
      this.reconnectTimer = null
    }
    if (this.socket) {
      try {
        this.socket.close(1000, "Client disconnect")
      } catch {
        // Ignore close errors.
      }
      this.socket = null
    }
  }

  isConnected() {
    return this.socket?.readyState === WebSocket.OPEN
  }

  async send(content: string, chatId: string) {
    if (!this.socket || this.socket.readyState !== WebSocket.OPEN) {
      throw new Error("Custom WebSocket is not connected")
    }

    const payloadTemplate = this.channel.customPayloadTemplate?.trim() || '{"chatId":"{{chatId}}","content":"{{content}}"}'
    const payload = payloadTemplate
      .replace(/\{\{content\}\}/g, () => JSON.stringify(content).slice(1, -1))
      .replace(/\{\{chatId\}\}/g, () => JSON.stringify(chatId).slice(1, -1))

    this.socket.send(payload)
  }

  private async handleMessage(raw: string) {
    if (!this.handler) {
      return
    }

    let body: Record<string, unknown>
    try {
      body = JSON.parse(raw) as Record<string, unknown>
    } catch {
      body = { content: raw }
    }

    const senderId = String(body.senderId || body.sender_id || body.user_id || body.from?.id || "custom-socket")
    const senderName = String(body.senderName || body.sender_name || body.user_name || body.from?.name || senderId)
    const content = String(body.content || body.text || body.message || body.msg || "")
    const chatId = String(body.chatId || body.chat_id || body.conversation_id || body.channel_id || senderId)
    if (!content) {
      return
    }

    await this.handler(this.channel, {
      id: String(body.id || body.message_id || `custom-websocket-${Date.now()}`),
      channelId: this.channel.id,
      platform: "custom",
      senderId,
      senderName,
      content,
      timestamp: Date.now(),
      messageType: "text",
      chatId,
      chatType: String(body.chatType || body.chat_type || "private") === "group" ? "group" : "private",
    }, body)
  }

  private scheduleReconnect() {
    if (this.reconnectTimer || this.closed) {
      return
    }

    this.reconnectAttempts += 1
    const delay = Math.min(3000 * Math.pow(2, this.reconnectAttempts - 1), 60000)
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null
      if (this.closed) {
        return
      }
      this.connect()
    }, delay)
  }
}
