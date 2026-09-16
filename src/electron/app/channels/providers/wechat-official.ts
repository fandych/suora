import { createChannelProvider } from "@/electron/app/channels/providers/provider"

export const wechatOfficialChannelProvider = createChannelProvider("wechat_official", "WeChat Official Account", [
  "webhook",
])
