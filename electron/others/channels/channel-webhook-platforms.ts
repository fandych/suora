import type { Request, Response } from "express"

import type { ChannelConfigRecord } from "@/data/domain/channel-models"
import { getWeChatVerificationToken, parseWeChatWebhookPayload, weChatWebhookToChannelMessage } from "@electron/others/channels/channel-runtime-helpers"
import { verifyDingTalkSignature, verifyFeishuSignature, verifyWeChatSignature } from "@electron/others/channels/channel-webhook-security"
import type { EmitChannelMessage } from "@electron/others/channels/channel-webhook-dispatch"

export async function handleFeishuWebhook(req: Request, res: Response, channel: ChannelConfigRecord, emitMessage: EmitChannelMessage) {
  const body = req.body as Record<string, unknown>
  if (body.type === "url_verification") { res.json({ challenge: body.challenge }); return }
  if (channel.feishuEncryptKey && req.headers["x-lark-signature"]) {
    const timestamp = String(req.headers["x-lark-request-timestamp"] || "")
    const nonce = String(req.headers["x-lark-request-nonce"] || "")
    const signature = String(req.headers["x-lark-signature"] || "")
    if (!verifyFeishuSignature(timestamp, nonce, channel.feishuEncryptKey, body, signature)) { res.status(403).json({ error: "Invalid signature" }); return }
  }
  if (body.header && (body.header as Record<string, unknown>).event_type === "im.message.receive_v1") {
    const event = body.event as Record<string, unknown>
    const messageObject = event.message as Record<string, unknown>
    let content: string
    try { content = JSON.parse(String(messageObject.content || "{}")).text || "" } catch { content = String(messageObject.content || "") }
    await emitMessage(channel, { id: String(messageObject.message_id || `feishu-${Date.now()}`), channelId: channel.id, platform: "feishu", senderId: String((((event.sender as Record<string, unknown>)?.sender_id as Record<string, unknown>)?.user_id) || ""), senderName: String((((event.sender as Record<string, unknown>)?.sender_id as Record<string, unknown>)?.union_id) || ""), content, timestamp: Number.parseInt(String(messageObject.create_time || Date.now()), 10) || Date.now(), messageType: "text", chatId: String(messageObject.chat_id || ""), chatType: String(messageObject.chat_type || "p2p") === "group" ? "group" : "private" }, body)
  }
  res.json({ success: true })
}

export async function handleDingTalkWebhook(req: Request, res: Response, channel: ChannelConfigRecord, emitMessage: EmitChannelMessage) {
  const body = req.body as Record<string, unknown>
  const signingSecret = channel.dingtalkSigningSecret || channel.appSecret
  if (signingSecret && req.headers.sign) {
    if (!verifyDingTalkSignature(String(req.headers.timestamp || ""), signingSecret, String(req.headers.sign || ""))) { res.status(403).json({ error: "Invalid signature" }); return }
  }
  if (body.msgtype === "text") await emitMessage(channel, { id: String(body.msgId || `dingtalk-${Date.now()}`), channelId: channel.id, platform: "dingtalk", senderId: String(body.senderStaffId || body.senderId || ""), senderName: String(body.senderNick || body.senderStaffId || body.senderId || ""), content: String((body.text as Record<string, unknown> | undefined)?.content || ""), timestamp: Number(body.createAt || Date.now()), messageType: "text", chatId: String(body.conversationId || ""), chatType: String(body.conversationType || "1") === "2" ? "group" : "private" }, body)
  res.json({ success: true })
}

export async function handleWeChatWebhook(req: Request, res: Response, channel: ChannelConfigRecord, emitMessage: EmitChannelMessage) {
  const token = getWeChatVerificationToken(channel)
  const signature = String(req.query.msg_signature || req.query.signature || "")
  const timestamp = String(req.query.timestamp || "")
  const nonce = String(req.query.nonce || "")
  const parsedBody = parseWeChatWebhookPayload(req.body)
  const encrypted = parsedBody?.Encrypt
  if (req.query.echostr) {
    if (token && signature && timestamp && nonce && !verifyWeChatSignature(token, timestamp, nonce, signature, encrypted)) { res.status(403).send("Invalid signature"); return }
    res.type("text/plain").send(String(req.query.echostr)); return
  }
  if (token && signature && timestamp && nonce && !verifyWeChatSignature(token, timestamp, nonce, signature, encrypted)) { res.status(403).json({ error: "Invalid signature" }); return }
  if (!parsedBody) { res.status(400).json({ error: "Invalid WeChat payload" }); return }
  if (parsedBody.Encrypt && !parsedBody.MsgType) { res.type("text/plain").send("success"); return }
  await emitMessage(channel, weChatWebhookToChannelMessage(parsedBody, channel.id, channel.platform), parsedBody)
  res.type("text/plain").send("success")
}
