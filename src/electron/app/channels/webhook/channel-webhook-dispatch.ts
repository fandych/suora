import type { Request, Response } from "express"

import type { ChannelConfigRecord } from "@/types/channel"
import type { RuntimeChannelMessage } from "@/electron/app/channels/runtime/channel-runtime-types"

export type EmitChannelMessage = (
  channel: ChannelConfigRecord,
  message: RuntimeChannelMessage,
  rawEvent: unknown,
) => Promise<void>

export function dispatchGetWebhook(platform: ChannelConfigRecord["platform"]) {
  return platform === "wechat" || platform === "wechat_official" || platform === "wechat_miniprogram"
}

export function respondUnsupportedMethod(res: Response, platform: ChannelConfigRecord["platform"]) {
  res.status(405).json({ error: `GET not supported for this platform: ${platform}` })
}

export function respondUnsupportedPlatform(res: Response, platform: ChannelConfigRecord["platform"]) {
  res.status(400).json({ error: `Unsupported platform: ${platform}` })
}

export type WebhookRequest = Request
