import type { ChannelConfigRecord, ChannelPlatform, ChannelStatus } from "@/data/domain/models"
import {
  buildChannelWebhookUrl as resolveChannelWebhookUrl,
  hasChannelCredentialFootprint as resolveChannelCredentialFootprint,
  inferChannelBindingState as resolveChannelBindingState,
} from "@/lib/channel-config"

export const channelPlatformOptions: Array<{ value: ChannelPlatform; label: string }> = [
  { value: "web", label: "Web" },
  { value: "email", label: "Email" },
  { value: "wechat", label: "Enterprise WeChat" },
  { value: "wechat_personal", label: "WeChat Personal" },
  { value: "wechat_official", label: "WeChat Official" },
  { value: "feishu", label: "Feishu" },
  { value: "dingtalk", label: "DingTalk" },
  { value: "telegram", label: "Telegram" },
  { value: "teams", label: "Microsoft Teams" },
  { value: "custom", label: "Custom" },
]

export function getChannelCatalogLabel(channel: ChannelConfigRecord) {
  if (channel.platform === "custom" && channel.customPlatformName?.trim()) {
    return channel.customPlatformName.trim()
  }

  return getChannelPlatformLabel(channel.platform)
}

export function inferChannelBindingState(channel: ChannelConfigRecord): NonNullable<ChannelConfigRecord["bindingState"]> {
  return resolveChannelBindingState(channel)
}

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
  return resolveChannelWebhookUrl(channel)
}

export function hasChannelCredentialFootprint(channel: ChannelConfigRecord) {
  return resolveChannelCredentialFootprint(channel)
}

export function getChannelBindingLabel(bindingState: ChannelConfigRecord["bindingState"]) {
  switch (bindingState) {
    case "connected":
      return "Connected"
    case "ready":
      return "Ready"
    case "draft":
      return "Draft"
    case "error":
      return "Attention"
    default:
      return "Unconfigured"
  }
}

export function getChannelBindingVariant(bindingState: ChannelConfigRecord["bindingState"]): "default" | "secondary" | "destructive" | "outline" {
  switch (bindingState) {
    case "connected":
      return "default"
    case "ready":
      return "outline"
    case "error":
      return "destructive"
    case "draft":
    case "unconfigured":
    default:
      return "secondary"
  }
}