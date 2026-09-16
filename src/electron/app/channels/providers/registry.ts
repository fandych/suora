import type { ChannelProvider } from "@/electron/app/channels/providers/provider"
import { customChannelProvider } from "@/electron/app/channels/providers/custom"
import { dingtalkChannelProvider } from "@/electron/app/channels/providers/dingtalk"
import { emailChannelProvider } from "@/electron/app/channels/providers/email"
import { feishuChannelProvider } from "@/electron/app/channels/providers/feishu"
import { teamsChannelProvider } from "@/electron/app/channels/providers/teams"
import { telegramChannelProvider } from "@/electron/app/channels/providers/telegram"
import { wechatChannelProvider } from "@/electron/app/channels/providers/wechat"
import { wechatMiniprogramChannelProvider } from "@/electron/app/channels/providers/wechat-miniprogram"
import { wechatOfficialChannelProvider } from "@/electron/app/channels/providers/wechat-official"
import { wechatPersonalChannelProvider } from "@/electron/app/channels/providers/wechat-personal"

export const channelProviders: readonly ChannelProvider[] = [
  wechatPersonalChannelProvider,
  wechatChannelProvider,
  wechatOfficialChannelProvider,
  wechatMiniprogramChannelProvider,
  feishuChannelProvider,
  dingtalkChannelProvider,
  teamsChannelProvider,
  telegramChannelProvider,
  emailChannelProvider,
  customChannelProvider,
]

export function getChannelProvider(platform: string) {
  return channelProviders.find((provider) => provider.platform === platform)
}
