import os from "node:os"
import path from "node:path"
import { promises as fs } from "node:fs"

import type { ChannelConfigRecord } from "@/data/domain/models"
import {
  fetchWeChatPersonalQrCode,
  fetchWeChatPersonalUpdates,
  getWeChatPersonalBaseUrl,
  isFreshWeChatPersonalLogin,
  isValidWeChatPersonalToken,
  normalizeWeChatPersonalQrCodeUrl,
  pollWeChatPersonalQrStatus,
  type WeChatPersonalInboundMessage,
  type WeChatPersonalLoginSession,
  type WeChatPersonalLoginWaitResult,
} from "@electron/others/channels/channel-runtime-helpers"
import { appendDebugLog } from "@electron/others/channels/channel-runtime-persistence"
import type { RuntimeChannelMessage } from "@electron/others/channels/channel-runtime-types"

function summarizeToken(token?: string) {
  if (!token) return "none"
  return `${token.slice(0, 6)}...(${token.length})`
}

function logWeChatPersonalSession(channelId: string | undefined, tone: "info" | "success" | "error", text: string) {
  if (!channelId) {
    return
  }
  appendDebugLog(channelId, tone, text)
}

export function listWeChatPersonalLocalTokens(channels: Iterable<ChannelConfigRecord>) {
  return [...channels]
    .map((channel) => channel.wechatPersonalBotToken?.trim())
    .filter((token): token is string => Boolean(token && isValidWeChatPersonalToken(token)))
    .slice(-10)
}

export async function startWeChatPersonalLogin(
  sessions: Map<string, WeChatPersonalLoginSession>,
  channels: Iterable<ChannelConfigRecord>,
  channelId: string | undefined,
  force = false,
) {
  purgeExpiredWeChatPersonalLogins(sessions)
  const existing = [...sessions.values()].find((session) => isFreshWeChatPersonalLogin(session))
  if (!force && existing) {
    logWeChatPersonalSession(channelId, "info", `QR login reused existing session. sessionKey=${existing.sessionKey} startedAt=${existing.startedAt} baseUrl=${existing.currentApiBaseUrl}`)
    return {
      success: true,
      qrCodeUrl: existing.qrcodeUrl,
      sessionKey: existing.sessionKey,
      message: "二维码已生成，请继续扫码绑定。",
    }
  }

  try {
    const localTokens = listWeChatPersonalLocalTokens(channels)
    logWeChatPersonalSession(channelId, "info", `Starting WeChat QR login. force=${String(force)} localTokenCount=${localTokens.length} localTokens=${localTokens.map((token) => summarizeToken(token)).join(", ") || "none"}`)
    const qr = await fetchWeChatPersonalQrCode(localTokens)
    const qrCodeUrl = normalizeWeChatPersonalQrCodeUrl(qr.qrcode_img_content)
    if (!qr.qrcode || !qrCodeUrl) {
      logWeChatPersonalSession(channelId, "error", `QR generation returned incomplete payload. hasQrcode=${String(Boolean(qr.qrcode))} hasImage=${String(Boolean(qr.qrcode_img_content))}`)
      return { success: false, message: "未能获取微信登录二维码。" }
    }

    const sessionKey = crypto.randomUUID()
    sessions.set(sessionKey, {
      sessionKey,
      qrcode: qr.qrcode,
      qrcodeUrl: qrCodeUrl,
      startedAt: Date.now(),
      currentApiBaseUrl: getWeChatPersonalBaseUrl({ id: "", title: "", platform: "wechat_personal", enabled: false, status: "inactive", connectionMode: "stream", webhookPath: "", webhookSecret: "", autoReply: false, replyAgentId: "", createdAt: 0, updatedAt: 0, messageCount: 0, emailFilters: [], emailActions: [], emailMarkAsRead: true }),
    })
    logWeChatPersonalSession(channelId, "info", `QR session created. sessionKey=${sessionKey} qrcodeLength=${qr.qrcode.length} qrcodeUrlKind=${qrCodeUrl.startsWith("data:") ? "data-url" : "remote-url"} baseUrl=${sessions.get(sessionKey)?.currentApiBaseUrl || "unknown"}`)

    return {
      success: true,
      qrCodeUrl,
      sessionKey,
      message: "请使用手机微信扫码完成绑定。",
    }
  } catch (error) {
    logWeChatPersonalSession(channelId, "error", `Failed to start WeChat QR login: ${error instanceof Error ? error.message : String(error)}`)
    return { success: false, message: error instanceof Error ? error.message : String(error) }
  }
}

