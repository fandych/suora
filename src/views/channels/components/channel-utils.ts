import type { ChannelConfigRecord, ChannelPlatform, ChannelStatus } from "@/data/domain/models"

export const channelPlatformOptions: Array<{ value: ChannelPlatform; label: string }> = [
  { value: "web", label: "Web" },
  { value: "email", label: "Email" },
  { value: "wechat_personal", label: "WeChat Personal" },
  { value: "wechat_official", label: "WeChat Official" },
  { value: "slack", label: "Slack" },
  { value: "telegram", label: "Telegram" },
  { value: "discord", label: "Discord" },
  { value: "teams", label: "Microsoft Teams" },
  { value: "custom", label: "Custom" },
]

export function getChannelPlatformLabel(platform: ChannelPlatform) {
  return channelPlatformOptions.find((item) => item.value === platform)?.label ?? platform
}

export function getChannelStatusLabel(status: ChannelStatus) {
  switch (status) {
    case "active":
      return "Active"
    case "error":
      return "Error"
    default:
      return "Inactive"
  }
}

export function getChannelStatusVariant(status: ChannelStatus): "default" | "secondary" | "destructive" | "outline" {
  switch (status) {
    case "active":
      return "default"
    case "error":
      return "destructive"
    default:
      return "secondary"
  }
}

export function buildChannelWebhookUrl(channel: ChannelConfigRecord) {
  if (channel.connectionMode === "stream") {
    return "Stream transport"
  }

  const normalizedPath = channel.webhookPath.startsWith("/") ? channel.webhookPath : `/${channel.webhookPath}`
  return `https://local.suora.test${normalizedPath}`
}

export function hasChannelCredentialFootprint(channel: ChannelConfigRecord) {
  switch (channel.platform) {
    case "email":
      return Boolean(channel.emailImapHost && channel.emailImapUser)
    case "wechat_personal":
      return Boolean(channel.wechatPersonalWebhookUrl || channel.wechatPersonalBotToken)
    case "wechat_official":
      return Boolean(channel.wechatOfficialAppId && channel.wechatOfficialToken)
    case "slack":
      return Boolean(channel.slackBotToken)
    case "telegram":
      return Boolean(channel.telegramBotToken)
    case "discord":
      return Boolean(channel.discordBotToken)
    case "teams":
      return Boolean(channel.teamsAppId && channel.teamsAppPassword)
    case "custom":
      return Boolean(channel.customWebhookUrl)
    case "web":
    default:
      return true
  }
}