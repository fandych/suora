import crypto from "node:crypto"

import type { ChannelConfigRecord } from "@/data/domain/models"
import type { RuntimeChannelMessage } from "@electron/others/channels/channel-runtime-types"

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

function getXmlTag(xml: string, tag: string) {
  const escapedTag = tag.replace(/[-.*+?^${}()|[\]\\]/g, "\\$&")
  const cdataMatch = xml.match(new RegExp(`<${escapedTag}><!\\[CDATA\\[([\\s\\S]*?)\\]\\]></${escapedTag}>`))
  if (cdataMatch) return cdataMatch[1]
  return xml.match(new RegExp(`<${escapedTag}>([^<]*)</${escapedTag}>`))?.[1]
}

const stringValue = (value: unknown) => typeof value === "string" && value.length > 0 ? value : undefined
const numberValue = (value: unknown) => { const num = typeof value === "number" ? value : Number.parseInt(String(value ?? "0"), 10); return Number.isFinite(num) ? num : 0 }

export function parseWeChatWebhookPayload(body: unknown): WeChatWebhookPayload | null {
  if (typeof body === "string") {
    const xml = body.trim(); if (!xml.startsWith("<xml>") || !xml.endsWith("</xml>")) return null
    return parseWeChatRecord((tag: string) => getXmlTag(xml, tag))
  }
  if (!body || typeof body !== "object") return null
  const record = body as Record<string, unknown>
  return parseWeChatRecord((tag: string) => stringValue(record[tag]))
}

function parseWeChatRecord(get: (tag: string) => unknown): WeChatWebhookPayload {
  return {
    ToUserName: String(get("ToUserName") || ""), FromUserName: String(get("FromUserName") || ""), CreateTime: numberValue(get("CreateTime")),
    MsgType: String(get("MsgType") || "").trim() as WeChatWebhookPayload["MsgType"], Content: stringValue(get("Content")), PicUrl: stringValue(get("PicUrl")), MediaId: stringValue(get("MediaId")), Format: stringValue(get("Format")), Recognition: stringValue(get("Recognition")), ThumbMediaId: stringValue(get("ThumbMediaId")), Location_X: stringValue(get("Location_X")), Location_Y: stringValue(get("Location_Y")), Label: stringValue(get("Label")), Title: stringValue(get("Title")), Description: stringValue(get("Description")), Url: stringValue(get("Url")), Event: stringValue(get("Event")), EventKey: stringValue(get("EventKey")), MsgId: stringValue(get("MsgId")), AgentID: stringValue(get("AgentID")), Encrypt: stringValue(get("Encrypt")),
  }
}

export function buildWeChatSignature(token: string, timestamp: string, nonce: string, encrypted?: string) {
  return crypto.createHash("sha1").update((encrypted ? [token, timestamp, nonce, encrypted] : [token, timestamp, nonce]).sort().join("")).digest("hex")
}

export function weChatWebhookToChannelMessage(payload: WeChatWebhookPayload, channelId: string, platform: ChannelConfigRecord["platform"]): RuntimeChannelMessage {
  let content = payload.Content || ""; let messageType: RuntimeChannelMessage["messageType"] = "text"
  if (payload.MsgType === "image") { content = payload.PicUrl || payload.MediaId || "[Image]"; messageType = "image" }
  else if (payload.MsgType === "voice") { content = payload.Recognition || payload.MediaId || "[Voice]"; messageType = "voice" }
  else if (payload.MsgType === "video") { content = payload.ThumbMediaId || payload.MediaId || "[Video]"; messageType = "file" }
  else if (payload.MsgType === "location") content = `[Location] ${payload.Label || "Location"}`
  else if (payload.MsgType === "link") content = `[Link] ${payload.Title || "Link"}${payload.Url ? `: ${payload.Url}` : ""}${payload.Description ? `\n${payload.Description}` : ""}`
  else if (payload.MsgType === "event") content = `[Event: ${payload.Event || "unknown"}${payload.EventKey ? ` - ${payload.EventKey}` : ""}]`
  return { id: payload.MsgId || [platform, payload.FromUserName || "unknown", payload.CreateTime || Date.now(), payload.Event || payload.MsgType || "message"].join(":"), channelId, platform, senderId: payload.FromUserName, senderName: payload.FromUserName, content, timestamp: (payload.CreateTime || Math.floor(Date.now() / 1000)) * 1000, messageType, chatId: payload.FromUserName, chatType: "private" }
}
