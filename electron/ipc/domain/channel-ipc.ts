import { ipcMain } from "electron"

import { captureBrowserPagePreview } from "@electron/infrastructure/browser-preview"
import { getChannelDetail } from "@electron/channels/channel-store"
import { getChannelService } from "@electron/channels/channel-service"
import { ensureWorkspace } from "@electron/infrastructure/workspace-service"
import { assertChannelExists } from "@electron/ipc/domain/channel-ipc-policy"
import { channelDebugMessageSchema, channelIdSchema, channelMessageSchema, channelPreviewOptionsSchema, parseChannelIpcInput, wechatLoginStartSchema, wechatLoginWaitSchema } from "@electron/ipc/domain/channel-ipc-schemas"

export function registerChannelIpc() {
  ipcMain.handle("channel:start", async () => { await ensureWorkspace(); await getChannelService().start(); return { success: true } })
  ipcMain.handle("channel:stop", async () => { await ensureWorkspace(); await getChannelService().stop(); return { success: true } })
  ipcMain.handle("channel:status", async () => { await ensureWorkspace(); return { running: getChannelService().isRunning() } })
  ipcMain.handle("channel:register", async () => { await ensureWorkspace(); await getChannelService().registerEnabledChannels(); return { success: true } })
  ipcMain.handle("channel:getWebhookUrl", async (_event, payload: unknown) => { const id = parseChannelIpcInput(channelIdSchema, (payload as { id?: unknown } | null)?.id); await ensureWorkspace(); const channel = getChannelDetail(id)?.channel; return channel ? { success: true, url: getChannelService().getWebhookUrl(channel) } : { success: false, error: "Channel not found" } })
  ipcMain.handle("channel:sendMessage", async (_event, payload: unknown) => { const input = parseChannelIpcInput(channelMessageSchema, payload); await ensureWorkspace(); assertChannelExists(getChannelDetail(input.channelId), true); return getChannelService().sendMessage(input.channelId, input.chatId, input.content) })
  ipcMain.handle("channel:sendMessageQueued", async (_event, payload: unknown) => { const input = parseChannelIpcInput(channelMessageSchema, payload); await ensureWorkspace(); assertChannelExists(getChannelDetail(input.channelId), true); return { success: true, queueId: getChannelService().enqueueMessage(input.channelId, input.chatId, input.content) } })
  ipcMain.handle("channel:getAccessToken", async (_event, channelId: unknown) => { const id = parseChannelIpcInput(channelIdSchema, channelId); await ensureWorkspace(); const channel = getChannelDetail(id)?.channel; return channel ? { configured: Boolean(channel.wechatPersonalBotToken || channel.telegramBotToken) } : null })
  ipcMain.handle("channel:healthCheck", async (_event, channelId: unknown) => { const id = parseChannelIpcInput(channelIdSchema, channelId); await ensureWorkspace(); assertChannelExists(getChannelDetail(id)); return getChannelService().healthCheck(id) })
  ipcMain.handle("channel:streamStatus", async (_event, channelId: unknown) => { const id = parseChannelIpcInput(channelIdSchema, channelId); await ensureWorkspace(); assertChannelExists(getChannelDetail(id)); return getChannelService().getStreamStatus(id) })
  ipcMain.handle("channel:debugSend", async (_event, payload: unknown) => { const input = parseChannelIpcInput(channelDebugMessageSchema, payload); await ensureWorkspace(); assertChannelExists(getChannelDetail(input.channelId), true); await getChannelService().simulateIncomingMessage(input.channelId, input.content); return { success: true } })
  ipcMain.handle("channel:wechatPersonalLoginStart", async (_event, channelId?: string, force?: boolean) => { const input = parseChannelIpcInput(wechatLoginStartSchema, { channelId, force }); await ensureWorkspace(); await getChannelService().registerEnabledChannels(); return getChannelService().startWeChatPersonalLogin(input.channelId, input.force) })
  ipcMain.handle("channel:wechatPersonalLoginWait", async (_event, channelId: string | undefined, sessionKey: string, verifyCode?: string, timeoutMs?: number) => { const input = parseChannelIpcInput(wechatLoginWaitSchema, { channelId, sessionKey, verifyCode, timeoutMs }); await ensureWorkspace(); return getChannelService().waitForWeChatPersonalLogin(input.channelId, input.sessionKey, input.verifyCode, input.timeoutMs) })
  ipcMain.handle("channel:wechatPersonalQrPreview", async (_event, url: unknown, waitMs?: unknown) => { const input = parseChannelIpcInput(channelPreviewOptionsSchema, { url, waitMs }); await ensureWorkspace(); return captureBrowserPagePreview({ url: input.url, width: 920, height: 980, waitMs: input.waitMs }) })
}
