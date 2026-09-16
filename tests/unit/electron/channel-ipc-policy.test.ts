import { describe, expect, it } from "vitest"

import { assertChannelExists } from "@/electron/preload/channels/channel-ipc-policy"

describe("channel IPC policy", () => {
  const enabled = { channel: { enabled: true } } as never
  const disabled = { channel: { enabled: false } } as never

  it("requires an existing channel", () => {
    expect(() => assertChannelExists(null)).toThrow("Channel not found")
    expect(assertChannelExists(enabled)).toBe(enabled)
  })

  it("can require an enabled channel for actions", () => {
    expect(() => assertChannelExists(disabled, true)).toThrow("Channel is disabled")
    expect(assertChannelExists(disabled)).toBe(disabled)
  })
})
