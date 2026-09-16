import { createChannelProvider } from "@/electron/app/channels/providers/provider"

export const customChannelProvider = createChannelProvider("custom", "Custom", ["webhook", "stream"])
