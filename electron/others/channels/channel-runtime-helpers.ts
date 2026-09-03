import crypto from "node:crypto"

import type { ChannelConfigRecord } from "@/data/domain/models"
import type { RuntimeChannelMessage } from "@electron/others/channels/channel-runtime-types"

export * from "@electron/others/channels/channel-runtime-http"
export * from "@electron/others/channels/channel-runtime-tokens"
export * from "@electron/others/channels/channel-runtime-email"

export const WECHAT_XML_CONTENT_TYPES = ["text/xml", "application/xml", "application/*+xml"]
export const WECHAT_PERSONAL_DEFAULT_BASE_URL = "https://ilinkai.weixin.qq.com"
export const WECHAT_PERSONAL_QR_BOT_TYPE = "3"
export const WECHAT_PERSONAL_LOGIN_TTL_MS = 5 * 60 * 1000
export const WECHAT_PERSONAL_LONG_POLL_TIMEOUT_MS = 35_000
export const WECHAT_PERSONAL_API_TIMEOUT_MS = 15_000
export const SLACK_REQUEST_MAX_AGE_SECONDS = 300

export type TokenCacheEntry = {
  token: string
  expiresAt: number
}

export type WeChatPersonalQrStatus =
  | "wait"
  | "scaned"
  | "confirmed"
  | "expired"
  | "scaned_but_redirect"
  | "need_verifycode"
  | "verify_code_blocked"
  | "binded_redirect"

export type WeChatPersonalLoginSession = {
  sessionKey: string
  qrcode: string
  qrcodeUrl: string
  startedAt: number
  currentApiBaseUrl: string
  pendingVerifyCode?: string
}

export type WeChatPersonalQrCodeResponse = {
  qrcode?: string
  qrcode_img_content?: string
}

export type WeChatPersonalQrStatusResponse = {
  status?: WeChatPersonalQrStatus
  bot_token?: string
  ilink_bot_id?: string
  baseurl?: string
  ilink_user_id?: string
  redirect_host?: string
}

export type WeChatPersonalLoginWaitResult = {
  success: boolean
  status: "connected" | "already_bound" | "need_verifycode" | "verify_code_blocked" | "expired" | "timeout" | "error"
  message: string
  qrCodeUrl?: string
  sessionKey: string
  botToken?: string
  accountId?: string
  baseUrl?: string
  userId?: string
}

export type WeChatPersonalMessageItem = {
  type?: number
  text_item?: { text?: string }
  image_item?: unknown
  voice_item?: unknown
  file_item?: unknown
  video_item?: unknown
}

export type WeChatPersonalInboundMessage = {
  seq?: number
  message_id?: number | string
  from_user_id?: string
  to_user_id?: string
  create_time_ms?: number
  session_id?: string
  context_token?: string
  item_list?: WeChatPersonalMessageItem[]
}

export type WeChatPersonalUpdatesResponse = {
  ret?: number
  errcode?: number
  errmsg?: string
  msgs?: WeChatPersonalInboundMessage[]
  get_updates_buf?: string
  longpolling_timeout_ms?: number
}

export type WeChatWebhookPayload = {
  ToUserName: string
  FromUserName: string
  CreateTime: number
  MsgType?: "text" | "image" | "voice" | "video" | "location" | "link" | "event"
  Content?: string
  PicUrl?: string
  MediaId?: string
  Format?: string
  Recognition?: string
  ThumbMediaId?: string
  Location_X?: string
  Location_Y?: string
  Label?: string
  Title?: string
  Description?: string
  Url?: string
  Event?: string
  EventKey?: string
  MsgId?: string
  AgentID?: string
  Encrypt?: string
}

export function isFreshWeChatPersonalLogin(session: WeChatPersonalLoginSession) {
  return Date.now() - session.startedAt < WECHAT_PERSONAL_LOGIN_TTL_MS
}

