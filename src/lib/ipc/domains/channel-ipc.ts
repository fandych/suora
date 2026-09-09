import type { ChannelConfigRecord, ChannelDetail } from "@/data/domain/channel-models"
import { getProjectBridge } from "@/lib/ipc/bridge"
import type { RawChannelRow } from "@/data/mappers/channel-mappers"
import { parseChannelDetailRow, parseChannelSummaryRow } from "@/data/mappers/channel-mappers"

export const channelIpc = {
  list: async () => (await getProjectBridge().channels.list() as RawChannelRow[]).map(parseChannelSummaryRow),
  get: async (channelId: string) => { const row = await getProjectBridge().channels.get(channelId) as RawChannelRow | null; return row ? parseChannelDetailRow(row) : null },
  create: async (defaults?: { providerId?: string; modelId?: string }) => parseChannelDetailRow(await getProjectBridge().channels.create(defaults) as RawChannelRow),
  save: async (payload: ChannelDetail) => parseChannelDetailRow(await getProjectBridge().channels.save(payload) as RawChannelRow),
  delete: async (channelId: string) => getProjectBridge().channels.delete(channelId) as Promise<{ success: boolean }>,
  startRuntime: async () => getProjectBridge().channels.startRuntime(),
  stopRuntime: async () => getProjectBridge().channels.stopRuntime(),
  getRuntimeStatus: async () => getProjectBridge().channels.getRuntimeStatus(),
  registerRuntime: async () => getProjectBridge().channels.registerRuntime(),
  getWebhookUrl: async (channel: ChannelConfigRecord) => getProjectBridge().channels.getWebhookUrl(channel),
  sendMessage: async (payload: { channelId: string; chatId: string; content: string }) => getProjectBridge().channels.sendMessage(payload),
  sendMessageQueued: async (payload: { channelId: string; chatId: string; content: string }) => getProjectBridge().channels.sendMessageQueued(payload),
  getAccessToken: async (channelId: string) => getProjectBridge().channels.getAccessToken(channelId),
  healthCheck: async (channelId: string) => getProjectBridge().channels.healthCheck(channelId),
  getStreamStatus: async (channelId: string) => getProjectBridge().channels.getStreamStatus(channelId),
  debugSend: async (payload: { channelId: string; content: string }) => getProjectBridge().channels.debugSend(payload),
  startWeChatPersonalLogin: async (channelId?: string, force?: boolean) => getProjectBridge().channels.startWeChatPersonalLogin(channelId, force),
  waitForWeChatPersonalLogin: async (channelId: string | undefined, sessionKey: string, verifyCode?: string, timeoutMs?: number) => getProjectBridge().channels.waitForWeChatPersonalLogin(channelId, sessionKey, verifyCode, timeoutMs),
  getWeChatPersonalQrPreview: async (url: string, waitMs?: number) => getProjectBridge().channels.getWeChatPersonalQrPreview(url, waitMs) as Promise<{ ok?: boolean; image?: string; format?: string; error?: string }>,
}
