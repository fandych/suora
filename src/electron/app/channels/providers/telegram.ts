import { createChannelProvider } from "@/electron/app/channels/providers/provider"

export const telegramChannelProvider = createChannelProvider("telegram", "Telegram", ["webhook"])
