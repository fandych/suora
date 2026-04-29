import WebSocket from 'ws'
import https from 'https'
import http from 'http'
import { getLogger } from './logger.js'
import type { ChannelConfig, ChannelMessage } from '../src/types/index.js'

/**
 * DingTalk Stream Mode Client
 *
 * Uses WebSocket long connection instead of HTTP webhook callbacks.
 * Flow:
 *   1. POST /v1.0/gateway/connections/open to get WebSocket endpoint + ticket
 *   2. Connect to WSS endpoint with ticket as query param
 *   3. Receive events (messages, callbacks) as JSON frames
 *   4. Send ACK for each received event
 *   5. Handle ping/pong heartbeats automatically
 *
 * Benefits over webhook mode:
 *   - No public IP / domain required (ideal for desktop apps)
 *   - Real-time bidirectional communication
 *   - Built-in reconnection
 */

interface StreamConnectionInfo {
  endpoint: string
  ticket: string
}

interface StreamEventHeader {
  eventId: string
  eventBorn: string
  eventCorpId: string
  eventType: string
  eventUnifiedAppId: string
  contentType?: string
  time?: string
  topic?: string
}

interface StreamEvent {
  specVersion: string
  type: string
  headers: StreamEventHeader
  data: string  // JSON string
}

interface DingTalkBotMessage {
  msgId?: string
  msgtype?: string
  text?: { content?: string }
  senderStaffId?: string
  senderId?: string
  senderNick?: string
  senderCorpId?: string
  conversationId?: string
  conversationType?: string
  conversationTitle?: string
  robotCode?: string
  createAt?: number
  chatbotUserId?: string
  isAdmin?: boolean
  sessionWebhook?: string
  sessionWebhookExpiredTime?: number
}

export type StreamMessageHandler = (channel: ChannelConfig, message: ChannelMessage, sessionWebhook?: string) => Promise<void>

function httpRequest(url: string, options: { method?: string; headers?: Record<string, string>; body?: string }): Promise<{ status: number; data: unknown }> {
  return new Promise((resolve, reject) => {
    let parsedUrl: URL
    try {
      parsedUrl = new URL(url)
    } catch {
      reject(new Error(`Invalid URL: ${url}`))
      return
    }
    const transport = parsedUrl.protocol === 'https:' ? https : http
    const req = transport.request(parsedUrl, {
      method: options.method || 'GET',
      headers: options.headers || {},
    }, (res) => {
      let body = ''
      res.on('data', (chunk: Buffer) => { body += chunk.toString() })
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode || 0, data: JSON.parse(body) })
        } catch {
          resolve({ status: res.statusCode || 0, data: body })
        }
      })
    })
    req.on('error', reject)
    if (options.body) req.write(options.body)
    req.end()
  })
}

export class DingTalkStreamClient {
  private channel: ChannelConfig
  private ws: WebSocket | null = null
  private messageHandler: StreamMessageHandler | null = null
  private reconnecting = false
  private reconnectAttempts = 0
  private maxReconnectAttempts = 50
  private reconnectBaseDelay = 3000
  private pingInterval: ReturnType<typeof setInterval> | null = null
  private closed = false
  // Dedup: track processed eventIds to prevent redelivery duplicates
  private processedEvents = new Map<string, number>()  // eventId -> timestamp
  private dedupTTL = 5 * 60 * 1000  // 5 minutes
  private dedupCleanupInterval: ReturnType<typeof setInterval> | null = null

  constructor(channel: ChannelConfig) {
    this.channel = channel
  }

  /**
   * Set the message handler callback
   */
  onMessage(handler: StreamMessageHandler) {
    this.messageHandler = handler
  }

  /**
   * Update channel config (e.g. after user edits)
   */
  updateChannel(channel: ChannelConfig) {
    this.channel = channel
  }

  /**
   * Connect to DingTalk Stream
   */
  async connect(): Promise<void> {
    if (!this.channel.appId || !this.channel.appSecret) {
      throw new Error('DingTalk stream requires appId (clientId) and appSecret (clientSecret)')
    }

    this.closed = false
    this.reconnectAttempts = 0
    this.startDedupCleanup()

    const connInfo = await this.openConnection()
    await this.connectWebSocket(connInfo)
  }

