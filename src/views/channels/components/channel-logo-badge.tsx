import type { ChannelConfigRecord } from "@/data/domain/models"
import { cn } from "@/lib/utils"
import { getChannelPlatformBrandClassName } from "@/views/channels/components/channel-branding"
import { getChannelPlatformLogo } from "@/views/channels/components/channel-utils"

type ChannelLogoBadgeProps = {
  channel: Pick<ChannelConfigRecord, "platform" | "customPlatformName">
  className?: string
  iconClassName?: string
}

export function ChannelLogoBadge({ channel, className, iconClassName }: ChannelLogoBadgeProps) {
  const Logo = getChannelPlatformLogo(channel)
  return (
    <span className={cn("flex size-10 items-center justify-center rounded-xl border border-border bg-background", className)}>
      <Logo className={cn("size-5 shrink-0", getChannelPlatformBrandClassName(channel.platform, channel), iconClassName)} />
    </span>
  )
}