import { createChannelProvider } from "@/electron/app/channels/providers/provider"

export const wechatMiniprogramChannelProvider = createChannelProvider("wechat_miniprogram", "WeChat Mini Program", [
  "webhook",
])
