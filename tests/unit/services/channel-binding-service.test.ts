import { describe, expect, it, vi } from "vitest"
import type { ChannelDetail } from "@shared/domain/channel-models"
import { bindChannel } from "@/services/channels/channel-binding-service"

const baseDetail = {
  channel: {
    id: "channel-1",
    title: "Web channel",
    platform: "web",
    enabled: false,
    status: "inactive",
    connectionMode: "webhook",
    webhookPath: "/channels/channel-1",
    webhookSecret: "",
    autoReply: true,
    replyAgentId: "",
    createdAt: 1,
    updatedAt: 1,
    messageCount: 0,
  },
  runtime: { messages: [], users: [], health: { isHealthy: null, errorCount: 0 }, debugLog: [] },
} as ChannelDetail

describe("channel binding service", () => {
  it("blocks a channel with missing credentials without invoking IPC", async () => {
    const persist = vi.fn(async (detail: ChannelDetail) => detail)
    const next = await bindChannel({ ...baseDetail, channel: { ...baseDetail.channel, platform: "telegram" } }, persist, vi.fn(async () => undefined))
    expect(next.channel.bindingState).toBe("error")
    expect(next.runtime.debugLog[0].tone).toBe("error")
  })

  it("binds a configured webhook channel and syncs runtime", async () => {
    const persist = vi.fn(async (detail: ChannelDetail) => detail)
    const syncRuntime = vi.fn(async () => undefined)
    const next = await bindChannel({ ...baseDetail, channel: { ...baseDetail.channel, telegramBotToken: "bot-token" } }, persist, syncRuntime)
    expect(next.channel.enabled).toBe(true)
    expect(next.channel.bindingState).toBe("connected")
    expect(next.channel.callbackUrl).toBe("https://local.suora.test/channels/channel-1")
    expect(syncRuntime).toHaveBeenCalledOnce()
  })
})
