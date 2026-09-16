import { createChannelProvider } from "@/electron/app/channels/providers/provider"

export const teamsChannelProvider = createChannelProvider("teams", "Microsoft Teams", ["webhook"])
