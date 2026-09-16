import { createChannelProvider } from "@/electron/app/channels/providers/provider"

export const wechatChannelProvider = createChannelProvider("wechat", "WeChat Enterprise", ["webhook"])
