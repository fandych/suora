import express, { type Express, type Request, type Response } from 'express'
import { createServer, type Server } from 'http'
import crypto from 'crypto'
import https from 'https'
import http from 'http'
import { getLogger } from './logger.js'
import { DingTalkStreamClient, replyViaDingTalkSessionWebhook } from './dingtalkStream.js'
import type { ChannelConfig, ChannelMessage, ChannelPlatform } from '../src/types/index.js'

export interface ChannelWebhookEvent {
  channel: ChannelConfig
  message: ChannelMessage
  rawEvent: unknown
}

type ChannelEventHandler = (event: ChannelWebhookEvent) => Promise<void>

// ─── Access Token Management ───────────────────────────────────────

interface TokenCache {
  token: string
  expiresAt: number
}

const tokenCache = new Map<string, TokenCache>()

// Expiry for platforms using static bot tokens (1 year - effectively "never expires")
const STATIC_TOKEN_EXPIRY_MS = 365 * 24 * 3600000

// Max age for Slack request timestamps (5 minutes) to prevent replay attacks
const SLACK_REQUEST_MAX_AGE_SECONDS = 300

async function httpRequest(url: string, options: { method?: string; headers?: Record<string, string>; body?: string }): Promise<{ status: number; data: unknown }> {
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

async function getFeishuAccessToken(appId: string, appSecret: string): Promise<string> {
  const cacheKey = `feishu:${appId}`
  const cached = tokenCache.get(cacheKey)
  if (cached && cached.expiresAt > Date.now() + 300000) return cached.token

  const res = await httpRequest('https://open.feishu.cn/open-apis/auth/v3/tenant_access_token/internal', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
    body: JSON.stringify({ app_id: appId, app_secret: appSecret }),
  })
  const data = res.data as { tenant_access_token?: string; expire?: number; code?: number; msg?: string }
  if (data.code !== 0 || !data.tenant_access_token) {
    throw new Error(`Feishu token error: ${data.msg || 'unknown'}`)
  }
  tokenCache.set(cacheKey, { token: data.tenant_access_token, expiresAt: Date.now() + (data.expire || 7200) * 1000 })
  return data.tenant_access_token
}

async function getDingTalkAccessToken(appKey: string, appSecret: string): Promise<string> {
  const cacheKey = `dingtalk:${appKey}`
  const cached = tokenCache.get(cacheKey)
  if (cached && cached.expiresAt > Date.now() + 300000) return cached.token

  const res = await httpRequest('https://oapi.dingtalk.com/gettoken?appkey=' + encodeURIComponent(appKey) + '&appsecret=' + encodeURIComponent(appSecret), {
    method: 'GET',
  })
  const data = res.data as { access_token?: string; expires_in?: number; errcode?: number; errmsg?: string }
  if (data.errcode !== 0 || !data.access_token) {
    throw new Error(`DingTalk token error: ${data.errmsg || 'unknown'}`)
  }
  tokenCache.set(cacheKey, { token: data.access_token, expiresAt: Date.now() + (data.expires_in || 7200) * 1000 })
  return data.access_token
}

async function getWeChatAccessToken(corpId: string, corpSecret: string): Promise<string> {
  const cacheKey = `wechat:${corpId}`
  const cached = tokenCache.get(cacheKey)
  if (cached && cached.expiresAt > Date.now() + 300000) return cached.token

  const res = await httpRequest('https://qyapi.weixin.qq.com/cgi-bin/gettoken?corpid=' + encodeURIComponent(corpId) + '&corpsecret=' + encodeURIComponent(corpSecret), {
    method: 'GET',
  })
  const data = res.data as { access_token?: string; expires_in?: number; errcode?: number; errmsg?: string }
  if (data.errcode !== 0 || !data.access_token) {
    throw new Error(`WeChat token error: ${data.errmsg || 'unknown'}`)
  }
  tokenCache.set(cacheKey, { token: data.access_token, expiresAt: Date.now() + (data.expires_in || 7200) * 1000 })
  return data.access_token
}

// Slack, Telegram, and Discord use static tokens (bot tokens) rather than OAuth token exchange,
// so no dynamic token-fetching functions are needed for them.

// Teams uses OAuth2 client_credentials flow to get a Microsoft Bot Framework token.
async function getTeamsAccessToken(appId: string, appPassword: string): Promise<string> {
  const cacheKey = `teams:${appId}`
  const cached = tokenCache.get(cacheKey)
  if (cached && cached.expiresAt > Date.now() + 300000) return cached.token

  const body = new URLSearchParams({
    grant_type: 'client_credentials',
    client_id: appId,
    client_secret: appPassword,
    scope: 'https://api.botframework.com/.default',
  }).toString()

  const res = await httpRequest('https://login.microsoftonline.com/botframework.com/oauth2/v2.0/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  })
  const data = res.data as { access_token?: string; expires_in?: number; error?: string; error_description?: string }
  if (!data.access_token) {
    throw new Error(`Teams token error: ${data.error_description || data.error || 'unknown'}`)
  }
  tokenCache.set(cacheKey, { token: data.access_token, expiresAt: Date.now() + (data.expires_in || 3600) * 1000 })
  return data.access_token
}

// ─── Message Sending ───────────────────────────────────────────────

async function sendFeishuMessage(channel: ChannelConfig, chatId: string, content: string): Promise<{ success: boolean; error?: string }> {
  if (!channel.appId || !channel.appSecret) return { success: false, error: 'Missing appId or appSecret' }
  try {
    const token = await getFeishuAccessToken(channel.appId, channel.appSecret)
    const res = await httpRequest('https://open.feishu.cn/open-apis/im/v1/messages?receive_id_type=chat_id', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
        'Authorization': `Bearer ${token}`,
      },
      body: JSON.stringify({
        receive_id: chatId,
        msg_type: 'text',
        content: JSON.stringify({ text: content }),
      }),
    })
    const data = res.data as { code?: number; msg?: string }
    if (data.code !== 0) return { success: false, error: data.msg || 'Send failed' }
    return { success: true }
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : String(err) }
  }
}

