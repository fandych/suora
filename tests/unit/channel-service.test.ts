import { describe, expect, it, vi } from "vitest"

const startWeChatPersonalLogin = vi.fn()
const getChannel = vi.fn()
const saveChannel = vi.fn()

vi.mock("@/services/bridge", () => ({
  requireAppBridge: () => ({
    channels: {
      listAll: vi.fn(),
      get: getChannel,
      create: vi.fn(),
      save: saveChannel,
      delete: vi.fn(),
      startRuntime: vi.fn(),
      stopRuntime: vi.fn(),
      syncRuntime: vi.fn(),
      getRuntimeStatus: vi.fn(),
      healthCheck: vi.fn(),
      sendMessage: vi.fn(),
      sendMessageQueued: vi.fn(),
      getWebhookUrl: vi.fn(),
      debugSend: vi.fn(),
      startWeChatPersonalLogin,
      waitForWeChatPersonalLogin: vi.fn(),
    },
  }),
}))

import { bindChannel } from "@/services/channel-service"
import type { ChannelDetail } from "@/types/channel"

function createChannelDetail(): ChannelDetail {
  return {
    channel: {
      id: "channel-wechat-personal",
      title: "WeChat Personal",
      platform: "wechat_personal",
      enabled: false,
      status: "inactive",
      connectionMode: "stream",
      webhookPath: "/channels/channel-wechat-personal",
      webhookSecret: "",
      autoReply: false,
      replyAgentId: "",
      createdAt: 0,
      updatedAt: 0,
      messageCount: 0,
      emailFilters: [],
      emailActions: [],
      emailMarkAsRead: true,
    },
    runtime: {
      messages: [],
      users: [],
      health: {
        isHealthy: false,
        latencyMs: 0,
        lastCheckAt: 0,
        errorCount: 0,
      },
      debugLog: [],
    },
  }
}

describe("channel service WeChat personal binding", () => {
  it("preserves runtime debug logs when QR start fails", async () => {
    const detail = createChannelDetail()
    const latestDetail: ChannelDetail = {
      ...detail,
      runtime: {
        ...detail.runtime,
        debugLog: [
          {
            id: "debug-1",
            timestamp: 1,
            tone: "error",
            text: "Failed to start WeChat QR login: HTTP 412 from /ilink/bot/get_bot_qrcode?bot_type=3 (empty response body)",
          },
        ],
      },
    }

    startWeChatPersonalLogin.mockResolvedValueOnce({
      success: false,
      message: "HTTP 412 from /ilink/bot/get_bot_qrcode?bot_type=3 (empty response body)",
    })
    getChannel.mockResolvedValueOnce(latestDetail)
    saveChannel.mockImplementationOnce(async (payload: ChannelDetail) => payload)

    const result = await bindChannel(detail)

    expect(startWeChatPersonalLogin).toHaveBeenCalledWith(detail.channel.id, true)
    expect(getChannel).toHaveBeenCalledWith(detail.channel.id)
    expect(saveChannel).toHaveBeenCalledWith(
      expect.objectContaining({
        runtime: latestDetail.runtime,
        channel: expect.objectContaining({
          bindingState: "error",
          wechatPersonalBindingStatus: "error",
          wechatPersonalQrCodeUrl: undefined,
        }),
      }),
    )
    expect(result.runtime.debugLog[0]?.text).toContain("HTTP 412")
  })
})
