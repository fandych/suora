import crypto from "node:crypto"

import type { Request } from "express"

import { buildWeChatSignature } from "@electron/others/channels/channel-runtime-messages"

export function verifyWebhookSecret(req: Request, secret?: string) {
  if (!secret) return true
  const header = req.headers["x-webhook-secret"]
  const provided = Array.isArray(header) ? header[0] : header || req.query.secret
  return String(provided || "") === secret
}

export function verifyFeishuSignature(timestamp: string, nonce: string, encryptKey: string, body: unknown, receivedSignature: string) {
  const content = `${timestamp}\n${nonce}\n${encryptKey}\n${JSON.stringify(body)}`
  return timingSafeCompare(crypto.createHash("sha256").update(content).digest("hex"), receivedSignature)
}

export function verifyDingTalkSignature(timestamp: string, appSecret: string, receivedSignature: string) {
  const timestampMs = Number.parseInt(timestamp, 10)
  if (!Number.isFinite(timestampMs) || timestampMs <= 0 || Math.abs(Date.now() - timestampMs) > 60 * 60 * 1000) return false
  const sign = crypto.createHmac("sha256", appSecret).update(`${timestamp}\n${appSecret}`).digest("base64")
  return timingSafeCompare(sign, receivedSignature)
}

export function verifyWeChatSignature(token: string, timestamp: string, nonce: string, receivedSignature: string, encrypted?: string) {
  return timingSafeCompare(buildWeChatSignature(token, timestamp, nonce, encrypted), receivedSignature)
}

function timingSafeCompare(left: string, right: string) {
  const leftBuffer = Buffer.from(left); const rightBuffer = Buffer.from(right)
  return leftBuffer.length === rightBuffer.length && crypto.timingSafeEqual(leftBuffer, rightBuffer)
}
