import { createChannelProvider } from "@/electron/app/channels/providers/provider"

export const dingtalkChannelProvider = createChannelProvider("dingtalk", "DingTalk", ["webhook", "stream"])
