import { describe, expect, it } from "vitest"

import { verifyWebhookSecret } from "@electron/channels/channel-webhook-security"

describe("webhook security", () => {
  it("requires the secret header and uses no query fallback", () => {
    expect(verifyWebhookSecret({ headers: { "x-webhook-secret": "secret" }, query: {} } as never, "secret")).toBe(true)
    expect(verifyWebhookSecret({ headers: {}, query: { secret: "secret" } } as never, "secret")).toBe(false)
    expect(verifyWebhookSecret({ headers: { "x-webhook-secret": "wrong" }, query: {} } as never, "secret")).toBe(false)
  })
})