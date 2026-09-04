import { ipcMain } from "electron"

import type { ChannelConfigRecord } from "@/data/domain/models"
import { captureBrowserPagePreview } from "@electron/others/browser-window"
import { getChannelDetail } from "@electron/others/channels/channel-store"
import { getChannelService } from "@electron/others/channels/channel-service"
import { ensureWorkspace } from "@electron/others/workspace"

export function registerChannelRuntimeIpc() {
  ipcMain.handle("channel:start", async () => {
    await ensureWorkspace()
    await getChannelService().start()
    return { success: true }
  })

  ipcMain.handle("channel:stop", async () => {
    await ensureWorkspace()
    await getChannelService().stop()
    return { success: true }
  })

  ipcMain.handle("channel:status", async () => {
    await ensureWorkspace()
    return { running: getChannelService().isRunning() }
  })

  ipcMain.handle("channel:register", async () => {
    await ensureWorkspace()
    await getChannelService().registerEnabledChannels()
    return { success: true }
  })

  ipcMain.handle("channel:getWebhookUrl", async (_event, channelLike: ChannelConfigRecord | { id: string }) => {
    await ensureWorkspace()
    const channel = "platform" in channelLike ? channelLike : getChannelDetail(channelLike.id)?.channel
    if (!channel) {
      return { success: false, error: "Channel not found" }
    }
    return { success: true, url: getChannelService().getWebhookUrl(channel) }
  })

  ipcMain.handle("channel:sendMessage", async (_event, payload: { channelId: string; chatId: string; content: string }) => {
    await ensureWorkspace()
    return getChannelService().sendMessage(payload.channelId, payload.chatId, payload.content)
  })

  ipcMain.handle("channel:sendMessageQueued", async (_event, payload: { channelId: string; chatId: string; content: string }) => {
    await ensureWorkspace()
    const queueId = getChannelService().enqueueMessage(payload.channelId, payload.chatId, payload.content)
    return { success: true, queueId }
  })

  ipcMain.handle("channel:getAccessToken", async (_event, channelId: string) => {
    await ensureWorkspace()
    const channel = getChannelDetail(channelId)?.channel
    if (!channel) {
      return null
    }

    switch (channel.platform) {
      case "wechat_personal":
        return channel.wechatPersonalBotToken ? { token: channel.wechatPersonalBotToken, expiresAt: Date.now() + 365 * 24 * 60 * 60 * 1000 } : null
      case "telegram":
        return channel.telegramBotToken ? { token: channel.telegramBotToken, expiresAt: Date.now() + 365 * 24 * 60 * 60 * 1000 } : null
      default:
        return null
    }
  })

  ipcMain.handle("channel:healthCheck", async (_event, channelId: string) => {
    await ensureWorkspace()
    return getChannelService().healthCheck(channelId)
  })

  ipcMain.handle("channel:streamStatus", async (_event, channelId: string) => {
    await ensureWorkspace()
    return getChannelService().getStreamStatus(channelId)
  })

  ipcMain.handle("channel:debugSend", async (_event, payload: { channelId: string; content: string }) => {
    await ensureWorkspace()
    await getChannelService().simulateIncomingMessage(payload.channelId, payload.content)
    return { success: true }
  })

  ipcMain.handle("channel:wechatPersonalLoginStart", async (_event, force?: boolean) => {
    await ensureWorkspace()
    await getChannelService().registerEnabledChannels()
    return getChannelService().startWeChatPersonalLogin(force)
  })

  ipcMain.handle("channel:wechatPersonalLoginWait", async (_event, sessionKey: string, verifyCode?: string, timeoutMs?: number) => {
    await ensureWorkspace()
    return getChannelService().waitForWeChatPersonalLogin(sessionKey, verifyCode, timeoutMs)
  })

  ipcMain.handle("channel:wechatPersonalQrPreview", async (_event, url: string, waitMs?: number) => {
    await ensureWorkspace()
    return captureBrowserPagePreview({
      url,
      width: 920,
      height: 980,
      waitMs: Math.max(0, Math.min(waitMs ?? 0, 5000)),
    })
  })
}