async function sendDingTalkMessage(channel: ChannelConfig, chatId: string, content: string): Promise<{ success: boolean; error?: string }> {
  if (!channel.appId || !channel.appSecret) return { success: false, error: 'Missing appKey or appSecret' }
  try {
    const token = await getDingTalkAccessToken(channel.appId, channel.appSecret)
    const res = await httpRequest('https://oapi.dingtalk.com/topapi/message/corpconversation/asyncsend_v2?access_token=' + encodeURIComponent(token), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json; charset=utf-8' },
      body: JSON.stringify({
        agent_id: channel.appId,
        to_all_user: false,
        userid_list: chatId,
        msg: { msgtype: 'text', text: { content } },
      }),
    })
    const data = res.data as { errcode?: number; errmsg?: string }
    if (data.errcode !== 0) return { success: false, error: data.errmsg || 'Send failed' }
    return { success: true }
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : String(err) }
  }
}

async function sendWeChatMessage(channel: ChannelConfig, chatId: string, content: string): Promise<{ success: boolean; error?: string }> {
  if (!channel.appId || !channel.appSecret) return { success: false, error: 'Missing corpId or corpSecret' }
  try {
    const token = await getWeChatAccessToken(channel.appId, channel.appSecret)
    const res = await httpRequest('https://qyapi.weixin.qq.com/cgi-bin/message/send?access_token=' + encodeURIComponent(token), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json; charset=utf-8' },
      body: JSON.stringify({
        touser: chatId,
        msgtype: 'text',
        agentid: channel.appId,
        text: { content },
      }),
    })
    const data = res.data as { errcode?: number; errmsg?: string }
    if (data.errcode !== 0) return { success: false, error: data.errmsg || 'Send failed' }
    return { success: true }
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : String(err) }
  }
}

async function sendSlackMessage(channel: ChannelConfig, chatId: string, content: string): Promise<{ success: boolean; error?: string }> {
  if (!channel.slackBotToken) return { success: false, error: 'Missing Slack bot token' }
  try {
    const res = await httpRequest('https://slack.com/api/chat.postMessage', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
        'Authorization': `Bearer ${channel.slackBotToken}`,
      },
      body: JSON.stringify({
        channel: chatId,
        text: content,
      }),
    })
    const data = res.data as { ok?: boolean; error?: string }
    if (!data.ok) return { success: false, error: data.error || 'Send failed' }
    return { success: true }
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : String(err) }
  }
}

async function sendTelegramMessage(channel: ChannelConfig, chatId: string, content: string): Promise<{ success: boolean; error?: string }> {
  if (!channel.telegramBotToken) return { success: false, error: 'Missing Telegram bot token' }
  try {
    const res = await httpRequest(`https://api.telegram.org/bot${channel.telegramBotToken}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json; charset=utf-8' },
      body: JSON.stringify({
        chat_id: chatId,
        text: content,
      }),
    })
    const data = res.data as { ok?: boolean; description?: string }
    if (!data.ok) return { success: false, error: data.description || 'Send failed' }
    return { success: true }
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : String(err) }
  }
}

async function sendDiscordMessage(channel: ChannelConfig, chatId: string, content: string): Promise<{ success: boolean; error?: string }> {
  if (!channel.discordBotToken) return { success: false, error: 'Missing Discord bot token' }
  try {
    const res = await httpRequest(`https://discord.com/api/v10/channels/${chatId}/messages`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
        'Authorization': `Bot ${channel.discordBotToken}`,
      },
      body: JSON.stringify({
        content,
      }),
    })
    if (res.status >= 400) {
      const data = res.data as { message?: string }
      return { success: false, error: data.message || `HTTP ${res.status}` }
    }
    return { success: true }
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : String(err) }
  }
}

async function sendTeamsMessage(channel: ChannelConfig, chatId: string, content: string): Promise<{ success: boolean; error?: string }> {
  if (!channel.teamsAppId || !channel.teamsAppPassword) return { success: false, error: 'Missing Teams app ID or password' }
  try {
    const token = await getTeamsAccessToken(channel.teamsAppId, channel.teamsAppPassword)
    // chatId format for Teams: "serviceUrl|conversationId" (stored together for routing)
    const parts = chatId.split('|')
    const serviceUrl = parts[0] || ''
    const conversationId = parts[1] || chatId

    const baseUrl = serviceUrl.endsWith('/') ? serviceUrl : serviceUrl + '/'
    const url = `${baseUrl}v3/conversations/${encodeURIComponent(conversationId)}/activities`

    const res = await httpRequest(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
        'Authorization': `Bearer ${token}`,
      },
      body: JSON.stringify({
        type: 'message',
        text: content,
      }),
    })
    if (res.status >= 400) {
      const data = res.data as { message?: string; error?: { message?: string } }
      return { success: false, error: data.error?.message || data.message || `HTTP ${res.status}` }
    }
    return { success: true }
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : String(err) }
  }
}

async function sendCustomMessage(channel: ChannelConfig, chatId: string, content: string): Promise<{ success: boolean; error?: string }> {
  if (!channel.customWebhookUrl) return { success: false, error: 'Missing custom webhook URL' }
  try {
    // Build payload from template or use default
    const template = channel.customPayloadTemplate || '{"chat_id":"{{chatId}}","text":"{{content}}"}'
    // Use JSON.stringify to properly escape values, then strip surrounding quotes
    const safeContent = JSON.stringify(content).slice(1, -1)
    const safeChatId = JSON.stringify(chatId).slice(1, -1)
    // Use function replacer to avoid $-substitution in replacement strings
    const payload = template
      .replace(/\{\{content\}\}/g, () => safeContent)
      .replace(/\{\{chatId\}\}/g, () => safeChatId)

    const headers: Record<string, string> = { 'Content-Type': 'application/json; charset=utf-8' }
    if (channel.customAuthHeader && channel.customAuthValue) {
      headers[channel.customAuthHeader] = channel.customAuthValue
    }

    const res = await httpRequest(channel.customWebhookUrl, {
      method: 'POST',
      headers,
      body: payload,
    })
    if (res.status >= 400) {
      const data = res.data as { message?: string; error?: string }
      return { success: false, error: data.message || data.error || `HTTP ${res.status}` }
    }
    return { success: true }
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : String(err) }
  }
}

