import {
  MessageCircleMoreIcon,
  MessageSquareCodeIcon,
  MessageSquareDashedIcon,
  RssIcon,
} from "lucide-react"
import {
  siQq,
  siTelegram,
  siWechat,
  type SimpleIcon,
} from "simple-icons"

import type { ChannelConfigRecord, ChannelPlatform } from "@/data/domain/models"
import { cn } from "@/lib/utils"

type ChannelLogoProps = {
  className?: string
}

function BrandSvg({ icon, className }: { icon: SimpleIcon; className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden="true">
      <path d={icon.path} />
    </svg>
  )
}

function LetterLogo({ letters, className }: { letters: string; className?: string }) {
  return <span className={cn("inline-flex items-center justify-center font-semibold", className)}>{letters}</span>
}

export const WeChatLogo = ({ className }: ChannelLogoProps) => <BrandSvg icon={siWechat} className={className} />
export const FeishuLogo = ({ className }: ChannelLogoProps) => <LetterLogo letters="FS" className={className} />
export const TelegramLogo = ({ className }: ChannelLogoProps) => <BrandSvg icon={siTelegram} className={className} />
export const QqLogo = ({ className }: ChannelLogoProps) => <BrandSvg icon={siQq} className={className} />
export const EmailLogo = ({ className }: ChannelLogoProps) => <MessageCircleMoreIcon className={className} />
export const TeamsLogo = ({ className }: ChannelLogoProps) => <LetterLogo letters="TM" className={className} />
export const DingTalkLogo = ({ className }: ChannelLogoProps) => <LetterLogo letters="DT" className={className} />
export const CustomChannelLogo = ({ className }: ChannelLogoProps) => <MessageSquareCodeIcon className={className} />
export const WebChannelLogo = ({ className }: ChannelLogoProps) => <RssIcon className={className} />
export const UnknownChannelLogo = ({ className }: ChannelLogoProps) => <MessageSquareDashedIcon className={className} />

export function getChannelPlatformBrandClassName(platform: ChannelPlatform, channel?: Pick<ChannelConfigRecord, "customPlatformName">) {
  if (platform === "custom" && channel?.customPlatformName?.trim().toLowerCase() === "qq") {
    return "text-sky-500"
  }

  switch (platform) {
    case "wechat":
    case "wechat_personal":
    case "wechat_official":
    case "wechat_miniprogram":
      return "text-emerald-600"
    case "feishu":
      return "text-sky-500"
    case "dingtalk":
      return "text-orange-500"
    case "telegram":
      return "text-sky-500"
    case "teams":
      return "text-indigo-600"
    case "email":
      return "text-amber-600"
    case "custom":
      return "text-rose-600"
    case "web":
      return "text-slate-500"
    default:
      return "text-slate-500"
  }
}

export function getChannelLogo(platform: ChannelPlatform, channel?: Pick<ChannelConfigRecord, "customPlatformName">) {
  if (platform === "custom" && channel?.customPlatformName?.trim().toLowerCase() === "qq") {
    return QqLogo
  }

  switch (platform) {
    case "wechat":
    case "wechat_personal":
    case "wechat_official":
    case "wechat_miniprogram":
      return WeChatLogo
    case "feishu":
      return FeishuLogo
    case "dingtalk":
      return DingTalkLogo
    case "telegram":
      return TelegramLogo
    case "teams":
      return TeamsLogo
    case "email":
      return EmailLogo
    case "custom":
      return CustomChannelLogo
    case "web":
      return WebChannelLogo
    default:
      return UnknownChannelLogo
  }
}