export async function waitForWeChatPersonalLogin(
  sessions: Map<string, WeChatPersonalLoginSession>,
  channels: Iterable<ChannelConfigRecord>,
  channelId: string | undefined,
  sessionKey: string,
  verifyCode?: string,
  timeoutMs = 35_000,
): Promise<WeChatPersonalLoginWaitResult> {
  purgeExpiredWeChatPersonalLogins(sessions)
  const session = sessions.get(sessionKey)
  if (!session) {
    logWeChatPersonalSession(channelId, "error", `QR login wait requested without active session. sessionKey=${sessionKey}`)
    return { success: false, status: "error", sessionKey, message: "当前没有进行中的微信绑定会话。" }
  }
  if (!isFreshWeChatPersonalLogin(session)) {
    sessions.delete(sessionKey)
    logWeChatPersonalSession(channelId, "error", `QR login session expired before polling. sessionKey=${sessionKey} startedAt=${session.startedAt}`)
    return { success: false, status: "expired", sessionKey, message: "二维码已过期，请重新生成。" }
  }
  if (verifyCode?.trim()) {
    session.pendingVerifyCode = verifyCode.trim()
    logWeChatPersonalSession(channelId, "info", `Verification code submitted for QR login. sessionKey=${sessionKey} codeLength=${verifyCode.trim().length}`)
  }

  const deadline = Date.now() + Math.max(timeoutMs, 1000)
  logWeChatPersonalSession(channelId, "info", `Begin polling WeChat QR login. sessionKey=${sessionKey} timeoutMs=${timeoutMs} baseUrl=${session.currentApiBaseUrl} hasPendingVerifyCode=${String(Boolean(session.pendingVerifyCode))}`)
  while (Date.now() < deadline) {
    try {
      const status = await pollWeChatPersonalQrStatus(session.currentApiBaseUrl, session.qrcode, session.pendingVerifyCode)
      logWeChatPersonalSession(channelId, status.diagnosticEvent === "error" || status.diagnosticEvent === "invalid_response" ? "error" : "info", `QR poll result. sessionKey=${sessionKey} upstreamStatus=${status.status || "missing"} event=${status.diagnosticEvent || "unknown"} baseUrl=${status.diagnosticBaseUrl || session.currentApiBaseUrl} endpoint=${status.diagnosticEndpoint || "unknown"} message=${status.diagnosticMessage || "none"} redirectHost=${status.redirect_host || "none"} hasBotToken=${String(Boolean(status.bot_token))} hasBotId=${String(Boolean(status.ilink_bot_id))} hasUserId=${String(Boolean(status.ilink_user_id))}`)
      switch (status.status) {
        case "wait":
          await new Promise((resolve) => setTimeout(resolve, 1000))
          break
        case "scaned":
          return { success: true, status: "scaned", sessionKey, qrCodeUrl: session.qrcodeUrl, message: "已扫码，请在手机上确认登录。", upstreamStatus: status.status, diagnosticEvent: status.diagnosticEvent, diagnosticMessage: status.diagnosticMessage, pollBaseUrl: status.diagnosticBaseUrl, pollEndpoint: status.diagnosticEndpoint }
        case "scaned_but_redirect":
          if (status.redirect_host) {
            session.currentApiBaseUrl = `https://${status.redirect_host}`
            logWeChatPersonalSession(channelId, "info", `QR poll redirected to new host. sessionKey=${sessionKey} redirectHost=${status.redirect_host} nextBaseUrl=${session.currentApiBaseUrl}`)
          }
          return { success: true, status: "scaned", sessionKey, qrCodeUrl: session.qrcodeUrl, message: "已扫码，正在等待微信确认登录。", upstreamStatus: status.status, diagnosticEvent: status.diagnosticEvent, diagnosticMessage: status.diagnosticMessage, pollBaseUrl: status.diagnosticBaseUrl, pollEndpoint: status.diagnosticEndpoint }
        case "need_verifycode":
          return { success: true, status: "need_verifycode", sessionKey, qrCodeUrl: session.qrcodeUrl, message: "请输入手机微信上显示的数字验证码。", upstreamStatus: status.status, diagnosticEvent: status.diagnosticEvent, diagnosticMessage: status.diagnosticMessage, pollBaseUrl: status.diagnosticBaseUrl, pollEndpoint: status.diagnosticEndpoint }
        case "verify_code_blocked":
          session.pendingVerifyCode = undefined
          logWeChatPersonalSession(channelId, "error", `QR login verification blocked. sessionKey=${sessionKey}`)
          return { success: false, status: "verify_code_blocked", sessionKey, qrCodeUrl: session.qrcodeUrl, message: "验证码输入错误次数过多，请重新生成二维码。", upstreamStatus: status.status, diagnosticEvent: status.diagnosticEvent, diagnosticMessage: status.diagnosticMessage, pollBaseUrl: status.diagnosticBaseUrl, pollEndpoint: status.diagnosticEndpoint }
        case "expired": {
          const qr = await fetchWeChatPersonalQrCode(listWeChatPersonalLocalTokens(channels))
          const qrCodeUrl = normalizeWeChatPersonalQrCodeUrl(qr.qrcode_img_content)
          if (qr.qrcode && qrCodeUrl) {
            session.qrcode = qr.qrcode
            session.qrcodeUrl = qrCodeUrl
            session.startedAt = Date.now()
            session.currentApiBaseUrl = getWeChatPersonalBaseUrl({ id: "", title: "", platform: "wechat_personal", enabled: false, status: "inactive", connectionMode: "stream", webhookPath: "", webhookSecret: "", autoReply: false, replyAgentId: "", createdAt: 0, updatedAt: 0, messageCount: 0, emailFilters: [], emailActions: [], emailMarkAsRead: true })
            session.pendingVerifyCode = undefined
            logWeChatPersonalSession(channelId, "info", `QR login expired and refreshed. sessionKey=${sessionKey} newBaseUrl=${session.currentApiBaseUrl}`)
            return { success: true, status: "expired", sessionKey, qrCodeUrl, message: "二维码已刷新，请重新扫码。", upstreamStatus: status.status, diagnosticEvent: status.diagnosticEvent, diagnosticMessage: status.diagnosticMessage, pollBaseUrl: status.diagnosticBaseUrl, pollEndpoint: status.diagnosticEndpoint }
          }
          logWeChatPersonalSession(channelId, "error", `QR login expired and refresh failed. sessionKey=${sessionKey} hasQrcode=${String(Boolean(qr.qrcode))} hasImage=${String(Boolean(qr.qrcode_img_content))}`)
          return { success: false, status: "expired", sessionKey, message: "二维码已过期，请重新生成。", upstreamStatus: status.status, diagnosticEvent: status.diagnosticEvent, diagnosticMessage: status.diagnosticMessage, pollBaseUrl: status.diagnosticBaseUrl, pollEndpoint: status.diagnosticEndpoint }
        }
        case "binded_redirect":
          sessions.delete(sessionKey)
          logWeChatPersonalSession(channelId, "success", `QR login resolved as already bound. sessionKey=${sessionKey}`)
          return { success: true, status: "already_bound", sessionKey, qrCodeUrl: session.qrcodeUrl, message: "该微信已绑定，无需重复登录。", upstreamStatus: status.status, diagnosticEvent: status.diagnosticEvent, diagnosticMessage: status.diagnosticMessage, pollBaseUrl: status.diagnosticBaseUrl, pollEndpoint: status.diagnosticEndpoint }
        case "confirmed":
          sessions.delete(sessionKey)
          logWeChatPersonalSession(channelId, "success", `QR login confirmed. sessionKey=${sessionKey} accountId=${status.ilink_bot_id || "none"} userId=${status.ilink_user_id || "none"} baseUrl=${status.baseurl || session.currentApiBaseUrl}`)
          return {
            success: true,
            status: "connected",
            sessionKey,
            qrCodeUrl: session.qrcodeUrl,
            botToken: status.bot_token,
            accountId: status.ilink_bot_id,
            baseUrl: status.baseurl || session.currentApiBaseUrl,
            userId: status.ilink_user_id,
            message: "微信扫码绑定成功。",
            upstreamStatus: status.status,
            diagnosticEvent: status.diagnosticEvent,
            diagnosticMessage: status.diagnosticMessage,
            pollBaseUrl: status.diagnosticBaseUrl,
            pollEndpoint: status.diagnosticEndpoint,
          }
        default:
          logWeChatPersonalSession(channelId, "error", `QR poll returned unhandled status. sessionKey=${sessionKey} upstreamStatus=${status.status || "missing"}`)
          break
      }
    } catch (error) {
      logWeChatPersonalSession(channelId, "error", `QR login poll threw exception. sessionKey=${sessionKey} error=${error instanceof Error ? error.message : String(error)}`)
      return { success: false, status: "error", sessionKey, qrCodeUrl: session.qrcodeUrl, message: error instanceof Error ? error.message : String(error) }
    }
  }

  logWeChatPersonalSession(channelId, "info", `QR login wait timed out without terminal state. sessionKey=${sessionKey} baseUrl=${session.currentApiBaseUrl}`)
  return { success: true, status: "timeout", sessionKey, qrCodeUrl: session.qrcodeUrl, message: "正在等待扫码确认。", diagnosticEvent: "timeout", diagnosticMessage: `No terminal QR status received within ${timeoutMs}ms.`, pollBaseUrl: session.currentApiBaseUrl }
}

