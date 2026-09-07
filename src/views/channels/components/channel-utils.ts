import type { ChannelConfigRecord, ChannelPlatform, ChannelStatus } from "@/data/domain/models"
import { cn } from "@/lib/utils"
import { createElement, type ComponentType } from "react"
import { getChannelLogo } from "@/views/channels/components/channel-branding"
import { getChannelPlatformBrandClassName } from "@/views/channels/components/channel-branding"
import {
  buildChannelWebhookUrl as resolveChannelWebhookUrl,
  hasChannelCredentialFootprint as resolveChannelCredentialFootprint,
  inferChannelBindingState as resolveChannelBindingState,
} from "@/lib/channel-config"

export const channelPlatformOptions: Array<{ value: ChannelPlatform; label: string }> = [
  { value: "web", label: "Web" },
  { value: "email", label: "Email" },
  { value: "wechat", label: "WeChat Enterprise" },
  { value: "wechat_personal", label: "WeChat Personal" },
  { value: "wechat_official", label: "WeChat Official Account" },
  { value: "wechat_miniprogram", label: "WeChat Mini Program" },
  { value: "feishu", label: "Feishu" },
  { value: "dingtalk", label: "DingTalk" },
  { value: "telegram", label: "Telegram" },
  { value: "teams", label: "Microsoft Teams" },
  { value: "custom", label: "Custom" },
]

export function getChannelOptionList() {
  const seen = new Set<string>()
  return channelPlatformOptions.filter((item) => {
    if (seen.has(item.label)) {
      return false
    }
    seen.add(item.label)
    return true
  })
}

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

export function getChannelPlatformLogo(channel: Pick<ChannelConfigRecord, "platform" | "customPlatformName">) {
  return getChannelLogo(channel.platform, channel)
}

export function getChannelPlatformSidebarLogo(
  channel: Pick<ChannelConfigRecord, "platform" | "customPlatformName">
): ComponentType<{ className?: string }> {
  const Logo = getChannelPlatformLogo(channel)
  const brandClassName = getChannelPlatformBrandClassName(channel.platform, channel)

  return function ChannelSidebarLogo({ className }: { className?: string }) {
    return createElement(Logo, {
      className: cn(brandClassName, className),
    })
  }
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