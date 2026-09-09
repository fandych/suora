import crypto from "node:crypto"

import type { ChannelConfigRecord } from "@/data/domain/models"
export * from "@electron/others/channels/wechat-personal-types"
export * from "@electron/others/channels/wechat-personal-client"
import type { RuntimeChannelMessage } from "@electron/others/channels/channel-runtime-types"
import { httpRequest } from "@electron/others/channels/channel-runtime-http"
import { WECHAT_PERSONAL_APP_ID, WECHAT_PERSONAL_CLIENT_VERSION } from "@electron/others/channels/wechat-personal-types"
export { buildWeChatSignature, parseWeChatWebhookPayload, weChatWebhookToChannelMessage } from "@electron/others/channels/channel-runtime-messages"
export type { WeChatWebhookPayload } from "@electron/others/channels/channel-runtime-messages"

export * from "@electron/others/channels/channel-runtime-http"
export * from "@electron/others/channels/channel-runtime-tokens"
export * from "@electron/others/channels/channel-runtime-email"
export * from "@electron/others/channels/channel-runtime-outbound"

export const WECHAT_XML_CONTENT_TYPES = ["text/xml", "application/xml", "application/*+xml"]
export const WECHAT_PERSONAL_LOGIN_TTL_MS = 5 * 60 * 1000
export const SLACK_REQUEST_MAX_AGE_SECONDS = 300

export type TokenCacheEntry = {
  token: string
  expiresAt: number
}

function buildWeChatPersonalHeaders(token?: string) {
  const randomUin = crypto.randomBytes(4).readUInt32BE(0)
  return {
    "Content-Type": "application/json",
    AuthorizationType: "ilink_bot_token",
    "iLink-App-Id": WECHAT_PERSONAL_APP_ID,
    "iLink-App-ClientVersion": WECHAT_PERSONAL_CLIENT_VERSION,
    "X-WECHAT-UIN": Buffer.from(String(randomUin)).toString("base64"),
    ...(token?.trim() ? { Authorization: `Bearer ${token.trim()}` } : {}),
  }
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
  const response = await httpRequest(url.toString(), {
    method: "POST",
    headers: buildWeChatPersonalHeaders(options.token),
    body: JSON.stringify(body),
    timeoutMs,
    signal: options.signal,
  })
  if (response.status < 200 || response.status >= 300) throw new Error(`HTTP ${response.status}: ${response.text}`)
  return response.data as T
}

export async function getWeChatPersonalJson<T>(
  baseUrl: string,
  endpoint: string,
  options: { token?: string; timeoutMs?: number } = {},
) {
  const url = new URL(endpoint, baseUrl.endsWith("/") ? baseUrl : `${baseUrl}/`)
  const timeoutMs = options.timeoutMs ?? WECHAT_PERSONAL_API_TIMEOUT_MS
  const response = await httpRequest(url.toString(), {
    method: "GET",
    headers: buildWeChatPersonalHeaders(options.token),
    timeoutMs,
  })
  if (response.status < 200 || response.status >= 300) throw new Error(`HTTP ${response.status}: ${response.text}`)
  return response.data as T
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

export function getWeChatVerificationToken(channel: ChannelConfigRecord) {
  if (channel.platform === "wechat_official") return channel.wechatOfficialToken || channel.verificationToken
  if (channel.platform === "wechat_miniprogram") return channel.wechatMiniProgramToken || channel.verificationToken
  return channel.wechatToken || channel.verificationToken
}

export async function fetchWeChatPersonalQrCode(localTokenList: string[]) {
  return postWeChatPersonalJson<WeChatPersonalQrCodeResponse>(WECHAT_PERSONAL_DEFAULT_BASE_URL, "ilink/bot/get_bot_qrcode", { local_token_list: localTokenList }, {
    query: { bot_type: WECHAT_PERSONAL_QR_BOT_TYPE },
    timeoutMs: WECHAT_PERSONAL_API_TIMEOUT_MS,
  })
}

export async function pollWeChatPersonalQrStatus(baseUrl: string, qrcode: string, verifyCode?: string) {
  let endpoint = `ilink/bot/get_qrcode_status?qrcode=${encodeURIComponent(qrcode)}`
  if (verifyCode?.trim()) {
    endpoint += `&verify_code=${encodeURIComponent(verifyCode.trim())}`
  }

  try {
    const response = await getWeChatPersonalJson<WeChatPersonalQrStatusResponse>(baseUrl, endpoint, {
      timeoutMs: WECHAT_PERSONAL_LONG_POLL_TIMEOUT_MS,
    })
    if (!response.status) {
      return {
        ...response,
        status: "wait",
        diagnosticEvent: "invalid_response",
        diagnosticMessage: "QR status response did not include a status field.",
        diagnosticBaseUrl: baseUrl,
        diagnosticEndpoint: endpoint,
      } satisfies WeChatPersonalQrStatusResponse
    }

    return {
      ...response,
      diagnosticEvent: "response",
      diagnosticMessage: `Upstream QR status: ${response.status}`,
      diagnosticBaseUrl: baseUrl,
      diagnosticEndpoint: endpoint,
    } satisfies WeChatPersonalQrStatusResponse
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      return {
        status: "wait",
        diagnosticEvent: "timeout",
        diagnosticMessage: `QR status long poll timed out after ${WECHAT_PERSONAL_LONG_POLL_TIMEOUT_MS}ms.`,
        diagnosticBaseUrl: baseUrl,
        diagnosticEndpoint: endpoint,
      } satisfies WeChatPersonalQrStatusResponse
    }

    return {
      status: "wait",
      diagnosticEvent: "error",
      diagnosticMessage: error instanceof Error ? error.message : String(error),
      diagnosticBaseUrl: baseUrl,
      diagnosticEndpoint: endpoint,
    } satisfies WeChatPersonalQrStatusResponse
  }
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

