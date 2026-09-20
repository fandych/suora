import crypto from "node:crypto"

import type { Request } from "express"

import { buildWeChatSignature } from "@/electron/app/channels/runtime/channel-runtime-messages"

export function verifyWebhookSecret(req: Request, secret?: string) {
  if (!secret) return false
  const header = req.headers["x-webhook-secret"]
  const provided = Array.isArray(header) ? header[0] : header
  return timingSafeCompare(String(secret), String(provided || ""))
}

export function verifyFeishuSignature(
  timestamp: string,
  nonce: string,
  encryptKey: string,
  rawBody: unknown,
  receivedSignature: string,
) {
  const serializedBody = typeof rawBody === "string" ? rawBody : JSON.stringify(rawBody ?? {})
  const content = `${timestamp}\n${nonce}\n${encryptKey}\n${serializedBody}`
  return timingSafeCompare(crypto.createHash("sha256").update(content).digest("hex"), receivedSignature)
}

export function verifyDingTalkSignature(timestamp: string, appSecret: string, receivedSignature: string) {
  const timestampMs = Number.parseInt(timestamp, 10)
  if (!Number.isFinite(timestampMs) || timestampMs <= 0 || Math.abs(Date.now() - timestampMs) > 10 * 60 * 1000)
    return false
  const sign = crypto.createHmac("sha256", appSecret).update(`${timestamp}\n${appSecret}`).digest("base64")
  return timingSafeCompare(sign, receivedSignature)
}

export function getWebhookRawBody(req: Request, fallbackBody?: unknown) {
  const rawBody = (req as Request & { rawBody?: string }).rawBody
  if (typeof rawBody === "string") return rawBody
  return typeof fallbackBody === "string" ? fallbackBody : JSON.stringify(fallbackBody ?? {})
}

export function verifyWeChatSignature(
  token: string,
  timestamp: string,
  nonce: string,
  receivedSignature: string,
  encrypted?: string,
) {
  return timingSafeCompare(buildWeChatSignature(token, timestamp, nonce, encrypted), receivedSignature)
}

export function timingSafeCompare(left: string, right: string) {
  const leftBuffer = Buffer.from(left)
  const rightBuffer = Buffer.from(right)
  return leftBuffer.length === rightBuffer.length && crypto.timingSafeEqual(leftBuffer, rightBuffer)
}
