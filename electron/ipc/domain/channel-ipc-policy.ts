import type { ChannelDetail } from "@shared/domain/channel-models"

export function assertChannelExists(detail: ChannelDetail | null, requireEnabled = false) {
  if (!detail) {
    throw new Error("Channel not found")
  }
  if (requireEnabled && !detail.channel.enabled) {
    throw new Error("Channel is disabled")
  }
  return detail
}
