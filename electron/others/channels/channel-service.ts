import express from "express"
import { createServer, type Server } from "node:http"

import type { ChannelConfigRecord } from "@/data/domain/models"
import { appState } from "@electron/others/app-state"
import { replyViaDingTalkSessionWebhook } from "@electron/others/channels/dingtalk-stream"
import {
  getDingTalkAccessToken,
  getFeishuAccessToken,
  getTeamsAccessToken,
  getWeChatAccessToken,
  getWeChatMiniProgramAccessToken,
  getWeChatOfficialAccessToken,
  type TokenCacheEntry,
  WECHAT_XML_CONTENT_TYPES,
} from "@electron/others/channels/channel-runtime-helpers"
import { appendDebugLog, recordHealthCheck, recordIncomingMessage, recordOutgoingMessage } from "@electron/others/channels/channel-runtime-persistence"
import { sendMessageForChannel } from "@electron/others/channels/channel-runtime-send"
import type { ChannelHealthStatus, RuntimeChannelEvent, RuntimeMessageHandler } from "@electron/others/channels/channel-runtime-types"
import { getChannelDetail, listEnabledChannelDetails } from "@electron/others/channels/channel-store"
import { CustomWebSocketClient } from "@electron/others/channels/custom-websocket-client"
import { DingTalkStreamClient } from "@electron/others/channels/dingtalk-stream"
import { stopAllRuntimeClients, syncCustomSocketClients, syncEmailPollers, syncStreamClients, syncWeChatPersonalPollers } from "@electron/others/channels/channel-service-sync"
import {
  startWeChatPersonalLogin,
  waitForWeChatPersonalLogin,
  type WeChatPersonalLoginSession,
} from "@electron/others/channels/channel-wechat-personal"
import { handleGetWebhookRequest, handlePostWebhookRequest } from "@electron/others/channels/channel-webhook-handlers"

const tokenCache = new Map<string, TokenCacheEntry>()

class MessageQueue {
  private readonly queue: Array<{ id: string; channel: ChannelConfigRecord; chatId: string; content: string; retryCount: number; maxRetries: number; nextRetryAt: number }> = []
  private readonly lastSentPerChannel = new Map<string, number>()
  private processing = false
  private readonly rateLimitWindow = 1000

  enqueue(channel: ChannelConfigRecord, chatId: string, content: string, maxRetries = 3) {
    const id = `mq-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
    this.queue.push({ id, channel, chatId, content, retryCount: 0, maxRetries, nextRetryAt: 0 })
    void this.processQueue()
    return id
  }

  private async processQueue() {
    if (this.processing) return
    this.processing = true

    while (this.queue.length > 0) {
      const item = this.queue[0]
      if (!item) break

      const lastSent = this.lastSentPerChannel.get(item.channel.id) || 0
      const timeSinceLastSent = Date.now() - lastSent
      if (timeSinceLastSent < this.rateLimitWindow) {
        await new Promise((resolve) => setTimeout(resolve, this.rateLimitWindow - timeSinceLastSent))
      }
      if (item.nextRetryAt > Date.now()) {
        await new Promise((resolve) => setTimeout(resolve, item.nextRetryAt - Date.now()))
      }

      const result = await sendMessageForChannel(item.channel, item.chatId, item.content, tokenCache)
      this.lastSentPerChannel.set(item.channel.id, Date.now())
      if (result.success) {
        this.queue.shift()
      } else {
        item.retryCount += 1
        if (item.retryCount >= item.maxRetries) {
          this.queue.shift()
        } else {
          item.nextRetryAt = Date.now() + Math.pow(2, item.retryCount) * 1000
          this.queue.shift()
          this.queue.push(item)
        }
      }
    }

    this.processing = false
  }
}

export class ChannelService {
  private readonly app = express()
  private server: Server | null = null
  private readonly port: number
  private readonly channels = new Map<string, ChannelConfigRecord>()
  private readonly streamClients = new Map<string, DingTalkStreamClient>()
  private readonly customSocketClients = new Map<string, CustomWebSocketClient>()
  private readonly weChatPersonalPollers = new Map<string, AbortController>()
  private readonly weChatPersonalLoginSessions = new Map<string, WeChatPersonalLoginSession>()
  private readonly weChatPersonalContextTokens = new Map<string, string>()
  private readonly emailPollers = new Map<string, ReturnType<typeof setInterval>>()
  private readonly emailLastSeenUid = new Map<string, number>()
  private readonly sessionWebhooks = new Map<string, { url: string; expiresAt: number }>()
  private readonly processedMessageIds = new Map<string, number>()
  private readonly messageQueue = new MessageQueue()
  private dedupCleanupInterval: ReturnType<typeof setInterval> | null = null
  private messageHandler: RuntimeMessageHandler | null = null

  constructor(port = 3000) {
    this.port = port
    this.setupMiddleware()
    this.setupRoutes()
  }

  onMessage(handler: RuntimeMessageHandler) {
    this.messageHandler = handler
  }

  async registerEnabledChannels() {
    const details = listEnabledChannelDetails()
    this.channels.clear()
    for (const detail of details) {
      this.channels.set(detail.channel.id, detail.channel)
    }
    await syncStreamClients(this, this.emitMessage.bind(this))
    await syncCustomSocketClients(this, this.emitMessage.bind(this))
    await syncWeChatPersonalPollers(this, this.emitMessage.bind(this))
    syncEmailPollers(this, this.emitMessage.bind(this))
  }

  async start() {
    if (this.server) return
    this.startDedupCleanup()
    await new Promise<void>((resolve) => {
      this.server = createServer(this.app)
      this.server.listen(this.port, "127.0.0.1", () => resolve())
    })
    await this.registerEnabledChannels()
  }

  async stop() {
    await stopAllRuntimeClients(this)
    this.processedMessageIds.clear()
    this.stopDedupCleanup()

    if (!this.server) return
    await new Promise<void>((resolve, reject) => {
      const target = this.server
      if (!target) {
        resolve()
        return
      }
      target.close((error) => {
        if (error) {
          reject(error)
          return
        }
        this.server = null
        resolve()
      })
    })
  }

  isRunning() {
    return Boolean(
      (this.server && this.server.listening) ||
      this.streamClients.size ||
      this.customSocketClients.size ||
      this.weChatPersonalPollers.size ||
      this.emailPollers.size
    )
  }

  getStreamStatus(channelId: string) {
    const channel = this.channels.get(channelId)
    if (!channel) return { connected: false, mode: "unknown" }
    if (channel.platform === "dingtalk" && channel.connectionMode === "stream") {
      return { connected: this.streamClients.get(channelId)?.isConnected() || false, mode: "stream" }
    }
    if (channel.platform === "custom" && channel.connectionMode === "stream") {
      return { connected: this.customSocketClients.get(channelId)?.isConnected() || false, mode: "stream" }
    }
    if (channel.platform === "wechat_personal" && channel.wechatPersonalBotToken) {
      return { connected: this.weChatPersonalPollers.has(channelId), mode: "stream" }
    }
    return { connected: Boolean(this.server && this.server.listening), mode: "webhook" }
  }

  getWebhookUrl(channel: ChannelConfigRecord) {
    const protocol = process.env.NODE_ENV === "production" ? "https" : "http"
    const host = process.env.WEBHOOK_HOST || "localhost"
    const port = process.env.WEBHOOK_PORT || String(this.port)
    return `${protocol}://${host}:${port}/webhook/${channel.platform}/${channel.id}`
  }