export async function pollWeChatPersonalChannel(
  channel: ChannelConfigRecord,
  currentCursor: string,
  contextTokens: Map<string, string>,
  signal?: AbortSignal,
) {
  const response = await fetchWeChatPersonalUpdates(channel, currentCursor, signal)
  const messages: RuntimeChannelMessage[] = []
  for (const item of response.msgs || []) {
    if (item.context_token && item.from_user_id) {
      contextTokens.set(`${channel.id}:${item.from_user_id}`, item.context_token)
    }
    const message = weChatPersonalItemToMessage(item, channel.id)
    if (message) {
      messages.push(message)
    }
  }

  return {
    nextCursor: response.get_updates_buf && response.get_updates_buf !== currentCursor ? response.get_updates_buf : currentCursor,
    timeoutMs: response.longpolling_timeout_ms && response.longpolling_timeout_ms > 0 ? response.longpolling_timeout_ms : 35_000,
    response,
    messages,
  }
}

export function purgeExpiredWeChatPersonalLogins(sessions: Map<string, WeChatPersonalLoginSession>) {
  for (const [sessionKey, session] of sessions) {
    if (!isFreshWeChatPersonalLogin(session)) {
      sessions.delete(sessionKey)
    }
  }
}

export async function readWeChatPersonalSyncCursor(channelId: string) {
  try {
    const file = path.join(await ensureWeChatPersonalStateDir(), `${channelId}.sync`)
    return await fs.readFile(file, "utf-8")
  } catch {
    return ""
  }
}

