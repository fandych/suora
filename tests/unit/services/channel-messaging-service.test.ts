import { describe, expect, it } from "vitest"
import { sendChannelReply, sendQueuedChannelReply } from "@/services/channels/channel-messaging-service"

describe("channel messaging service", () => {
  it("exposes direct and queued send boundaries", () => {
    expect(typeof sendChannelReply).toBe("function")
    expect(typeof sendQueuedChannelReply).toBe("function")
  })
})
