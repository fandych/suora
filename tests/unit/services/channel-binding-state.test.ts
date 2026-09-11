import { describe, expect, it, vi } from "vitest"
import type { ChannelDetail } from "@shared/domain/channel-models"
import { projectIpc } from "@/lib/ipc"
import { waitForWeChatPersonalBinding } from "@/services/channels/channel-binding-service"

const detail = {
  channel: {
    id: "wechat-1",
    title: "Personal WeChat",
    platform: "wechat_personal",
    enabled: false,
    status: "inactive",
    connectionMode: "stream",
    webhookPath: "/channels/wechat-1",
    webhookSecret: "",
    autoReply: true,
    replyAgentId: "",
    wechatPersonalSessionKey: "session-1",
    wechatPersonalQrStatus: "scaned",
    createdAt: 1,
    updatedAt: 1,
    messageCount: 0,
  },
  runtime: { messages: [], users: [], health: { isHealthy: null, errorCount: 0 }, debugLog: [] },
} as ChannelDetail

describe("channel binding state transitions", () => {
  it("preserves scanned QR state after timeout", async () => {
    const wait = vi.spyOn(projectIpc.channels, "waitForWeChatPersonalLogin").mockResolvedValue({ status: "timeout", success: false, message: "Timed out" } as never)
    const persist = vi.fn(async (next: ChannelDetail) => next)
    const result = await waitForWeChatPersonalBinding(detail, persist, vi.fn(async () => undefined))
    expect(result.status).toBe("timeout")
    expect(result.detail.channel.wechatPersonalBindingStatus).toBe("pending")
    expect(result.detail.channel.wechatPersonalQrStatus).toBe("scaned")
    wait.mockRestore()
  })

  it("marks a connected login as bound and clears session state", async () => {
    const wait = vi.spyOn(projectIpc.channels, "waitForWeChatPersonalLogin").mockResolvedValue({ status: "connected", success: true, botToken: "token", baseUrl: "https://wechat.test", accountId: "account", userId: "user" } as never)
    const persist = vi.fn(async (next: ChannelDetail) => next)
    const result = await waitForWeChatPersonalBinding(detail, persist, vi.fn(async () => undefined))
    expect(result.detail.channel.wechatPersonalBindingStatus).toBe("bound")
    expect(result.detail.channel.wechatPersonalSessionKey).toBeUndefined()
    expect(result.detail.channel.wechatPersonalBotToken).toBe("token")
    wait.mockRestore()
  })
})
