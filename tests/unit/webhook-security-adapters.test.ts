import crypto from "node:crypto"
import { describe, expect, it } from "vitest"

import { buildWeChatSignature } from "@electron/others/channels/channel-runtime-messages"
import { hasGenericMessageContent, readGenericWebhookMessage, requireWebhookSecret } from "@electron/others/channels/channel-webhook-common"
import { verifyDingTalkSignature, verifyFeishuSignature, verifyWeChatSignature } from "@electron/others/channels/channel-webhook-security"

describe("webhook security adapters", () => {
  it("verifies platform signatures", () => {
    const timestamp = String(Date.now())
    const secret = "ding-secret"
    const dingSign = crypto.createHmac("sha256", secret).update(`${timestamp}\n${secret}`).digest("base64")
    expect(verifyDingTalkSignature(timestamp, secret, dingSign)).toBe(true)
    const body = { challenge: "ok" }
    const feishuSign = crypto.createHash("sha256").update(`${timestamp}\nnonce\nfeishu-key\n${JSON.stringify(body)}`).digest("hex")
    expect(verifyFeishuSignature(timestamp, "nonce", "feishu-key", body, feishuSign)).toBe(true)
    const wechatSign = buildWeChatSignature("wechat-token", timestamp, "nonce")
    expect(verifyWeChatSignature("wechat-token", timestamp, "nonce", wechatSign)).toBe(true)
  })

  it("normalizes generic messages and requires header secrets", () => {
    expect(readGenericWebhookMessage({ content: "hello" }).content).toBe("hello")
    expect(hasGenericMessageContent("hello")).toBe(true)
    expect(hasGenericMessageContent("")).toBe(false)
    expect(requireWebhookSecret({ headers: { "x-webhook-secret": "secret" }, query: {} } as never, "secret")).toBe(true)
  })
})
