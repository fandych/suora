import type { ChannelDetail } from "@/data/domain/channel-models"
import { getChannelWithDrizzle, listChannelsWithDrizzle, saveChannelWithDrizzle } from "@electron/database/drizzle/channel-repository"
import { getChannelRuntimeStatus, startChannelRuntime, stopChannelRuntime } from "@/services/channels/channel-runtime-service"

export const channelApplicationService = {
  list: () => listChannelsWithDrizzle(),
  getDetail: (channelId: string) => getChannelWithDrizzle(channelId),
  save: (detail: ChannelDetail) => saveChannelWithDrizzle(detail),
  runtimeStatus: () => getChannelRuntimeStatus(),
  startRuntime: () => startChannelRuntime(),
  stopRuntime: () => stopChannelRuntime(),
}
