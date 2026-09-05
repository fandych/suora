import { cn } from "@/lib/utils"
import type { ChannelConfigRecord } from "@/data/domain/models"
import { getChannelPlatformBrandClassName } from "@/views/channels/components/channel-branding"
import { getChannelOptionList, getChannelPlatformLogo } from "@/views/channels/components/channel-utils"
import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger } from "@/components/ui/select"

const groupedChannelPlatformOptions: Array<{ label: string; values: ChannelConfigRecord["platform"][] }> = [
  { label: "Chinese platforms", values: ["feishu", "dingtalk", "wechat", "wechat_personal", "wechat_official", "wechat_miniprogram"] },
  { label: "International platforms", values: ["telegram", "teams", "email"] },
  { label: "Other", values: ["web", "custom"] },
]

type ChannelPlatformSelectProps = {
  channel: ChannelConfigRecord
  onChange: (platform: ChannelConfigRecord["platform"]) => void
}

export function ChannelPlatformSelect({ channel, onChange }: ChannelPlatformSelectProps) {
  const platformOptions = getChannelOptionList()
  const selectedLabel = channel.customPlatformName?.trim() || platformOptions.find((item) => item.value === channel.platform)?.label || channel.platform
  const SelectedLogo = getChannelPlatformLogo(channel)

  return (
    <Select value={channel.platform} onValueChange={(value) => onChange(value as ChannelConfigRecord["platform"])}>
      <SelectTrigger className="w-full justify-start">
        <span className="flex min-w-0 flex-1 items-center gap-2">
          <SelectedLogo className={cn("size-4 shrink-0", getChannelPlatformBrandClassName(channel.platform, channel))} />
          <span className="truncate">{selectedLabel}</span>
        </span>
      </SelectTrigger>
      <SelectContent align="start">
        {groupedChannelPlatformOptions.map((group) => (
          <SelectGroup key={group.label}>
            <SelectLabel>{group.label}</SelectLabel>
            {group.values.map((value) => {
              const item = platformOptions.find((candidate) => candidate.value === value)
              if (!item) {
                return null
              }

              const OptionLogo = getChannelPlatformLogo({ platform: item.value, customPlatformName: item.label === "QQ" ? "QQ" : undefined })
              return (
                <SelectItem key={`${group.label}-${item.label}`} value={item.value}>
                  <OptionLogo className={cn("size-4 shrink-0", getChannelPlatformBrandClassName(item.value, { customPlatformName: item.label === "QQ" ? "QQ" : undefined }))} />
                  <span>{item.label}</span>
                </SelectItem>
              )
            })}
          </SelectGroup>
        ))}
      </SelectContent>
    </Select>
  )
}