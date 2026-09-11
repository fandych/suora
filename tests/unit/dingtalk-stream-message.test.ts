import { describe, expect, it } from "vitest"

import { parseDingTalkStreamMessage } from "@electron/others/channels/dingtalk-stream-message"

describe("DingTalk stream message mapping", () => {
  const channel = { id: "dingtalk-1", platform: "dingtalk" } as never

  it("maps a valid bot event", () => {
    const result = parseDingTalkStreamMessage({ headers: { eventId: "event-1" }, data: JSON.stringify({ msgId: "message-1", text: { content: " hello " }, senderStaffId: "user-1", senderNick: "Ada", conversationId: "chat-1", conversationType: "2", sessionWebhook: "https://example.com" }) }, channel)
    expect(result).toMatchObject({ sessionWebhook: "https://example.com", message: { id: "message-1", content: "hello", chatType: "group" } })
  })

  it("returns null for malformed data", () => {
    expect(parseDingTalkStreamMessage({ headers: { eventId: "event-1" }, data: "not-json" }, channel)).toBeNull()
  })
})
