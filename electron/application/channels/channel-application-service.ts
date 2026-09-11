import type { ChannelDetail } from "@shared/domain/channel-models"
import { getChannelWithDrizzle, listChannelsWithDrizzle, saveChannelWithDrizzle } from "@electron/database/drizzle/channel-repository"
import { getChannelService } from "@electron/channels/channel-service"

export const channelApplicationService = {
  list: () => listChannelsWithDrizzle(),
  getDetail: (channelId: string) => getChannelWithDrizzle(channelId),
  save: (detail: ChannelDetail) => saveChannelWithDrizzle(detail),
  runtimeStatus: () => ({ running: getChannelService().isRunning() }),
  startRuntime: () => getChannelService().start(),
  stopRuntime: () => getChannelService().stop(),
}