// ─── Message Queue with Retry & Rate Limiting ──────────────────────

interface QueuedMessage {
  id: string
  channel: ChannelConfig
  chatId: string
  content: string
  retryCount: number
  maxRetries: number
  createdAt: number
  nextRetryAt: number
}

class MessageQueue {
  private queue: QueuedMessage[] = []
  private processing = false
  private rateLimitWindow = 1000  // 1 message per second per channel
  private lastSentPerChannel = new Map<string, number>()

  enqueue(channel: ChannelConfig, chatId: string, content: string, maxRetries = 3): string {
    const id = `mq-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
    this.queue.push({ id, channel, chatId, content, retryCount: 0, maxRetries, createdAt: Date.now(), nextRetryAt: 0 })
    this.processQueue()
    return id
  }

  private async processQueue() {
    if (this.processing) return
    this.processing = true

    while (this.queue.length > 0) {
      const msg = this.queue[0]
      if (!msg) break

      // Rate limit check
      const lastSent = this.lastSentPerChannel.get(msg.channel.id) || 0
      const timeSinceLastSent = Date.now() - lastSent
      if (timeSinceLastSent < this.rateLimitWindow) {
        await new Promise((r) => setTimeout(r, this.rateLimitWindow - timeSinceLastSent))
      }

      // Retry delay (exponential backoff)
      if (msg.nextRetryAt > Date.now()) {
        await new Promise((r) => setTimeout(r, msg.nextRetryAt - Date.now()))
      }

      const result = await sendMessageForPlatform(msg.channel, msg.chatId, msg.content)
      this.lastSentPerChannel.set(msg.channel.id, Date.now())

      if (result.success) {
        this.queue.shift()
      } else {
        msg.retryCount++
        if (msg.retryCount >= msg.maxRetries) {
          getLogger().error('Message send failed after max retries', { id: msg.id, error: result.error })
          this.queue.shift()
        } else {
          // Exponential backoff: 2^retryCount seconds
          msg.nextRetryAt = Date.now() + Math.pow(2, msg.retryCount) * 1000
          getLogger().warn('Retrying message send', { id: msg.id, retryCount: msg.retryCount })
          // Move to back of queue for the retry
          this.queue.shift()
          this.queue.push(msg)
        }
      }
    }

    this.processing = false
  }
}

const messageQueue = new MessageQueue()

async function sendMessageForPlatform(channel: ChannelConfig, chatId: string, content: string): Promise<{ success: boolean; error?: string }> {
  switch (channel.platform) {
    case 'feishu':
      return sendFeishuMessage(channel, chatId, content)
    case 'dingtalk':
      return sendDingTalkMessage(channel, chatId, content)
    case 'wechat':
    case 'wechat_official':
    case 'wechat_miniprogram':
      return sendWeChatMessage(channel, chatId, content)
    case 'slack':
      return sendSlackMessage(channel, chatId, content)
    case 'telegram':
      return sendTelegramMessage(channel, chatId, content)
    case 'discord':
      return sendDiscordMessage(channel, chatId, content)
    case 'teams':
      return sendTeamsMessage(channel, chatId, content)
    case 'custom':
      return sendCustomMessage(channel, chatId, content)
    default:
      return { success: false, error: `Unsupported platform: ${channel.platform}` }
  }
}

/**
 * Channel Service - HTTP webhook server for WeChat, Feishu, DingTalk, Slack, Telegram, Discord, Teams integration
 * Compatible with OpenClaw's channel architecture
 */
export class ChannelService {
  private app: Express
  private server: Server | null = null
  private port: number
  private channels: Map<string, ChannelConfig> = new Map()
  private messageHandler: ChannelEventHandler | null = null
  private streamClients: Map<string, DingTalkStreamClient> = new Map()
  // Track session webhooks for stream mode replies (channelId:chatId -> webhook URL)
  private sessionWebhooks: Map<string, { url: string; expiresAt: number }> = new Map()
  // Dedup: track processed message IDs to prevent duplicate handling
  private processedMessageIds = new Map<string, number>()  // messageId -> timestamp
  private dedupTTL = 5 * 60 * 1000  // 5 minutes
  private dedupCleanupInterval: ReturnType<typeof setInterval> | null = null

  constructor(port: number = 3000) {
    this.port = port
    this.app = express()
    this.setupMiddleware()
    this.setupRoutes()
  }

  private setupMiddleware() {
    // Parse JSON payloads
    this.app.use(express.json())
    // Parse URL-encoded payloads
    this.app.use(express.urlencoded({ extended: true }))

    // Request logging
    this.app.use((req, _res, next) => {
      getLogger().debug('Incoming webhook request', {
        method: req.method,
        path: req.path,
        headers: req.headers,
      })
      next()
    })
  }

  private setupRoutes() {
    // Health check
    this.app.get('/health', (_req: Request, res: Response) => {
      res.json({ status: 'ok', timestamp: Date.now() })
    })

    // Generic webhook endpoint - routes to platform-specific handlers
    this.app.post('/webhook/:platform/:channelId', async (req: Request, res: Response) => {
      const platform = req.params.platform as string
      const channelId = req.params.channelId as string

      try {
        const channel = this.channels.get(channelId)
        if (!channel || !channel.enabled) {
          return res.status(404).json({ error: 'Channel not found or disabled' })
        }

        // Route to platform-specific handler
        switch (platform as ChannelPlatform) {
          case 'feishu':
            await this.handleFeishuWebhook(req, res, channel)
            break
          case 'dingtalk':
            await this.handleDingTalkWebhook(req, res, channel)
            break
          case 'wechat':
          case 'wechat_official':
          case 'wechat_miniprogram':
            await this.handleWeChatWebhook(req, res, channel)
            break
          case 'slack':
            await this.handleSlackWebhook(req, res, channel)
            break
          case 'telegram':
            await this.handleTelegramWebhook(req, res, channel)
            break
          case 'discord':
            await this.handleDiscordWebhook(req, res, channel)
            break
          case 'teams':
            await this.handleTeamsWebhook(req, res, channel)
            break
          case 'custom':
            await this.handleCustomWebhook(req, res, channel)
            break
          default:
            res.status(400).json({ error: 'Unsupported platform' })
        }
      } catch (error) {
        getLogger().error('Webhook processing error', { error, platform, channelId })
        res.status(500).json({ error: 'Internal server error' })
      }
    })
  }

  /**
   * Feishu/Lark webhook handler
   */
  private async handleFeishuWebhook(req: Request, res: Response, channel: ChannelConfig) {
    const body = req.body

    // Handle URL verification (first-time setup)
    if (body.type === 'url_verification') {
      const challenge = body.challenge
      return res.json({ challenge })
    }

    // Verify signature if configured
    if (channel.encryptKey && req.headers['x-lark-signature']) {
      const timestamp = req.headers['x-lark-request-timestamp'] as string
      const nonce = req.headers['x-lark-request-nonce'] as string
      const signature = req.headers['x-lark-signature'] as string

      if (!this.verifyFeishuSignature(timestamp, nonce, channel.encryptKey, body, signature)) {
        getLogger().warn('Feishu signature verification failed', { channelId: channel.id })
        return res.status(403).json({ error: 'Invalid signature' })
      }
    }

    // Handle message events
    if (body.header?.event_type === 'im.message.receive_v1') {
      const event = body.event
      // Parse JSON content safely
      let messageText = ''
      try {
        messageText = JSON.parse(event.message.content).text || ''
      } catch {
        messageText = String(event.message.content || '')
      }

      const message: ChannelMessage = {
        id: event.message.message_id,
        channelId: channel.id,
        platform: 'feishu',
        senderId: event.sender.sender_id.user_id,
        senderName: event.sender.sender_id.union_id,
        content: messageText,
        timestamp: (() => { const ts = parseInt(event.message.create_time, 10); return Number.isNaN(ts) ? Date.now() : ts })(),
        messageType: 'text',
        chatId: event.message.chat_id,
        chatType: event.message.chat_type === 'group' ? 'group' : 'private',
      }

      await this.emitMessage(channel, message, body)
    }

    res.json({ success: true })
  }

  /**
   * DingTalk webhook handler
   */
  private async handleDingTalkWebhook(req: Request, res: Response, channel: ChannelConfig) {
    const body = req.body

    // Verify signature if configured
    if (channel.appSecret && req.headers['sign']) {
      const timestamp = req.headers['timestamp'] as string
      const sign = req.headers['sign'] as string

      if (!this.verifyDingTalkSignature(timestamp, channel.appSecret, sign)) {
        getLogger().warn('DingTalk signature verification failed', { channelId: channel.id })
        return res.status(403).json({ error: 'Invalid signature' })
      }
    }

    // Handle text message
    if (body.msgtype === 'text') {
      const message: ChannelMessage = {
        id: body.msgId || `${Date.now()}`,
        channelId: channel.id,
        platform: 'dingtalk',
        senderId: body.senderStaffId || body.senderId || '',
        senderName: body.senderNick,
        content: body.text?.content || '',
        timestamp: body.createAt || Date.now(),
        messageType: 'text',
        chatId: body.conversationId,
        chatType: body.conversationType === '2' ? 'group' : 'private',
      }

      await this.emitMessage(channel, message, body)
    }

    res.json({ success: true })
  }

  /**
   * WeChat Work webhook handler
   */
  private async handleWeChatWebhook(req: Request, res: Response, channel: ChannelConfig) {
    const body = req.body

    // Handle echo verification (first-time setup)
    if (req.query.echostr) {
      return res.send(req.query.echostr)
    }

    // Verify signature if configured
    if (channel.verificationToken) {
      const signature = req.query.msg_signature as string
      const timestamp = req.query.timestamp as string
      const nonce = req.query.nonce as string

      if (!this.verifyWeChatSignature(channel.verificationToken, timestamp, nonce, body, signature)) {
        getLogger().warn('WeChat signature verification failed', { channelId: channel.id })
        return res.status(403).json({ error: 'Invalid signature' })
      }
    }

    // Parse WeChat XML message (simplified - in production use xml parser)
    // For now, assume JSON mode or pre-parsed
    if (body.MsgType === 'text') {
      const message: ChannelMessage = {
        id: body.MsgId || `${Date.now()}`,
        channelId: channel.id,
        platform: 'wechat',
        senderId: body.FromUserName,
        senderName: body.FromUserName,
        content: body.Content || '',
        timestamp: parseInt(body.CreateTime, 10) * 1000,
        messageType: 'text',
        chatId: body.FromUserName,
        chatType: 'private',
      }

      await this.emitMessage(channel, message, body)
    }

    res.json({ success: true })
  }

  /**
   * Slack Events API webhook handler
   */
  private async handleSlackWebhook(req: Request, res: Response, channel: ChannelConfig) {
    const body = req.body

    // Handle URL verification challenge (Slack Events API setup)
    if (body.type === 'url_verification') {
      return res.json({ challenge: body.challenge })
    }

    // Verify Slack request signature if signing secret is configured
    if (channel.slackSigningSecret) {
      const timestamp = req.headers['x-slack-request-timestamp'] as string
      const slackSignature = req.headers['x-slack-signature'] as string
      if (!this.verifySlackSignature(channel.slackSigningSecret, timestamp, JSON.stringify(body), slackSignature)) {
        getLogger().warn('Slack signature verification failed', { channelId: channel.id })
        return res.status(403).json({ error: 'Invalid signature' })
      }
    }

    // Handle event_callback (message events)
    if (body.type === 'event_callback' && body.event) {
      const event = body.event

      // Ignore bot messages to prevent loops
      if (event.bot_id || event.subtype === 'bot_message') {
        return res.json({ ok: true })
      }

      if (event.type === 'message' && !event.subtype) {
        const parsedTs = event.ts ? parseFloat(event.ts) : NaN
        const message: ChannelMessage = {
          id: event.client_msg_id || event.ts || `slack-${Date.now()}`,
          channelId: channel.id,
          platform: 'slack',
          senderId: event.user || '',
          senderName: event.user || '',
          content: event.text || '',
          timestamp: Number.isNaN(parsedTs) ? Date.now() : Math.floor(parsedTs * 1000),
          messageType: 'text',
          chatId: event.channel,
          chatType: event.channel_type === 'im' ? 'private' : 'group',
        }

        await this.emitMessage(channel, message, body)
      }
    }

    res.json({ ok: true })
  }

  /**
   * Telegram Bot API webhook handler
   */
  private async handleTelegramWebhook(req: Request, res: Response, channel: ChannelConfig) {
    const body = req.body

    // Verify Telegram secret token if configured
    if (channel.webhookSecret) {
      const headerValue = req.headers['x-telegram-bot-api-secret-token']
      const secretToken = typeof headerValue === 'string' ? headerValue : ''
      if (!secretToken || !this.timingSafeCompare(secretToken, channel.webhookSecret)) {
        getLogger().warn('Telegram secret token verification failed', { channelId: channel.id })
        return res.status(403).json({ error: 'Invalid secret token' })
      }
    }

    // Handle message updates
    const update = body
    if (update.message) {
      const msg = update.message
      const chat = msg.chat

      let content = ''
      let messageType: ChannelMessage['messageType'] = 'text'

      if (msg.text) {
        content = msg.text
        messageType = 'text'
      } else if (msg.photo) {
        content = msg.caption || '[Photo]'
        messageType = 'image'
      } else if (msg.document) {
        // Sanitize file_name to prevent injection (only allow safe characters)
        const rawName = String(msg.document.file_name || 'unknown')
        const safeName = rawName.replace(/[<>&"'`]/g, '').slice(0, 200)
        content = msg.caption || `[File: ${safeName}]`
        messageType = 'file'
      } else if (msg.voice) {
        content = '[Voice message]'
        messageType = 'voice'
      } else {
        content = msg.caption || '[Unsupported message type]'
      }

      const message: ChannelMessage = {
        id: String(msg.message_id),
        channelId: channel.id,
        platform: 'telegram',
        senderId: String(msg.from?.id || ''),
        senderName: msg.from ? `${msg.from.first_name || ''}${msg.from.last_name ? ' ' + msg.from.last_name : ''}`.trim() : '',
        content,
        timestamp: msg.date ? msg.date * 1000 : Date.now(),
        messageType,
        chatId: String(chat.id),
        chatType: chat.type === 'private' ? 'private' : 'group',
      }

      await this.emitMessage(channel, message, body)
    }

    res.json({ ok: true })
  }

  /**
   * Discord Interactions webhook handler
   */
  private async handleDiscordWebhook(req: Request, res: Response, channel: ChannelConfig) {
    const body = req.body

    // Handle Discord interaction verification (ping)
    if (body.type === 1) {
      return res.json({ type: 1 })
    }

    // Handle message-based events (from a Discord bot gateway forwarded via webhook,
    // or using Discord Interactions API)
    if (body.type === 2 || body.type === 3) {
      // Application command or message component interaction
      const user = body.member?.user || body.user
      const message: ChannelMessage = {
        id: body.id || `discord-${Date.now()}`,
        channelId: channel.id,
        platform: 'discord',
        senderId: user?.id || '',
        senderName: user?.username || user?.global_name || '',
        content: body.data?.options?.[0]?.value || body.data?.name || '',
        // Discord Snowflake ID format: timestamp bits >> 22 + Discord epoch (2015-01-01T00:00:00.000Z)
        timestamp: body.id ? Math.floor(Number(BigInt(body.id) >> 22n) + 1420070400000) : Date.now(),
        messageType: 'text',
        chatId: body.channel_id || body.channel?.id || '',
        chatType: body.guild_id ? 'group' : 'private',
      }

      await this.emitMessage(channel, message, body)
      // Acknowledge the interaction
      return res.json({ type: 5 })
    }

    // Handle webhook-forwarded messages (custom integration pattern)
    if (body.content && body.author && !body.author.bot) {
      const message: ChannelMessage = {
        id: body.id || `discord-${Date.now()}`,
        channelId: channel.id,
        platform: 'discord',
        senderId: body.author.id || '',
        senderName: body.author.username || body.author.global_name || '',
        content: body.content,
        timestamp: (() => { const ts = body.timestamp ? new Date(body.timestamp).getTime() : NaN; return Number.isNaN(ts) ? Date.now() : ts })(),
        messageType: 'text',
        chatId: body.channel_id || '',
        chatType: body.guild_id ? 'group' : 'private',
      }

      await this.emitMessage(channel, message, body)
    }

    res.json({ ok: true })
  }

  /**
   * Microsoft Teams Bot Framework webhook handler
   * Receives activities from the Bot Framework Service
   */
  private async handleTeamsWebhook(req: Request, res: Response, channel: ChannelConfig) {
    const body = req.body

    // Teams sends different activity types
    const activityType = body.type

    // Ignore non-message activities (e.g., conversationUpdate, typing, etc.)
    if (activityType !== 'message') {
      return res.status(200).json({ ok: true })
    }

    // Extract message from Teams activity
    const from = body.from || {}
    const conversation = body.conversation || {}
    const serviceUrl = body.serviceUrl || ''

    // Build chatId as "serviceUrl|conversationId" for reply routing
    const chatId = `${serviceUrl}|${conversation.id || ''}`

    const message: ChannelMessage = {
      id: body.id || `teams-${Date.now()}`,
      channelId: channel.id,
      platform: 'teams',
      senderId: from.id || '',
      senderName: from.name || '',
      content: body.text || '',
      timestamp: (() => { const ts = body.timestamp ? new Date(body.timestamp).getTime() : NaN; return Number.isNaN(ts) ? Date.now() : ts })(),
      messageType: 'text',
      chatId,
      chatType: conversation.isGroup ? 'group' : 'private',
    }

    // Ignore bot's own messages
    if (from.id === channel.teamsAppId) {
      return res.status(200).json({ ok: true })
    }

    await this.emitMessage(channel, message, body)
    res.status(200).json({ ok: true })
  }

  /**
   * Custom channel webhook handler
   * Accepts a generic JSON payload with expected fields: senderId, senderName, content, chatId
   */
  private async handleCustomWebhook(req: Request, res: Response, channel: ChannelConfig) {
    const body = req.body

    // Verify webhook secret if configured
    if (channel.webhookSecret) {
      const providedSecret = req.headers['x-webhook-secret'] || req.query.secret
      if (providedSecret !== channel.webhookSecret) {
        return res.status(401).json({ error: 'Invalid webhook secret' })
      }
    }

    // Extract message from body — accept flexible field names
    const senderId = body.senderId || body.sender_id || body.user_id || body.from?.id || 'unknown'
    const senderName = body.senderName || body.sender_name || body.user_name || body.from?.name || senderId
    const content = body.content || body.text || body.message || body.msg || ''
    const chatId = body.chatId || body.chat_id || body.conversation_id || body.channel_id || ''

    if (!content) {
      return res.status(200).json({ ok: true, skipped: 'empty content' })
    }

    const message: ChannelMessage = {
      id: body.id || body.message_id || `custom-${Date.now()}`,
      channelId: channel.id,
      platform: 'custom',
      senderId,
      senderName,
      content,
      timestamp: (() => { const ts = body.timestamp ? new Date(body.timestamp).getTime() : NaN; return Number.isNaN(ts) ? Date.now() : ts })(),
      messageType: 'text',
      chatId,
      chatType: body.chatType || body.chat_type || 'private',
    }

    await this.emitMessage(channel, message, body)
    res.json({ ok: true })
  }

  private verifyFeishuSignature(
    timestamp: string,
    nonce: string,
    encryptKey: string,
    body: unknown,
    receivedSignature: string
  ): boolean {
    // Feishu v2 signature: sha256(timestamp + "\n" + nonce + "\n" + encrypt_key + "\n" + body_string)
    const bodyStr = JSON.stringify(body)
    const content = timestamp + '\n' + nonce + '\n' + encryptKey + '\n' + bodyStr
    const hash = crypto.createHash('sha256').update(content).digest('hex')
    return this.timingSafeCompare(hash, receivedSignature)
  }

  /**
   * Verify DingTalk signature with replay protection.
   * DingTalk signs `{timestamp}\n{appSecret}` — to prevent indefinite replay
   * we additionally enforce that the timestamp is within a short window of
   * the current server time (matching DingTalk's official 1-hour guidance).
   */
  private verifyDingTalkSignature(timestamp: string, appSecret: string, receivedSign: string): boolean {
    const tsMs = Number.parseInt(timestamp, 10)
    if (!Number.isFinite(tsMs) || tsMs <= 0) return false
    const DINGTALK_REQUEST_MAX_AGE_MS = 60 * 60 * 1000 // 1 hour
    if (Math.abs(Date.now() - tsMs) > DINGTALK_REQUEST_MAX_AGE_MS) return false

    const stringToSign = timestamp + '\n' + appSecret
    const sign = crypto
      .createHmac('sha256', appSecret)
      .update(stringToSign)
      .digest('base64')
    return this.timingSafeCompare(sign, receivedSign)
  }

  /**
   * Verify WeChat signature
   */
  private verifyWeChatSignature(
    token: string,
    timestamp: string,
    nonce: string,
    body: unknown,
    receivedSignature: string
  ): boolean {
    const arr = [token, timestamp, nonce, JSON.stringify(body)].sort()
    const str = arr.join('')
    const hash = crypto.createHash('sha1').update(str).digest('hex')
    return this.timingSafeCompare(hash, receivedSignature)
  }

  /**
   * Constant-time string comparison to prevent timing attacks on signatures.
   */
  private timingSafeCompare(a: string, b: string): boolean {
    const bufA = Buffer.from(a)
    const bufB = Buffer.from(b)
    if (bufA.length !== bufB.length) return false
    return crypto.timingSafeEqual(bufA, bufB)
  }

  /**
   * Verify Slack request signature
   */
  private verifySlackSignature(
    signingSecret: string,
    timestamp: string,
    body: string,
    receivedSignature: string
  ): boolean {
    // Prevent replay attacks (request must be within 5 minutes)
    const now = Math.floor(Date.now() / 1000)
    const tsSeconds = parseInt(timestamp, 10)
    if (Number.isNaN(tsSeconds) || Math.abs(now - tsSeconds) > SLACK_REQUEST_MAX_AGE_SECONDS) return false

    const sigBasestring = `v0:${timestamp}:${body}`
    const mySignature = 'v0=' + crypto
      .createHmac('sha256', signingSecret)
      .update(sigBasestring, 'utf8')
      .digest('hex')

    const myBuf = Buffer.from(mySignature)
    const receivedBuf = Buffer.from(receivedSignature)
    // timingSafeEqual requires equal-length buffers; reject mismatched lengths
    if (myBuf.length !== receivedBuf.length) return false
    return crypto.timingSafeEqual(myBuf, receivedBuf)
  }

  /**
   * Emit message event to handler (with dedup)
   */
  private async emitMessage(channel: ChannelConfig, message: ChannelMessage, rawEvent: unknown) {
    // Dedup: skip messages already processed
    if (message.id && this.processedMessageIds.has(message.id)) {
      getLogger().debug('Duplicate message skipped', {
        channelId: channel.id,
        messageId: message.id,
      })
      return
    }
    if (message.id) {
      this.processedMessageIds.set(message.id, Date.now())
    }

    // Check if chat is allowed
    if (channel.allowedChats && channel.allowedChats.length > 0) {
      if (!message.chatId || !channel.allowedChats.includes(message.chatId)) {
        getLogger().debug('Message from non-whitelisted chat, ignoring', {
          channelId: channel.id,
          chatId: message.chatId,
        })
        return
      }
    }

    getLogger().info('Channel message received', {
      channelId: channel.id,
      platform: channel.platform,
      sender: message.senderName,
      content: message.content.substring(0, 50),
    })

    if (this.messageHandler) {
      await this.messageHandler({ channel, message, rawEvent })
    }
  }

  /**
   * Register channels
   */
  public async registerChannels(channels: ChannelConfig[]) {
    this.channels.clear()
    for (const channel of channels) {
      if (channel.enabled) {
        this.channels.set(channel.id, channel)
        getLogger().info('Channel registered', {
          id: channel.id,
          name: channel.name,
          platform: channel.platform,
          connectionMode: channel.connectionMode || 'webhook',
        })
      }
    }
    // Manage stream connections for DingTalk stream-mode channels
    await this.syncStreamClients()
  }

  /**
   * Set message handler
   */
  public onMessage(handler: ChannelEventHandler) {
    this.messageHandler = handler
  }

  /**
   * Start HTTP server
   */
  public async start(): Promise<void> {
    if (this.server) {
      getLogger().warn('Channel service already running')
      return
    }

    this.startDedupCleanup()

    return new Promise((resolve) => {
      this.server = createServer(this.app)
      // Bind to loopback only — webhooks are reached via the configurable
      // public URL the user sets per-channel (typically a tunnel/reverse
      // proxy). Listening on 0.0.0.0 by default would expose the bot to
      // every device on the local network.
      this.server.listen(this.port, '127.0.0.1', () => {
        getLogger().info('Channel service started', { port: this.port, host: '127.0.0.1' })
        resolve()
      })
    })
  }

  /**
   * Stop HTTP server and disconnect all stream clients
   */
  public async stop(): Promise<void> {
    // Disconnect all stream clients
    for (const [id, client] of this.streamClients) {
      await client.disconnect()
      getLogger().info('DingTalk stream client disconnected on stop', { channelId: id })
    }
    this.streamClients.clear()
    this.sessionWebhooks.clear()
    this.processedMessageIds.clear()
    this.stopDedupCleanup()

    if (!this.server) return

    return new Promise((resolve, reject) => {
      const server = this.server
      if (!server) {
        resolve()
        return
      }
      server.close((err) => {
        if (err) {
          getLogger().error('Error stopping channel service', { error: err })
          reject(err)
        } else {
          getLogger().info('Channel service stopped')
          this.server = null
          resolve()
        }
      })
    })
  }

  /**
   * Get server status (HTTP server or stream clients active)
   */
  public isRunning(): boolean {
    const httpRunning = this.server !== null && this.server.listening
    const streamsActive = this.streamClients.size > 0
    return httpRunning || streamsActive
  }

  /**
   * Get stream connection status for a specific channel
   */
  public getStreamStatus(channelId: string): { connected: boolean; mode: string } {
    const channel = this.channels.get(channelId)
    if (!channel) return { connected: false, mode: 'unknown' }

    if (channel.platform === 'dingtalk' && channel.connectionMode === 'stream') {
      const client = this.streamClients.get(channelId)
      return { connected: client?.isConnected() || false, mode: 'stream' }
    }

    return { connected: this.server !== null && this.server.listening, mode: 'webhook' }
  }

  /**
   * Get webhook URL for a channel
   */
  public getWebhookUrl(channel: ChannelConfig): string {
    const protocol = process.env.NODE_ENV === 'production' ? 'https' : 'http'
    const host = process.env.WEBHOOK_HOST || 'localhost'
    const port = process.env.WEBHOOK_PORT || this.port
    return `${protocol}://${host}:${port}/webhook/${channel.platform}/${channel.id}`
  }

  /**
   * Send a message via the appropriate platform API
   */
  public async sendMessage(channelId: string, chatId: string, content: string): Promise<{ success: boolean; error?: string }> {
    const channel = this.channels.get(channelId)
    if (!channel) return { success: false, error: 'Channel not found or not registered' }

    // For DingTalk stream mode, prefer session webhook for replies
    if (channel.platform === 'dingtalk' && channel.connectionMode === 'stream') {
      const sessionKey = `${channelId}:${chatId}`
      const session = this.sessionWebhooks.get(sessionKey)
      if (session && session.expiresAt > Date.now()) {
        return replyViaDingTalkSessionWebhook(session.url, content)
      }
      // Fallback to normal API if session webhook expired
    }

    return sendMessageForPlatform(channel, chatId, content)
  }

  /**
   * Enqueue message with retry and rate-limiting
   */
  public enqueueMessage(channelId: string, chatId: string, content: string): string {
    const channel = this.channels.get(channelId)
    if (!channel) throw new Error('Channel not found')
    return messageQueue.enqueue(channel, chatId, content)
  }

  /**
   * Get access token for a channel
   */
  public async getAccessToken(channelId: string): Promise<{ token: string; expiresAt: number } | null> {
    const channel = this.channels.get(channelId)
    if (!channel) return null
    try {
      let token: string
      let expiresAt: number
      switch (channel.platform) {
        case 'feishu':
          if (!channel.appId || !channel.appSecret) return null
          token = await getFeishuAccessToken(channel.appId, channel.appSecret)
          break
        case 'dingtalk':
          if (!channel.appId || !channel.appSecret) return null
          token = await getDingTalkAccessToken(channel.appId, channel.appSecret)
          break
        case 'wechat':
        case 'wechat_official':
        case 'wechat_miniprogram':
          if (!channel.appId || !channel.appSecret) return null
          token = await getWeChatAccessToken(channel.appId, channel.appSecret)
          break
        case 'slack':
          // Slack uses a static bot token
          if (!channel.slackBotToken) return null
          return { token: channel.slackBotToken, expiresAt: Date.now() + STATIC_TOKEN_EXPIRY_MS }
        case 'telegram':
          // Telegram uses a static bot token
          if (!channel.telegramBotToken) return null
          return { token: channel.telegramBotToken, expiresAt: Date.now() + STATIC_TOKEN_EXPIRY_MS }
        case 'discord':
          // Discord uses a static bot token
          if (!channel.discordBotToken) return null
          return { token: channel.discordBotToken, expiresAt: Date.now() + STATIC_TOKEN_EXPIRY_MS }
        case 'teams':
          if (!channel.teamsAppId || !channel.teamsAppPassword) return null
          token = await getTeamsAccessToken(channel.teamsAppId, channel.teamsAppPassword)
          break
        case 'custom':
          // Custom channels don't use access tokens (auth is handled via customAuthHeader)
          return null
        default:
          return null
      }
      const cached = tokenCache.get(`${channel.platform}:${channel.appId}`)
      expiresAt = cached?.expiresAt || Date.now() + 7200000
      return { token, expiresAt }
    } catch {
      return null
    }
  }

  /**
   * Periodically clean up expired dedup entries
   */
  private startDedupCleanup() {
    this.stopDedupCleanup()
    this.dedupCleanupInterval = setInterval(() => {
      const cutoff = Date.now() - this.dedupTTL
      for (const [id, ts] of this.processedMessageIds) {
        if (ts < cutoff) this.processedMessageIds.delete(id)
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
   * Health check for a specific channel
   */
  public async healthCheck(channelId: string): Promise<{ isHealthy: boolean; latencyMs: number; error?: string }> {
    const channel = this.channels.get(channelId)
    if (!channel) return { isHealthy: false, latencyMs: 0, error: 'Channel not found' }

    const start = Date.now()
    try {
      // Try to get access token as a health indicator
      if (channel.appId && channel.appSecret) {
        await this.getAccessToken(channelId)
      }
      return { isHealthy: true, latencyMs: Date.now() - start }
    } catch (err) {
      return { isHealthy: false, latencyMs: Date.now() - start, error: err instanceof Error ? err.message : String(err) }
    }
  }

  /**
   * Sync DingTalk stream clients based on registered channels
   */
  private async syncStreamClients() {
    const activeStreamChannelIds = new Set<string>()

    for (const [id, channel] of this.channels) {
      if (channel.platform === 'dingtalk' && channel.connectionMode === 'stream' && channel.enabled) {
        activeStreamChannelIds.add(id)

        if (!this.streamClients.has(id)) {
          // Create and connect a new stream client
          const client = new DingTalkStreamClient(channel)
          client.onMessage(async (ch, msg, sessionWebhook) => {
            // Store session webhook for replies
            if (sessionWebhook && msg.chatId) {
              this.sessionWebhooks.set(`${ch.id}:${msg.chatId}`, {
                url: sessionWebhook,
                // DingTalk session webhooks expire after ~2 hours
                expiresAt: Date.now() + 2 * 60 * 60 * 1000,
              })
            }

            await this.emitMessage(ch, msg, { sessionWebhook })
          })

          this.streamClients.set(id, client)

          // Connect asynchronously
          client.connect().catch((err) => {
            getLogger().error('DingTalk stream connect failed', {
              channelId: id,
              error: err instanceof Error ? err.message : String(err),
            })
          })
        } else {
          // Update existing client with latest channel config
          const existingClient = this.streamClients.get(id)
          if (existingClient) {
            existingClient.updateChannel(channel)
          }
        }
      }
    }

    // Disconnect stream clients for channels that are no longer stream-mode or removed
    for (const [id, client] of this.streamClients) {
      if (!activeStreamChannelIds.has(id)) {
        await client.disconnect()
        this.streamClients.delete(id)
        getLogger().info('DingTalk stream client removed', { channelId: id })
      }
    }
  }

  /**
   * Simulate an incoming message for debug/mock testing
   */
  public async simulateIncomingMessage(channelId: string, content: string): Promise<void> {
    const channel = this.channels.get(channelId)
    if (!channel) throw new Error('Channel not found')

    const mockMessage: ChannelMessage = {
      id: `mock-${Date.now()}`,
      channelId: channel.id,
      platform: channel.platform,
      senderId: 'debug-user',
      senderName: 'Debug User',
      content,
      timestamp: Date.now(),
      messageType: 'text',
      chatId: 'debug-chat',
      chatType: 'private',
    }

    await this.emitMessage(channel, mockMessage, { debug: true })
  }
}

// Singleton instance
let channelServiceInstance: ChannelService | null = null

export function getChannelService(port?: number): ChannelService {
  if (!channelServiceInstance) {
    channelServiceInstance = new ChannelService(port)
  }
  return channelServiceInstance
}