export function normalizeWeChatPersonalQrCodeUrl(value?: string) {
  const trimmed = value?.trim()
  if (!trimmed) return undefined
  if (/^(?:data:|https?:\/\/|blob:|file:)/i.test(trimmed)) return trimmed
  return `data:image/png;base64,${trimmed}`
}

export function getWeChatPersonalBaseUrl(channel: ChannelConfigRecord) {
  return channel.wechatPersonalBaseUrl?.trim() || WECHAT_PERSONAL_DEFAULT_BASE_URL
}

export function isValidWeChatPersonalToken(token: string) {
  return token.length > 0 && token.length <= 4096 && !/[\r\n]/.test(token)
}

function buildWeChatPersonalHeaders(token?: string): Record<string, string> {
  const randomUin = crypto.randomBytes(4).readUInt32BE(0)
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    AuthorizationType: "ilink_bot_token",
    "X-WECHAT-UIN": Buffer.from(String(randomUin), "utf-8").toString("base64"),
  }
  if (token?.trim()) {
    headers.Authorization = `Bearer ${token.trim()}`
  }
  return headers
}

export async function postWeChatPersonalJson<T>(
  baseUrl: string,
  endpoint: string,
  body: Record<string, unknown>,
  options: { token?: string; timeoutMs?: number; query?: Record<string, string>; signal?: AbortSignal } = {},
) {
  const url = new URL(endpoint, baseUrl.endsWith("/") ? baseUrl : `${baseUrl}/`)
  for (const [key, value] of Object.entries(options.query || {})) {
    url.searchParams.set(key, value)
  }

  const timeoutMs = options.timeoutMs ?? WECHAT_PERSONAL_API_TIMEOUT_MS
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), timeoutMs)
  const abortListener = () => controller.abort()
  options.signal?.addEventListener("abort", abortListener, { once: true })

  try {
    const response = await fetch(url, {
      method: "POST",
      headers: buildWeChatPersonalHeaders(options.token),
      body: JSON.stringify(body),
      signal: controller.signal,
    })
    const text = await response.text()
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${text}`)
    }
    return JSON.parse(text) as T
  } finally {
    clearTimeout(timeout)
    options.signal?.removeEventListener("abort", abortListener)
  }
}

export function buildWeChatPersonalClientId() {
  return `suora-wechat-${crypto.randomUUID()}`
}

function extractWeChatPersonalMessageContent(items: WeChatPersonalMessageItem[] | undefined): { content: string; messageType: RuntimeChannelMessage["messageType"] } | null {
  if (!items || items.length === 0) return null
  for (const item of items) {
    switch (item.type) {
      case 1:
        return { content: item.text_item?.text || "", messageType: "text" }
      case 2:
        return { content: "[Image]", messageType: "image" }
      case 3:
        return { content: "[Voice]", messageType: "voice" }
      case 4:
      case 5:
        return { content: "[File]", messageType: "file" }
      default:
        break
    }
  }
  return null
}

export function weChatPersonalMessageToChannelMessage(message: WeChatPersonalInboundMessage, channelId: string): RuntimeChannelMessage | null {
  const parsed = extractWeChatPersonalMessageContent(message.item_list)
  if (!parsed || !message.from_user_id) return null
  const timestamp = typeof message.create_time_ms === "number" && Number.isFinite(message.create_time_ms) ? message.create_time_ms : Date.now()
  return {
    id: String(message.message_id || `${message.from_user_id}:${timestamp}`),
    channelId,
    platform: "wechat_personal",
    senderId: message.from_user_id,
    senderName: message.from_user_id,
    content: parsed.content,
    timestamp,
    messageType: parsed.messageType,
    chatId: message.from_user_id,
    chatType: "private",
  }
}

function getWeChatXmlTag(xml: string, tag: string): string | undefined {
  const escapedTag = tag.replace(/[-.*+?^${}()|[\]\\]/g, "\\$&")
  const cdataMatch = xml.match(new RegExp(`<${escapedTag}><!\\[CDATA\\[([\\s\\S]*?)\\]\\]></${escapedTag}>`))
  if (cdataMatch) return cdataMatch[1]
  const plainMatch = xml.match(new RegExp(`<${escapedTag}>([^<]*)</${escapedTag}>`))
  return plainMatch ? plainMatch[1] : undefined
}

function getWeChatStringValue(value: unknown) {
  return typeof value === "string" && value.length > 0 ? value : undefined
}

function getWeChatNumberValue(value: unknown) {
  const num = typeof value === "number" ? value : Number.parseInt(String(value ?? "0"), 10)
  return Number.isFinite(num) ? num : 0
}

export function parseWeChatWebhookPayload(body: unknown): WeChatWebhookPayload | null {
  if (typeof body === "string") {
    const xml = body.trim()
    if (!xml.startsWith("<xml>") || !xml.endsWith("</xml>")) return null
    const msgType = getWeChatXmlTag(xml, "MsgType")?.trim() as WeChatWebhookPayload["MsgType"] | undefined
    return {
      ToUserName: getWeChatXmlTag(xml, "ToUserName") || "",
      FromUserName: getWeChatXmlTag(xml, "FromUserName") || "",
      CreateTime: getWeChatNumberValue(getWeChatXmlTag(xml, "CreateTime")),
      MsgType: msgType,
      Content: getWeChatXmlTag(xml, "Content"),
      PicUrl: getWeChatXmlTag(xml, "PicUrl"),
      MediaId: getWeChatXmlTag(xml, "MediaId"),
      Format: getWeChatXmlTag(xml, "Format"),
      Recognition: getWeChatXmlTag(xml, "Recognition"),
      ThumbMediaId: getWeChatXmlTag(xml, "ThumbMediaId"),
      Location_X: getWeChatXmlTag(xml, "Location_X"),
      Location_Y: getWeChatXmlTag(xml, "Location_Y"),
      Label: getWeChatXmlTag(xml, "Label"),
      Title: getWeChatXmlTag(xml, "Title"),
      Description: getWeChatXmlTag(xml, "Description"),
      Url: getWeChatXmlTag(xml, "Url"),
      Event: getWeChatXmlTag(xml, "Event"),
      EventKey: getWeChatXmlTag(xml, "EventKey"),
      MsgId: getWeChatXmlTag(xml, "MsgId"),
      AgentID: getWeChatXmlTag(xml, "AgentID"),
      Encrypt: getWeChatXmlTag(xml, "Encrypt"),
    }
  }

  if (!body || typeof body !== "object") return null
  const record = body as Record<string, unknown>
  const msgType = getWeChatStringValue(record.MsgType)?.trim() as WeChatWebhookPayload["MsgType"] | undefined
  return {
    ToUserName: getWeChatStringValue(record.ToUserName) || "",
    FromUserName: getWeChatStringValue(record.FromUserName) || "",
    CreateTime: getWeChatNumberValue(record.CreateTime),
    MsgType: msgType,
    Content: getWeChatStringValue(record.Content),
    PicUrl: getWeChatStringValue(record.PicUrl),
    MediaId: getWeChatStringValue(record.MediaId),
    Format: getWeChatStringValue(record.Format),
    Recognition: getWeChatStringValue(record.Recognition),
    ThumbMediaId: getWeChatStringValue(record.ThumbMediaId),
    Location_X: getWeChatStringValue(record.Location_X),
    Location_Y: getWeChatStringValue(record.Location_Y),
    Label: getWeChatStringValue(record.Label),
    Title: getWeChatStringValue(record.Title),
    Description: getWeChatStringValue(record.Description),
    Url: getWeChatStringValue(record.Url),
    Event: getWeChatStringValue(record.Event),
    EventKey: getWeChatStringValue(record.EventKey),
    MsgId: getWeChatStringValue(record.MsgId),
    AgentID: getWeChatStringValue(record.AgentID),
    Encrypt: getWeChatStringValue(record.Encrypt),
  }
}

export function buildWeChatSignature(token: string, timestamp: string, nonce: string, encrypted?: string) {
  const parts = encrypted ? [token, timestamp, nonce, encrypted] : [token, timestamp, nonce]
  return crypto.createHash("sha1").update(parts.sort().join("")).digest("hex")
}

export function weChatWebhookToChannelMessage(payload: WeChatWebhookPayload, channelId: string, platform: ChannelConfigRecord["platform"]): RuntimeChannelMessage {
  let content = ""
  let messageType: RuntimeChannelMessage["messageType"] = "text"
  switch (payload.MsgType) {
    case "image":
      content = payload.PicUrl || payload.MediaId || "[Image]"
      messageType = "image"
      break
    case "voice":
      content = payload.Recognition || payload.MediaId || "[Voice]"
      messageType = "voice"
      break
    case "video":
      content = payload.ThumbMediaId || payload.MediaId || "[Video]"
      messageType = "file"
      break
    case "location":
      content = `[Location] ${payload.Label || "Location"}`
      if (payload.Location_X || payload.Location_Y) content += ` (${payload.Location_X || ""}, ${payload.Location_Y || ""})`
      break
    case "link":
      content = `[Link] ${payload.Title || "Link"}`
      if (payload.Url) content += `: ${payload.Url}`
      if (payload.Description) content += `\n${payload.Description}`
      break
    case "event":
      content = `[Event: ${payload.Event || "unknown"}${payload.EventKey ? ` - ${payload.EventKey}` : ""}]`
      break
    case "text":
    default:
      content = payload.Content || ""
      break
  }
  const fallbackIdParts = [platform, payload.FromUserName || "unknown", payload.CreateTime || Date.now(), payload.Event || payload.MsgType || "message"]
  return {
    id: payload.MsgId || fallbackIdParts.join(":"),
    channelId,
    platform,
    senderId: payload.FromUserName,
    senderName: payload.FromUserName,
    content,
    timestamp: (payload.CreateTime || Math.floor(Date.now() / 1000)) * 1000,
    messageType,
    chatId: payload.FromUserName,
    chatType: "private",
  }
}

export function getWeChatVerificationToken(channel: ChannelConfigRecord) {
  if (channel.platform === "wechat_official") return channel.wechatOfficialToken || channel.verificationToken
  return channel.wechatToken || channel.verificationToken
}

export async function fetchWeChatPersonalQrCode(localTokenList: string[]) {
  return postWeChatPersonalJson<WeChatPersonalQrCodeResponse>(WECHAT_PERSONAL_DEFAULT_BASE_URL, "ilink/bot/get_bot_qrcode", { local_token_list: localTokenList }, {
    query: { bot_type: WECHAT_PERSONAL_QR_BOT_TYPE },
    timeoutMs: WECHAT_PERSONAL_API_TIMEOUT_MS,
  })
}

export async function pollWeChatPersonalQrStatus(baseUrl: string, qrcode: string, verifyCode?: string) {
  return postWeChatPersonalJson<WeChatPersonalQrStatusResponse>(baseUrl, "ilink/bot/get_qrcode_status", {}, {
    query: {
      qrcode,
      ...(verifyCode ? { verify_code: verifyCode } : {}),
    },
    timeoutMs: WECHAT_PERSONAL_LONG_POLL_TIMEOUT_MS,
  })
}

export async function fetchWeChatPersonalUpdates(channel: ChannelConfigRecord, cursor: string, signal?: AbortSignal) {
  return postWeChatPersonalJson<WeChatPersonalUpdatesResponse>(getWeChatPersonalBaseUrl(channel), "ilink/bot/getupdates", {
    get_updates_buf: cursor,
    base_info: {
      channel_version: "suora",
      bot_agent: "Suora",
    },
  }, {
    token: channel.wechatPersonalBotToken,
    timeoutMs: WECHAT_PERSONAL_LONG_POLL_TIMEOUT_MS,
    signal,
  })
}

export async function sendWeChatPersonalNativeMessage(channel: ChannelConfigRecord, chatId: string, content: string, contextToken?: string) {
  if (!channel.wechatPersonalBotToken) {
    return { success: false, error: "Missing personal WeChat bot token" }
  }

  try {
    await postWeChatPersonalJson(getWeChatPersonalBaseUrl(channel), "ilink/bot/sendmessage", {
      msg: {
        from_user_id: "",
        to_user_id: chatId,
        client_id: buildWeChatPersonalClientId(),
        message_type: 2,
        message_state: 2,
        item_list: [{ type: 1, text_item: { text: content } }],
        ...(contextToken ? { context_token: contextToken } : {}),
      },
    }, {
      token: channel.wechatPersonalBotToken,
      timeoutMs: WECHAT_PERSONAL_API_TIMEOUT_MS,
    })
    return { success: true }
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : String(error) }
  }
}

export async function sendTelegramMessage(channel: ChannelConfigRecord, chatId: string, content: string) {
  if (!channel.telegramBotToken) return { success: false, error: "Missing Telegram bot token" }

  try {
    const response = await httpRequest(`https://api.telegram.org/bot${channel.telegramBotToken}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json; charset=utf-8" },
      body: JSON.stringify({ chat_id: chatId, text: content }),
    })
    const data = response.data as { ok?: boolean; description?: string }
    return data.ok ? { success: true } : { success: false, error: data.description || "Send failed" }
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : String(error) }
  }
}

