import { createChannelProvider } from "@/electron/app/channels/providers/provider"

export const wechatPersonalChannelProvider = createChannelProvider("wechat_personal", "WeChat Personal", [
  "stream",
  "webhook",
])
