import { Badge } from "@/components/ui/badge"
import type { ChannelSummary } from "@/data/domain/models"
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { ChannelLogoBadge } from "@/views/channels/components/channel-logo-badge"
import {
  getChannelBindingLabel,
  getChannelBindingVariant,
  getChannelPlatformLabel,
  getChannelStatusLabel,
  getChannelStatusVariant,
} from "@/views/channels/components/channel-utils"

type ChannelCardProps = {
  channel: ChannelSummary
  onOpen: (channelId: string) => void
}

export function ChannelCard({ channel, onOpen }: ChannelCardProps) {
  const providerLabel = channel.customPlatformName?.trim() || getChannelPlatformLabel(channel.platform)

  return (
    <Card
      className="min-w-0 cursor-pointer border-border/70 transition-all duration-150 hover:-translate-y-0.5 hover:border-primary/30 hover:bg-muted/20 hover:shadow-sm"
      onClick={() => onOpen(channel.id)}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault()
          onOpen(channel.id)
        }
      }}
      role="button"
      tabIndex={0}
    >
      <CardHeader className="gap-3 pb-4">
        <div className="flex min-w-0 items-start gap-3">
          <ChannelLogoBadge channel={channel} className="size-10 shrink-0" iconClassName="size-5" />
          <div className="min-w-0 flex-1 space-y-1.5">
            <CardTitle className="truncate text-base">{channel.title}</CardTitle>
            <div className="text-sm text-muted-foreground">{providerLabel}</div>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="rounded-lg border bg-muted/20 px-3 py-2.5">
            <div className="text-xs uppercase tracking-wide text-muted-foreground">Provider</div>
            <div className="mt-1 truncate text-sm font-medium text-foreground">{providerLabel}</div>
          </div>
          <div className="rounded-lg border bg-muted/20 px-3 py-2.5">
            <div className="text-xs uppercase tracking-wide text-muted-foreground">Messages</div>
            <div className="mt-1 truncate text-sm font-medium text-foreground">{channel.messageCount}</div>
          </div>
        </div>
      </CardContent>
      <CardFooter className="flex flex-wrap justify-end gap-2 pt-0">
        <Badge variant="outline">{providerLabel}</Badge>
        <Badge variant={getChannelBindingVariant(channel.bindingState)}>{getChannelBindingLabel(channel.bindingState)}</Badge>
        <Badge variant={getChannelStatusVariant(channel.status)}>{getChannelStatusLabel(channel.status)}</Badge>
      </CardFooter>
    </Card>
  )
}