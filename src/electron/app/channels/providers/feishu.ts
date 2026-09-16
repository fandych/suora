import { createChannelProvider } from "@/electron/app/channels/providers/provider"

export const feishuChannelProvider = createChannelProvider("feishu", "Feishu", ["webhook"])