  async sendMessage(channelId: string, chatId: string, content: string) {
    const channel = this.channels.get(channelId) || getChannelDetail(channelId)?.channel
    if (!channel) return { success: false, error: "Channel not found" }

    if (channel.platform === "dingtalk" && channel.connectionMode === "stream") {
      const session = this.sessionWebhooks.get(`${channelId}:${chatId}`)
      if (session && session.expiresAt > Date.now()) {
        const result = await replyViaDingTalkSessionWebhook(session.url, content)
        recordOutgoingMessage(channelId, { chatId, senderId: channel.replyAgentId || "suora", senderName: channel.replyAgentId || "SUORA", content, status: result.success ? "sent" : "failed", error: result.error })
        return result
      }
    }

    const result = await sendMessageForChannel(channel, chatId, content, tokenCache, this.weChatPersonalContextTokens.get(`${channelId}:${chatId}`))
    recordOutgoingMessage(channelId, { chatId, senderId: channel.replyAgentId || "suora", senderName: channel.replyAgentId || "SUORA", content, status: result.success ? "sent" : "failed", error: result.error })
    return result
  }

  enqueueMessage(channelId: string, chatId: string, content: string) {
    const channel = this.channels.get(channelId)
    if (!channel) {
      throw new Error("Channel not found")
    }
    return this.messageQueue.enqueue(channel, chatId, content)
  }

