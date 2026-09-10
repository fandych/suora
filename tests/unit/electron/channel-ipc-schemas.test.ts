import { describe, expect, it } from "vitest"

import { channelIdSchema, channelMessageSchema, channelPreviewOptionsSchema, parseChannelIpcInput, wechatLoginWaitSchema } from "@electron/ipc/domain/channel-ipc-schemas"

describe("channel IPC schemas", () => {
  it("accepts bounded message payloads", () => {
    expect(parseChannelIpcInput(channelMessageSchema, { channelId: "channel-1", chatId: "chat-1", content: " hello " })).toEqual({
      channelId: "channel-1",
      chatId: "chat-1",
      content: "hello",
    })
  })

  it("rejects empty identifiers and oversized messages", () => {
    expect(() => parseChannelIpcInput(channelMessageSchema, { channelId: "", chatId: "chat-1", content: "hello" })).toThrow(/Invalid channel IPC payload/)
    expect(() => parseChannelIpcInput(channelMessageSchema, { channelId: "channel-1", chatId: "chat-1", content: "x".repeat(256 * 1024 + 1) })).toThrow(/Invalid channel IPC payload/)
  })

  it("bounds WeChat login wait input", () => {
    const parsed = parseChannelIpcInput(wechatLoginWaitSchema, { sessionKey: "session-1", timeoutMs: 5000 })
    expect(parsed.timeoutMs).toBe(5000)
    expect(() => parseChannelIpcInput(wechatLoginWaitSchema, { sessionKey: "session-1", timeoutMs: 999 })).toThrow(/Invalid channel IPC payload/)
  })

  it("accepts only bounded channel preview URLs", () => {
    expect(parseChannelIpcInput(channelIdSchema, " channel-1 ")).toBe("channel-1")
    expect(parseChannelIpcInput(channelPreviewOptionsSchema, { url: "https://example.com/qr", waitMs: 500 })).toMatchObject({ waitMs: 500 })
    expect(() => parseChannelIpcInput(channelPreviewOptionsSchema, { url: "file:///tmp/qr.png" })).toThrow(/Invalid channel IPC payload/)
    expect(() => parseChannelIpcInput(channelPreviewOptionsSchema, { url: "https://example.com", waitMs: 5001 })).toThrow(/Invalid channel IPC payload/)
  })

  it("requires an ID payload for channel URL lookup", () => {
    expect(parseChannelIpcInput(channelIdSchema, { id: "channel-1" }.id)).toBe("channel-1")
    expect(() => parseChannelIpcInput(channelIdSchema, undefined)).toThrow(/Invalid channel IPC payload/)
  })
})
