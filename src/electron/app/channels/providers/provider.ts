import type { ChannelConnectionMode, ChannelPlatform } from "@/types/channel"

export type ChannelProvider = {
  platform: ChannelPlatform
  title: string
  connectionModes: readonly ChannelConnectionMode[]
}

export function createChannelProvider(
  platform: ChannelPlatform,
  title: string,
  connectionModes: readonly ChannelConnectionMode[],
): ChannelProvider {
  return { platform, title, connectionModes }
}
