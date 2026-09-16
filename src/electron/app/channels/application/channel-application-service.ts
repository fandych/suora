import {
  createChannel,
  deleteChannel,
  getChannel,
  listChannels,
  saveChannel,
} from "@/electron/app/channels/repositories/channel-repository"
import { getChannelService } from "@/electron/app/channels/runtime/channel-service"
import type { ChannelConfigRecord, ChannelDetail } from "@/types/channel"

export const channelApplicationService = {
  list: () => listChannels(),
  getDetail: (channelId: string) => getChannel(channelId),
  save: (detail: ChannelDetail) => saveChannel(detail),
  create: (defaults?: { providerId?: string; modelId?: string }) => createChannel(defaults),
  remove: (channelId: string) => deleteChannel(channelId),
  webhookUrl: (channel: ChannelConfigRecord) => getChannelService().getWebhookUrl(channel),
  healthCheck: (channelId: string) => getChannelService().healthCheck(channelId),
  sendMessage: (payload: { channelId: string; chatId: string; content: string }) =>
    getChannelService().sendMessage(payload.channelId, payload.chatId, payload.content),
  sendMessageQueued: (payload: { channelId: string; chatId: string; content: string }) => ({
    success: true,
    queueId: getChannelService().enqueueMessage(payload.channelId, payload.chatId, payload.content),
  }),
  runtimeStatus: () => ({ running: getChannelService().isRunning() }),
  startRuntime: () => getChannelService().start(),
  stopRuntime: () => getChannelService().stop(),
  syncRuntime: async () => {
    await getChannelService().registerEnabledChannels()
    const channels = await listChannels()
    const hasEnabledChannels = channels.some((channel) => channel.enabled)
    const hasEnabledWebhookTransport = channels.some(
      (channel) => channel.enabled && channel.connectionMode === "webhook",
    )

    if (hasEnabledWebhookTransport) {
      await getChannelService().start()
    } else if (!hasEnabledChannels && getChannelService().isRunning()) {
      await getChannelService().stop()
    }
  },
  restoreRuntime: async () => {
    await getChannelService().registerEnabledChannels()
    const channels = await listChannels()
    if (channels.some((channel) => channel.enabled && channel.connectionMode === "webhook")) {
      await getChannelService().start()
    }
  },
}
