import { describe, expect, it } from "vitest"
import { getChannelRuntimeCapabilities } from "@/services/channels/channel-service"

describe("channel runtime production capabilities", () => {
  it("declares all supported runtime operations", async () => {
    await expect(getChannelRuntimeCapabilities()).resolves.toEqual({
      supportsWebhook: true,
      supportsQueuedMessages: true,
      supportsHealthCheck: true,
      supportsStreamStatus: true,
    })
  })
})