export async function writeWeChatPersonalSyncCursor(channelId: string, cursor: string) {
  const file = path.join(await ensureWeChatPersonalStateDir(), `${channelId}.sync`)
  await fs.writeFile(file, cursor, "utf-8")
}

function weChatPersonalItemToMessage(message: WeChatPersonalInboundMessage, channelId: string): RuntimeChannelMessage | null {
  const items = message.item_list || []
  let content = ""
  let messageType: RuntimeChannelMessage["messageType"] = "text"
  for (const item of items) {
    switch (item.type) {
      case 1:
        content = item.text_item?.text || ""
        messageType = "text"
        break
      case 2:
        content = "[Image]"
        messageType = "image"
        break
      case 3:
        content = "[Voice]"
        messageType = "voice"
        break
      case 4:
      case 5:
        content = "[File]"
        messageType = "file"
        break
      default:
        break
    }
    if (content) break
  }
  if (!content || !message.from_user_id) return null
  const timestamp = typeof message.create_time_ms === "number" && Number.isFinite(message.create_time_ms) ? message.create_time_ms : Date.now()
  return {
    id: String(message.message_id || `${message.from_user_id}:${timestamp}`),
    channelId,
    platform: "wechat_personal",
    senderId: message.from_user_id,
    senderName: message.from_user_id,
    content,
    timestamp,
    messageType,
    chatId: message.from_user_id,
    chatType: "private",
  }
}

async function ensureWeChatPersonalStateDir() {
  const dir = path.join(os.homedir(), ".suora", "channel-state", "wechat-personal")
  await fs.mkdir(dir, { recursive: true })
  return dir
}
