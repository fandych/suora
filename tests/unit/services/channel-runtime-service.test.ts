import { describe, expect, it } from "vitest"
import { getChannelRuntimeStatus } from "@/services/channels/channel-runtime-service"

describe("channel runtime service", () => {
  it("exposes a runtime status application boundary", () => {
    expect(typeof getChannelRuntimeStatus).toBe("function")
  })
})
