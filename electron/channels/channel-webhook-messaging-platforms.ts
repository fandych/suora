import type { Request, Response } from "express"
import type { ChannelConfigRecord } from "@/data/domain/models"
import type { RuntimeChannelMessage } from "@electron/channels/channel-runtime-types"
import { readNested, resolveTimestamp } from "@electron/channels/channel-webhook-normalizers"
import type { EmitChannelMessage } from "@electron/channels/channel-webhook-dispatch"
import { timingSafeCompare } from "@electron/channels/channel-webhook-security"

export async function handleTelegramWebhook(req: Request, res: Response, channel: ChannelConfigRecord, emitMessage: EmitChannelMessage) {
  if (channel.webhookSecret) {
    const provided = typeof req.headers["x-telegram-bot-api-secret-token"] === "string" ? req.headers["x-telegram-bot-api-secret-token"] : ""
    if (!provided || !timingSafeCompare(provided, channel.webhookSecret)) { res.status(403).json({ error: "Invalid secret token" }); return }
  }
  const update = req.body as Record<string, unknown>
  const msg = update.message as Record<string, unknown> | undefined
  if (!msg) { res.json({ ok: true }); return }
  let content = String(msg.caption || "[Unsupported message type]")
  let messageType: RuntimeChannelMessage["messageType"] = "text"
  if (msg.text) content = String(msg.text)
  else if (msg.photo) { content = String(msg.caption || "[Photo]"); messageType = "image" }
  else if (msg.document) { content = String(msg.caption || `[File: ${String(readNested(msg, ["document", "file_name"]) || "unknown")}]`); messageType = "file" }
  else if (msg.voice) { content = "[Voice message]"; messageType = "voice" }
  const chat = msg.chat as Record<string, unknown> | undefined
  const from = msg.from as Record<string, unknown> | undefined
  await emitMessage(channel, { id: String(msg.message_id || `telegram-${Date.now()}`), channelId: channel.id, platform: "telegram", senderId: String(from?.id || ""), senderName: `${String(from?.first_name || "")}${from?.last_name ? ` ${String(from.last_name)}` : ""}`.trim(), content, timestamp: typeof msg.date === "number" ? msg.date * 1000 : Date.now(), messageType, chatId: String(chat?.id || ""), chatType: String(chat?.type || "private") === "private" ? "private" : "group" }, update)
  res.json({ ok: true })
}

export async function handleTeamsWebhook(req: Request, res: Response, channel: ChannelConfigRecord, emitMessage: EmitChannelMessage) {
  const body = req.body as Record<string, unknown>
  if (body.type !== "message") { res.status(200).json({ ok: true }); return }
  const from = (body.from as Record<string, unknown> | undefined) || {}
  if (String(from.id || "") === channel.teamsAppId) { res.status(200).json({ ok: true }); return }
  const conversation = (body.conversation as Record<string, unknown> | undefined) || {}
  const serviceUrl = String(body.serviceUrl || "")
  await emitMessage(channel, { id: String(body.id || `teams-${Date.now()}`), channelId: channel.id, platform: "teams", senderId: String(from.id || ""), senderName: String(from.name || ""), content: String(body.text || ""), timestamp: resolveTimestamp(body.timestamp), messageType: "text", chatId: `${serviceUrl}|${String(conversation.id || "")}`, chatType: conversation.isGroup ? "group" : "private" }, body)
  res.status(200).json({ ok: true })
}