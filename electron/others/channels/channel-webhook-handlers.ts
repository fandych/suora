import type { Request, Response } from "express"

import type { ChannelConfigRecord } from "@/data/domain/models"
import {
  getWeChatVerificationToken,
  parseWeChatWebhookPayload,
  weChatWebhookToChannelMessage,
} from "@electron/others/channels/channel-runtime-helpers"
import { verifyDingTalkSignature, verifyFeishuSignature, verifyWebhookSecret, verifyWeChatSignature } from "@electron/others/channels/channel-webhook-security"
import { executeEmailActions, formatEmailContent, matchesEmailFilters, type ParsedEmail } from "@electron/others/channels/channel-runtime-email"
import type { RuntimeChannelMessage } from "@electron/others/channels/channel-runtime-types"

type EmitMessage = (channel: ChannelConfigRecord, message: RuntimeChannelMessage, rawEvent: unknown) => Promise<void>

export async function handleGetWebhookRequest(req: Request, res: Response, channel: ChannelConfigRecord, emitMessage: EmitMessage) {
  switch (channel.platform) {
    case "wechat":
    case "wechat_official":
    case "wechat_miniprogram":
      await handleWeChatWebhook(req, res, channel, emitMessage)
      return
    default:
      res.status(405).json({ error: "GET not supported for this platform" })
  }
}

export async function handlePostWebhookRequest(req: Request, res: Response, channel: ChannelConfigRecord, emitMessage: EmitMessage) {
  switch (channel.platform) {
    case "feishu":
      await handleFeishuWebhook(req, res, channel, emitMessage)
      return
    case "dingtalk":
      await handleDingTalkWebhook(req, res, channel, emitMessage)
      return
    case "wechat":
    case "wechat_official":
    case "wechat_miniprogram":
      await handleWeChatWebhook(req, res, channel, emitMessage)
      return
    case "wechat_personal":
      await handleWeChatPersonalWebhook(req, res, channel, emitMessage)
      return
    case "telegram":
      await handleTelegramWebhook(req, res, channel, emitMessage)
      return
    case "teams":
      await handleTeamsWebhook(req, res, channel, emitMessage)
      return
    case "email":
      await handleEmailWebhook(req, res, channel, emitMessage)
      return
    case "custom":
      await handleCustomWebhook(req, res, channel, emitMessage)
      return
    default:
      res.status(400).json({ error: `Unsupported platform: ${channel.platform}` })
  }
}

async function handleFeishuWebhook(req: Request, res: Response, channel: ChannelConfigRecord, emitMessage: EmitMessage) {
  const body = req.body as Record<string, unknown>
  if (body.type === "url_verification") {
    res.json({ challenge: body.challenge })
    return
  }

  if (channel.feishuEncryptKey && req.headers["x-lark-signature"]) {
    const timestamp = String(req.headers["x-lark-request-timestamp"] || "")
    const nonce = String(req.headers["x-lark-request-nonce"] || "")
    const signature = String(req.headers["x-lark-signature"] || "")
    if (!verifyFeishuSignature(timestamp, nonce, channel.feishuEncryptKey, body, signature)) {
      res.status(403).json({ error: "Invalid signature" })
      return
    }
  }

  if (body.header && (body.header as Record<string, unknown>).event_type === "im.message.receive_v1") {
    const event = body.event as Record<string, unknown>
    const messageObject = event.message as Record<string, unknown>
    let content: string
    try {
      content = JSON.parse(String(messageObject.content || "{}")).text || ""
    } catch {
      content = String(messageObject.content || "")
    }

    await emitMessage(channel, {
      id: String(messageObject.message_id || `feishu-${Date.now()}`),
      channelId: channel.id,
      platform: "feishu",
      senderId: String((((event.sender as Record<string, unknown>)?.sender_id as Record<string, unknown>)?.user_id) || ""),
      senderName: String((((event.sender as Record<string, unknown>)?.sender_id as Record<string, unknown>)?.union_id) || ""),
      content,
      timestamp: Number.parseInt(String(messageObject.create_time || Date.now()), 10) || Date.now(),
      messageType: "text",
      chatId: String(messageObject.chat_id || ""),
      chatType: String(messageObject.chat_type || "p2p") === "group" ? "group" : "private",
    }, body)
  }

  res.json({ success: true })
}

async function handleDingTalkWebhook(req: Request, res: Response, channel: ChannelConfigRecord, emitMessage: EmitMessage) {
  const body = req.body as Record<string, unknown>
  const signingSecret = channel.dingtalkSigningSecret || channel.appSecret
  if (signingSecret && req.headers.sign) {
    const timestamp = String(req.headers.timestamp || "")
    const sign = String(req.headers.sign || "")
    if (!verifyDingTalkSignature(timestamp, signingSecret, sign)) {
      res.status(403).json({ error: "Invalid signature" })
      return
    }
  }

  if (body.msgtype === "text") {
    await emitMessage(channel, {
      id: String(body.msgId || `dingtalk-${Date.now()}`),
      channelId: channel.id,
      platform: "dingtalk",
      senderId: String(body.senderStaffId || body.senderId || ""),
      senderName: String(body.senderNick || body.senderStaffId || body.senderId || ""),
      content: String((body.text as Record<string, unknown> | undefined)?.content || ""),
      timestamp: Number(body.createAt || Date.now()),
      messageType: "text",
      chatId: String(body.conversationId || ""),
      chatType: String(body.conversationType || "1") === "2" ? "group" : "private",
    }, body)
  }

  res.json({ success: true })
}

