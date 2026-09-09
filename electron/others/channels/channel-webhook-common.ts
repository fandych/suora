import type { Request } from "express"

import { verifyWebhookSecret } from "@electron/others/channels/channel-webhook-security"
import { readGenericMessageFields, type UnknownRecord } from "@electron/others/channels/channel-webhook-normalizers"

export function requireWebhookSecret(req: Request, secret?: string) {
  return verifyWebhookSecret(req, secret)
}

export function readGenericWebhookMessage(body: UnknownRecord) {
  return readGenericMessageFields(body)
}

export function hasGenericMessageContent(content: string) {
  return Boolean(content)
}
