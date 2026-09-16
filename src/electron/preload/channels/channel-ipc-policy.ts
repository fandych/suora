import type { ChannelDetail } from "@/types/channel"

export function assertChannelExists(detail: ChannelDetail | null, requireEnabled = false) {
  if (!detail) {
    throw new Error("Channel not found")
  }
  if (requireEnabled && !detail.channel.enabled) {
    throw new Error("Channel is disabled")
  }
  return detail
}