  /**
   * Step 1: Request stream connection endpoint from DingTalk gateway
   */
  private async openConnection(): Promise<StreamConnectionInfo> {
    const { appId: clientId, appSecret: clientSecret } = this.channel
    if (!clientId || !clientSecret) {
      throw new Error('DingTalk stream requires appId (clientId) and appSecret (clientSecret)')
    }

    const res = await httpRequest('https://api.dingtalk.com/v1.0/gateway/connections/open', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        clientId,
        clientSecret,
        subscriptions: [
          { type: 'EVENT', topic: '/v1.0/im/bot/messages/get' },
          { type: 'CALLBACK', topic: '/v1.0/im/bot/messages/get' },
        ],
        ua: 'suora/1.0',
      }),
    })

    const data = res.data as { endpoint?: string; ticket?: string; code?: string; message?: string }

    if (!data.endpoint || !data.ticket) {
      throw new Error(`DingTalk stream open failed: ${data.message || data.code || 'no endpoint returned'}`)
    }

    getLogger().info('DingTalk stream connection opened', {
      channelId: this.channel.id,
      endpoint: data.endpoint,
    })

    return {
      endpoint: data.endpoint,
      ticket: data.ticket,
    }
  }

  /**
   * Step 2: Establish WebSocket connection
   */
  private connectWebSocket(connInfo: StreamConnectionInfo): Promise<void> {
    return new Promise((resolve, reject) => {
      const url = `${connInfo.endpoint}?ticket=${encodeURIComponent(connInfo.ticket)}`

      // Use an HTTPS agent with TLS options to prevent
      // "socket disconnected before secure TLS connection" errors
      const agent = new https.Agent({
        rejectUnauthorized: true,
        keepAlive: true,
      })

      this.ws = new WebSocket(url, {
        agent,
        headers: {
          'User-Agent': 'suora/1.0',
        },
        handshakeTimeout: 15000,
      })

      let settled = false
      const connectTimer = setTimeout(() => {
        if (!settled) {
          settled = true
          // Force close the socket on timeout
          try { this.ws?.terminate() } catch { /* ignore */ }
          reject(new Error('WebSocket connection timeout'))
        }
      }, 30000)

      this.ws.on('open', () => {
        if (settled) return
        settled = true
        clearTimeout(connectTimer)
        this.reconnectAttempts = 0
        getLogger().info('DingTalk stream WebSocket connected', { channelId: this.channel.id })

        // Start heartbeat
        this.startHeartbeat()
        resolve()
      })

      this.ws.on('message', (raw: WebSocket.Data) => {
        try {
          const text = typeof raw === 'string' ? raw : raw.toString()
          this.handleStreamMessage(text)
        } catch (err) {
          getLogger().error('DingTalk stream message parse error', { error: err, channelId: this.channel.id })
        }
      })

      this.ws.on('close', (code: number, reason: Buffer) => {
        clearTimeout(connectTimer)
        getLogger().warn('DingTalk stream WebSocket closed', {
          channelId: this.channel.id,
          code,
          reason: reason.toString(),
        })
        this.cleanup()
        if (!settled) {
          settled = true
          reject(new Error(`WebSocket closed during handshake: code=${code}`))
        } else if (!this.closed) {
          this.scheduleReconnect()
        }
      })

      this.ws.on('error', (err: Error) => {
        clearTimeout(connectTimer)
        getLogger().error('DingTalk stream WebSocket error', {
          channelId: this.channel.id,
          error: err.message,
        })
        if (!settled) {
          settled = true
          reject(err)
        }
        // If already settled, close event will trigger reconnect
      })

      this.ws.on('pong', () => {
        getLogger().debug('DingTalk stream pong received', { channelId: this.channel.id })
      })
    })
  }

  /**
   * Handle incoming stream messages
   */
  private async handleStreamMessage(raw: string) {
    let event: StreamEvent
    try {
      event = JSON.parse(raw) as StreamEvent
    } catch {
      getLogger().warn('DingTalk stream: non-JSON message', { raw: raw.substring(0, 200) })
      return
    }

    const eventType = event.headers?.eventType || event.type || ''
    const topic = event.headers?.topic || ''

    getLogger().debug('DingTalk stream event', {
      channelId: this.channel.id,
      type: eventType,
      topic,
      eventId: event.headers?.eventId,
    })

    // System ping event
    if (eventType === 'SYSTEM' || event.type === 'SYSTEM') {
      this.sendAck(event.headers?.eventId || '', { message: 'pong' })
      return
    }

    // Dedup: skip already-processed events
    const eventId = event.headers?.eventId
    if (eventId && this.processedEvents.has(eventId)) {
      getLogger().debug('DingTalk stream: duplicate event skipped', { eventId, channelId: this.channel.id })
      this.sendAck(eventId, { message: 'ok' })
      return
    }

    // Bot message callback
    if (topic === '/v1.0/im/bot/messages/get' || eventType === 'chat_bot_message') {
      await this.handleBotMessage(event)
      return
    }

    // ACK unknown events to prevent redelivery
    if (eventId) {
      this.processedEvents.set(eventId, Date.now())
      this.sendAck(eventId, { message: 'ok' })
    }
  }

  /**
   * Handle bot message from stream
   */
  private async handleBotMessage(event: StreamEvent) {
    let botMsg: DingTalkBotMessage
    try {
      botMsg = typeof event.data === 'string' ? JSON.parse(event.data) : event.data
    } catch {
      getLogger().error('DingTalk stream: failed to parse bot message data', { data: event.data })
      this.sendAck(event.headers?.eventId || '', { message: 'ok' })
      return
    }

    // Build ChannelMessage
    const message: ChannelMessage = {
      id: botMsg.msgId || event.headers?.eventId || `stream-${Date.now()}`,
      channelId: this.channel.id,
      platform: 'dingtalk',
      senderId: botMsg.senderStaffId || botMsg.senderId || '',
      senderName: botMsg.senderNick,
      content: botMsg.text?.content?.trim() || '',
      timestamp: botMsg.createAt || Date.now(),
      messageType: 'text',
      chatId: botMsg.conversationId,
      chatType: botMsg.conversationType === '2' ? 'group' : 'private',
    }

    // Mark event as processed before handling to prevent redelivery during async processing
    const eventId = event.headers?.eventId || ''
    if (eventId) {
      this.processedEvents.set(eventId, Date.now())
    }

    if (message.content && this.messageHandler) {
      await this.messageHandler(this.channel, message, botMsg.sessionWebhook)
    }

    // ACK the event
    this.sendAck(eventId, { message: 'ok' })
  }

  /**
   * Send ACK response for a received event
   */
  private sendAck(eventId: string, data: Record<string, string>) {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return

    const ack = JSON.stringify({
      code: 200,
      headers: { contentType: 'application/json', messageId: eventId },
      message: 'OK',
      data: JSON.stringify(data),
    })

    this.ws.send(ack)
  }

  /**
   * Start heartbeat ping
   */
  private startHeartbeat() {
    this.stopHeartbeat()
    // Ping every 30 seconds to keep connection alive
    this.pingInterval = setInterval(() => {
      if (this.ws && this.ws.readyState === WebSocket.OPEN) {
        this.ws.ping()
      }
    }, 30000)
  }

  private stopHeartbeat() {
    if (this.pingInterval) {
      clearInterval(this.pingInterval)
      this.pingInterval = null
    }
  }

  /**
   * Schedule reconnection with exponential backoff
   */
  private async scheduleReconnect() {
    if (this.closed || this.reconnecting) return
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      getLogger().error('DingTalk stream: max reconnect attempts reached', { channelId: this.channel.id })
      return
    }

    this.reconnecting = true
    this.reconnectAttempts++

    // Exponential backoff: 3s, 6s, 12s, ... capped at 60s
    const delay = Math.min(this.reconnectBaseDelay * Math.pow(2, this.reconnectAttempts - 1), 60000)
    // Add jitter: ±20%
    const jitter = delay * (0.8 + Math.random() * 0.4)

    getLogger().info('DingTalk stream: reconnecting', {
      channelId: this.channel.id,
      attempt: this.reconnectAttempts,
      delayMs: Math.round(jitter),
    })

    await new Promise((r) => setTimeout(r, jitter))

    if (this.closed) {
      this.reconnecting = false
      return
    }

    try {
      const connInfo = await this.openConnection()
      await this.connectWebSocket(connInfo)
    } catch (err) {
      getLogger().error('DingTalk stream: reconnect failed', {
        channelId: this.channel.id,
        error: err instanceof Error ? err.message : String(err),
      })
    }

    this.reconnecting = false

    // If still not connected and not closed, schedule another attempt
    if (!this.closed && (!this.ws || this.ws.readyState !== WebSocket.OPEN)) {
      this.scheduleReconnect()
    }
  }

  /**
   * Clean up resources
   */
  private cleanup() {
    this.stopHeartbeat()
    this.stopDedupCleanup()
  }

  /**
   * Periodically clean up expired dedup entries
   */
  private startDedupCleanup() {
    this.stopDedupCleanup()
    this.dedupCleanupInterval = setInterval(() => {
      const cutoff = Date.now() - this.dedupTTL
      for (const [id, ts] of this.processedEvents) {
        if (ts < cutoff) this.processedEvents.delete(id)
      }
    }, 60000)  // Clean every 60s
  }

  private stopDedupCleanup() {
    if (this.dedupCleanupInterval) {
      clearInterval(this.dedupCleanupInterval)
      this.dedupCleanupInterval = null
    }
  }

  /**
   * Disconnect and stop reconnecting
   */
  async disconnect(): Promise<void> {
    this.closed = true
    this.cleanup()
    this.processedEvents.clear()

    if (this.ws) {
      try {
        this.ws.close(1000, 'Client disconnect')
      } catch {
        // ignore close errors
      }
      this.ws = null
    }

    getLogger().info('DingTalk stream: disconnected', { channelId: this.channel.id })
  }

  /**
   * Check if connected
   */
  isConnected(): boolean {
    return this.ws !== null && this.ws.readyState === WebSocket.OPEN
  }
}

/**
 * Reply to a message using the session webhook (available in stream mode).
 * The session webhook is a temporary URL that allows direct reply without access token.
 */
export async function replyViaDingTalkSessionWebhook(
  sessionWebhook: string,
  content: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const res = await httpRequest(sessionWebhook, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json; charset=utf-8' },
      body: JSON.stringify({
        msgtype: 'text',
        text: { content },
      }),
    })
    const data = res.data as { errcode?: number; errmsg?: string }
    if (data.errcode && data.errcode !== 0) {
      return { success: false, error: data.errmsg || 'Reply failed' }
    }
    return { success: true }
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : String(err) }
  }
}