async function handleWeChatWebhook(req: Request, res: Response, channel: ChannelConfigRecord, emitMessage: EmitMessage) {
  const token = getWeChatVerificationToken(channel)
  const signature = String(req.query.msg_signature || req.query.signature || "")
  const timestamp = String(req.query.timestamp || "")
  const nonce = String(req.query.nonce || "")
  const parsedBody = parseWeChatWebhookPayload(req.body)
  const encrypted = parsedBody?.Encrypt

  if (req.query.echostr) {
    if (token && signature && timestamp && nonce && !verifyWeChatSignature(token, timestamp, nonce, signature, encrypted)) {
      res.status(403).send("Invalid signature")
      return
    }
    res.type("text/plain").send(String(req.query.echostr))
    return
  }

  if (token && signature && timestamp && nonce && !verifyWeChatSignature(token, timestamp, nonce, signature, encrypted)) {
    res.status(403).json({ error: "Invalid signature" })
    return
  }

  if (!parsedBody) {
    res.status(400).json({ error: "Invalid WeChat payload" })
    return
  }

  if (parsedBody.Encrypt && !parsedBody.MsgType) {
    res.type("text/plain").send("success")
    return
  }

  await emitMessage(channel, weChatWebhookToChannelMessage(parsedBody, channel.id, channel.platform), parsedBody)
  res.type("text/plain").send("success")
}

async function handleWeChatPersonalWebhook(req: Request, res: Response, channel: ChannelConfigRecord, emitMessage: EmitMessage) {
  if (!verifyWebhookSecret(req, channel.webhookSecret)) {
    res.status(401).json({ error: "Invalid webhook secret" })
    return
  }

  const body = req.body as Record<string, unknown>
  const senderId = String(body.senderId || body.sender_id || body.user_id || readNested(body, ["from", "id"]) || "unknown")
  const senderName = String(body.senderName || body.sender_name || body.user_name || readNested(body, ["from", "name"]) || senderId)
  const content = String(body.content || body.text || body.message || body.msg || "")
  const chatId = String(body.chatId || body.chat_id || body.conversation_id || body.channel_id || senderId)
  if (!content) {
    res.status(200).json({ ok: true, skipped: "empty content" })
    return
  }

  await emitMessage(channel, {
    id: String(body.id || body.message_id || `wechat-personal-${Date.now()}`),
    channelId: channel.id,
    platform: "wechat_personal",
    senderId,
    senderName,
    content,
    timestamp: resolveTimestamp(body.timestamp),
    messageType: "text",
    chatId,
    chatType: normalizeChatType(body.chatType || body.chat_type),
  }, body)

  res.json({ ok: true })
}

async function handleTelegramWebhook(req: Request, res: Response, channel: ChannelConfigRecord, emitMessage: EmitMessage) {
  if (channel.webhookSecret) {
    const secretToken = typeof req.headers["x-telegram-bot-api-secret-token"] === "string" ? req.headers["x-telegram-bot-api-secret-token"] : ""
    if (!secretToken || !timingSafeCompare(secretToken, channel.webhookSecret)) {
      res.status(403).json({ error: "Invalid secret token" })
      return
    }
  }

  const update = req.body as Record<string, unknown>
  const msg = update.message as Record<string, unknown> | undefined
  if (!msg) {
    res.json({ ok: true })
    return
  }

  let content: string
  let messageType: RuntimeChannelMessage["messageType"] = "text"
  if (msg.text) {
    content = String(msg.text)
  } else if (msg.photo) {
    content = String(msg.caption || "[Photo]")
    messageType = "image"
  } else if (msg.document) {
    content = String(msg.caption || `[File: ${String(readNested(msg, ["document", "file_name"]) || "unknown")}]`)
    messageType = "file"
  } else if (msg.voice) {
    content = "[Voice message]"
    messageType = "voice"
  } else {
    content = String(msg.caption || "[Unsupported message type]")
  }

  const chat = msg.chat as Record<string, unknown> | undefined
  const from = msg.from as Record<string, unknown> | undefined
  await emitMessage(channel, {
    id: String(msg.message_id || `telegram-${Date.now()}`),
    channelId: channel.id,
    platform: "telegram",
    senderId: String(from?.id || ""),
    senderName: `${String(from?.first_name || "")}${from?.last_name ? ` ${String(from.last_name)}` : ""}`.trim(),
    content,
    timestamp: typeof msg.date === "number" ? msg.date * 1000 : Date.now(),
    messageType,
    chatId: String(chat?.id || ""),
    chatType: String(chat?.type || "private") === "private" ? "private" : "group",
  }, update)

  res.json({ ok: true })
}

