import { describe, expect, it } from "vitest"
import { getChannelRuntimeCapabilities } from "@/services/channels/channel-service"

describe("channel runtime capabilities", () => {
  it("declares supported production operations", async () => {
    const capabilities = await getChannelRuntimeCapabilities()
    expect(capabilities.supportsWebhook).toBe(true)
    expect(capabilities.supportsQueuedMessages).toBe(true)
    expect(capabilities.supportsHealthCheck).toBe(true)
    expect(capabilities.supportsStreamStatus).toBe(true)
  })
})
