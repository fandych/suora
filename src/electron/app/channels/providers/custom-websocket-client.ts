import WebSocket from "ws"

import type { ChannelConfigRecord } from "@/types/channel"
import type { RuntimeChannelMessage } from "@/electron/app/channels/runtime/channel-runtime-types"

export type CustomSocketMessageHandler = (
  channel: ChannelConfigRecord,
  message: RuntimeChannelMessage,
  rawEvent: unknown,
) => Promise<void>

export class CustomWebSocketClient {
  private channel: ChannelConfigRecord
  private socket: WebSocket | null = null
  private handler: CustomSocketMessageHandler | null = null
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null
  private reconnectAttempts = 0
  private readonly maxReconnectAttempts = 50
  private closed = false
  private connecting = false
  private connectionGeneration = 0

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
    if (this.connecting || this.socket?.readyState === WebSocket.OPEN) {
      return
    }

    const endpoint = this.channel.customWebsocketUrl?.trim()
    if (!endpoint) {
      throw new Error("Custom WebSocket URL is empty")
    }

    try {
      const parsed = new URL(endpoint)
      if (!["ws:", "wss:"].includes(parsed.protocol)) {
        throw new Error("Custom WebSocket URL must use ws:// or wss://")
      }
    } catch (error) {
      throw new Error(error instanceof Error ? error.message : "Invalid custom WebSocket URL")
    }

    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer)
      this.reconnectTimer = null
    }
    if (this.socket) {
      try {
        this.socket.removeAllListeners()
        this.socket.close(1000, "Reconnect")
      } catch {
        // Ignore close errors while replacing an existing socket.
      }
      this.socket = null
    }

    this.closed = false
    this.connecting = true
    const generation = ++this.connectionGeneration
    const protocols = this.channel.customWebsocketProtocol?.trim()
      ? [this.channel.customWebsocketProtocol.trim()]
      : undefined

    const socket = new WebSocket(endpoint, protocols)
    this.socket = socket
    socket.on("open", () => {
      if (this.connectionGeneration !== generation || this.socket !== socket) {
        try {
          socket.close(1000, "Superseded")
        } catch {
          // Ignore close errors for superseded sockets.
        }
        return
      }
      this.connecting = false
      this.reconnectAttempts = 0
    })
    socket.on("message", (data) => {
      if (this.connectionGeneration !== generation || this.socket !== socket) return
      void this.handleMessage(typeof data === "string" ? data : data.toString())
    })
    socket.on("close", () => {
      if (this.connectionGeneration !== generation || this.socket !== socket) return
      this.connecting = false
      this.socket = null
      if (!this.closed) {
        this.scheduleReconnect()
      }
    })
    socket.on("error", () => {
      if (this.connectionGeneration !== generation || this.socket !== socket) return
      this.connecting = false
    })
  }

  disconnect() {
    this.closed = true
    this.connecting = false
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

    const payloadTemplate =
      this.channel.customPayloadTemplate?.trim() || '{"chatId":"{{chatId}}","content":"{{content}}"}'
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

    const from = body.from as { id?: unknown; name?: unknown } | undefined
    const senderId = String(body.senderId || body.sender_id || body.user_id || from?.id || "custom-socket")
    const senderName = String(body.senderName || body.sender_name || body.user_name || from?.name || senderId)
    const content = String(body.content || body.text || body.message || body.msg || "")
    const chatId = String(body.chatId || body.chat_id || body.conversation_id || body.channel_id || senderId)
    if (!content) {
      return
    }

    await this.handler(
      this.channel,
      {
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
      },
      body,
    )
  }

  private scheduleReconnect() {
    if (this.reconnectTimer || this.closed) {
      return
    }
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
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