async function handleTeamsWebhook(req: Request, res: Response, channel: ChannelConfigRecord, emitMessage: EmitMessage) {
  const body = req.body as Record<string, unknown>
  if (body.type !== "message") {
    res.status(200).json({ ok: true })
    return
  }

  const from = (body.from as Record<string, unknown> | undefined) || {}
  if (String(from.id || "") === channel.teamsAppId) {
    res.status(200).json({ ok: true })
    return
  }

  const conversation = (body.conversation as Record<string, unknown> | undefined) || {}
  const serviceUrl = String(body.serviceUrl || "")
  await emitMessage(channel, {
    id: String(body.id || `teams-${Date.now()}`),
    channelId: channel.id,
    platform: "teams",
    senderId: String(from.id || ""),
    senderName: String(from.name || ""),
    content: String(body.text || ""),
    timestamp: resolveTimestamp(body.timestamp),
    messageType: "text",
    chatId: `${serviceUrl}|${String(conversation.id || "")}`,
    chatType: conversation.isGroup ? "group" : "private",
  }, body)

  res.status(200).json({ ok: true })
}

async function handleEmailWebhook(req: Request, res: Response, channel: ChannelConfigRecord, emitMessage: EmitMessage) {
  if (!verifyWebhookSecret(req, channel.webhookSecret)) {
    res.status(401).json({ error: "Invalid webhook secret" })
    return
  }

  const body = req.body as Record<string, unknown>
  const from = String(body.from || body.sender || body.from_email || "")
  const fromName = String(body.fromName || body.from_name || body.sender_name || from)
  const subject = String(body.subject || "")
  const emailBody = String(body.body || body.text || body.content || body.html || "")
  const hasAttachment = Boolean(body.hasAttachment || body.has_attachment)
  if (!from && !emailBody) {
    res.status(200).json({ ok: true, skipped: "empty email" })
    return
  }

  const email: ParsedEmail = {
    uid: Date.now(),
    from,
    fromName,
    subject,
    body: emailBody,
    date: String(body.date || new Date().toISOString()),
    hasAttachment,
    to: body.to ? String(body.to) : undefined,
    cc: body.cc ? String(body.cc) : undefined,
  }
  if (!matchesEmailFilters(email, channel.emailFilters || [])) {
    res.json({ ok: true, skipped: "did not match filters" })
    return
  }

  await emitMessage(channel, {
    id: `email-webhook-${Date.now()}`,
    channelId: channel.id,
    platform: "email",
    senderId: from,
    senderName: fromName,
    content: formatEmailContent(email),
    timestamp: Date.now(),
    messageType: "text",
    chatId: from,
    chatType: "private",
  }, body)

  await executeEmailActions(channel, email, channel.emailActions || [])
  res.json({ ok: true })
}

async function handleCustomWebhook(req: Request, res: Response, channel: ChannelConfigRecord, emitMessage: EmitMessage) {
  if (!verifyWebhookSecret(req, channel.webhookSecret)) {
    res.status(401).json({ error: "Invalid webhook secret" })
    return
  }

  const body = req.body as Record<string, unknown>
  const senderId = String(body.senderId || body.sender_id || body.user_id || readNested(body, ["from", "id"]) || "unknown")
  const senderName = String(body.senderName || body.sender_name || body.user_name || readNested(body, ["from", "name"]) || senderId)
  const content = String(body.content || body.text || body.message || body.msg || "")
  const chatId = String(body.chatId || body.chat_id || body.conversation_id || body.channel_id || senderId)
  if (!content) {
    res.status(200).json({ ok: true, skipped: "empty content" })
    return
  }

  await emitMessage(channel, {
    id: String(body.id || body.message_id || `custom-${Date.now()}`),
    channelId: channel.id,
    platform: "custom",
    senderId,
    senderName,
    content,
    timestamp: resolveTimestamp(body.timestamp),
    messageType: "text",
    chatId,
    chatType: normalizeChatType(body.chatType || body.chat_type),
  }, body)

  res.json({ ok: true })
}

function readNested(record: Record<string, unknown>, path: string[]) {
  let current: unknown = record
  for (const segment of path) {
    if (!current || typeof current !== "object") return undefined
    current = (current as Record<string, unknown>)[segment]
  }
  return current
}

function resolveTimestamp(input: unknown) {
  if (typeof input === "number" && Number.isFinite(input)) return input
  if (typeof input === "string") {
    const date = new Date(input).getTime()
    return Number.isNaN(date) ? Date.now() : date
  }
  return Date.now()
}

function normalizeChatType(value: unknown): "private" | "group" {
  return String(value || "private") === "group" ? "group" : "private"
}
