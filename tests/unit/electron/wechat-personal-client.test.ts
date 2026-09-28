import { describe, expect, it } from "vitest"

import {
  buildWeChatPersonalHttpErrorMessage,
  normalizeWeChatPersonalQrCodeUrl,
} from "@/electron/app/channels/providers/wechat-personal-client"

describe("wechat personal QR normalization", () => {
  it("preserves regular remote URLs", () => {
    expect(normalizeWeChatPersonalQrCodeUrl("https://example.com/qr.png")).toBe("https://example.com/qr.png")
  })

  it("normalizes protocol-relative URLs", () => {
    expect(normalizeWeChatPersonalQrCodeUrl("//example.com/qr.png")).toBe("https://example.com/qr.png")
  })

  it("converts raw svg payloads into data URLs", () => {
    const result = normalizeWeChatPersonalQrCodeUrl('<svg xmlns="http://www.w3.org/2000/svg"></svg>')

    expect(result?.startsWith("data:image/svg+xml;charset=utf-8,")).toBe(true)
  })

  it("normalizes plain base64 png payloads", () => {
    expect(normalizeWeChatPersonalQrCodeUrl("aGVsbG8=")).toBe("data:image/png;base64,aGVsbG8=")
  })

  it("surfaces empty upstream responses with the request path", () => {
    const message = buildWeChatPersonalHttpErrorMessage(new URL("https://ilinkai.weixin.qq.com/ilink/bot/get_bot_qrcode?bot_type=3"), {
      status: 412,
      text: "",
      data: null,
    })

    expect(message).toBe("HTTP 412 from /ilink/bot/get_bot_qrcode?bot_type=3 (empty response body)")
  })
})
