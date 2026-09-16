import { createChannelProvider } from "@/electron/app/channels/providers/provider"

export const emailChannelProvider = createChannelProvider("email", "Email", ["webhook", "stream"])