export async function sendCustomMessage(channel: ChannelConfigRecord, chatId: string, content: string) {
  const endpoint = channel.connectionMode === "stream" ? channel.customWebsocketUrl : channel.customWebhookUrl
  if (!endpoint) {
    return { success: false, error: channel.connectionMode === "stream" ? "Missing custom WebSocket URL" : "Missing custom webhook URL" }
  }

  if (channel.connectionMode === "stream") {
    try {
      const socket = new WebSocket(endpoint, channel.customWebsocketProtocol ? [channel.customWebsocketProtocol] : undefined)
      const payloadTemplate = channel.customPayloadTemplate?.trim() || '{"chatId":"{{chatId}}","content":"{{content}}"}'
      const payload = payloadTemplate
        .replace(/\{\{content\}\}/g, () => JSON.stringify(content).slice(1, -1))
        .replace(/\{\{chatId\}\}/g, () => JSON.stringify(chatId).slice(1, -1))
      await new Promise<void>((resolve, reject) => {
        const timeout = setTimeout(() => {
          socket.close()
          reject(new Error("Custom WebSocket send timeout"))
        }, 15_000)
        socket.addEventListener("open", () => {
          socket.send(payload)
          clearTimeout(timeout)
          socket.close()
          resolve()
        }, { once: true })
        socket.addEventListener("error", () => {
          clearTimeout(timeout)
          reject(new Error("Custom WebSocket send failed"))
        }, { once: true })
      })
      return { success: true }
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : String(error) }
    }
  }

  try {
    const template = channel.customPayloadTemplate || '{"chat_id":"{{chatId}}","text":"{{content}}"}'
    const body = template
      .replace(/\{\{content\}\}/g, () => JSON.stringify(content).slice(1, -1))
      .replace(/\{\{chatId\}\}/g, () => JSON.stringify(chatId).slice(1, -1))
    const headers: Record<string, string> = { "Content-Type": "application/json; charset=utf-8" }
    if (channel.customAuthHeader && channel.customAuthValue) {
      headers[channel.customAuthHeader] = channel.customAuthValue
    }
    const response = await httpRequest(endpoint, { method: "POST", headers, body })
    if (response.status >= 400) {
      const data = response.data as { message?: string; error?: string }
      return { success: false, error: data.message || data.error || `HTTP ${response.status}` }
    }
    return { success: true }
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : String(error) }
  }
}