  async healthCheck(channelId: string): Promise<ChannelHealthStatus> {
    const channel = this.channels.get(channelId) || getChannelDetail(channelId)?.channel
    if (!channel) {
      return { isHealthy: false, latencyMs: 0, error: "Channel not found" }
    }

    const start = Date.now()
    try {
      if (channel.platform === "wechat_personal") {
        if (channel.wechatPersonalBotToken) {
          const healthy = (channel.wechatPersonalBindingStatus || "bound") === "bound"
          const result = { isHealthy: healthy, latencyMs: Date.now() - start, error: healthy ? undefined : "Personal WeChat QR binding is not complete" }
          recordHealthCheck(channelId, result)
          return result
        }
        const result = !channel.wechatPersonalWebhookUrl
          ? { isHealthy: false, latencyMs: Date.now() - start, error: "Missing personal WeChat bridge webhook URL" }
          : (channel.wechatPersonalBindingStatus || "unbound") !== "bound"
            ? { isHealthy: false, latencyMs: Date.now() - start, error: "Personal WeChat QR binding is not complete" }
            : { isHealthy: true, latencyMs: Date.now() - start }
        recordHealthCheck(channelId, result)
        return result
      }

      if (channel.platform === "feishu") {
        await getFeishuAccessToken(channel.feishuAppId || channel.appId || "", channel.feishuAppSecret || channel.appSecret || "", tokenCache)
      } else if (channel.platform === "dingtalk") {
        await getDingTalkAccessToken(channel.dingtalkClientId || channel.appId || "", channel.dingtalkClientSecret || channel.appSecret || "", tokenCache)
      } else if (channel.platform === "wechat") {
        await getWeChatAccessToken(channel.wechatCorpId || channel.appId || "", channel.appSecret || "", tokenCache)
      } else if (channel.platform === "wechat_official") {
        await getWeChatOfficialAccessToken(channel.wechatOfficialAppId || channel.appId || "", channel.wechatOfficialAppSecret || channel.appSecret || "", tokenCache)
      } else if (channel.platform === "wechat_miniprogram") {
        await getWeChatMiniProgramAccessToken(channel.wechatMiniProgramAppId || channel.appId || "", channel.wechatMiniProgramAppSecret || channel.appSecret || "", tokenCache)
      } else if (channel.platform === "teams") {
        await getTeamsAccessToken(channel.teamsAppId || "", channel.teamsAppPassword || "", tokenCache)
      }

      const result = { isHealthy: true, latencyMs: Date.now() - start }
      recordHealthCheck(channelId, result)
      return result
    } catch (error) {
      const result = { isHealthy: false, latencyMs: Date.now() - start, error: error instanceof Error ? error.message : String(error) }
      recordHealthCheck(channelId, result)
      return result
    }
  }

  async startWeChatPersonalLogin(channelId?: string, force = false) {
    return startWeChatPersonalLogin(this.weChatPersonalLoginSessions, this.channels.values(), channelId, force)
  }

  async waitForWeChatPersonalLogin(channelId: string | undefined, sessionKey: string, verifyCode?: string, timeoutMs?: number) {
    return waitForWeChatPersonalLogin(this.weChatPersonalLoginSessions, this.channels.values(), channelId, sessionKey, verifyCode, timeoutMs)
  }

  async simulateIncomingMessage(channelId: string, content: string) {
    const channel = this.channels.get(channelId)
    if (!channel) throw new Error("Channel not found")
    await this.emitMessage(channel, {
      id: `mock-${Date.now()}`,
      channelId,
      platform: channel.platform,
      senderId: "debug-user",
      senderName: "Debug User",
      content,
      timestamp: Date.now(),
      messageType: "text",
      chatId: "debug-chat",
      chatType: "private",
    }, { debug: true })
  }

  private setupMiddleware() {
    this.app.use(express.text({ type: WECHAT_XML_CONTENT_TYPES }))
    this.app.use(express.json())
    this.app.use(express.urlencoded({ extended: true }))
  }

  private setupRoutes() {
    this.app.get("/health", (_req, res) => {
      res.json({ status: "ok", timestamp: Date.now() })
    })

    this.app.get("/webhook/:platform/:channelId", async (req, res) => {
      const channel = this.channels.get(String(req.params.channelId || ""))
      if (!channel || !channel.enabled) {
        res.status(404).json({ error: "Channel not found or disabled" })
        return
      }
      await handleGetWebhookRequest(req, res, channel, this.emitMessage.bind(this))
    })

    this.app.post("/webhook/:platform/:channelId", async (req, res) => {
      const channel = this.channels.get(String(req.params.channelId || ""))
      if (!channel || !channel.enabled) {
        res.status(404).json({ error: "Channel not found or disabled" })
        return
      }
      await handlePostWebhookRequest(req, res, channel, this.emitMessage.bind(this))
    })
  }

  private async emitMessage(channel: ChannelConfigRecord, message: RuntimeChannelEvent["message"], rawEvent: unknown) {
    if (message.id && this.processedMessageIds.has(message.id)) {
      return
    }
    if (message.id) {
      this.processedMessageIds.set(message.id, Date.now())
    }
    recordIncomingMessage(channel, message)
    appendDebugLog(channel.id, "info", `Inbound ${channel.platform} message routed to renderer.`)
    appState.mainWindow?.webContents.send("channel:message", { channel, message, rawEvent })
    if (this.messageHandler) {
      await this.messageHandler({ channel, message, rawEvent })
    }
  }

  private startDedupCleanup() {
    this.stopDedupCleanup()
    this.dedupCleanupInterval = setInterval(() => {
      const cutoff = Date.now() - 5 * 60 * 1000
      for (const [id, timestamp] of this.processedMessageIds) {
        if (timestamp < cutoff) {
          this.processedMessageIds.delete(id)
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

}

let channelServiceInstance: ChannelService | null = null

export function getChannelService(port?: number) {
  if (!channelServiceInstance) {
    channelServiceInstance = new ChannelService(port)
  }
  return channelServiceInstance
}
