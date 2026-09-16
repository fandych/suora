import { channelApplicationService } from "@/electron/app/channels/application/channel-application-service"
import { ensureChannelCatalog } from "@/electron/app/channels/application/channel-catalog-service"

export interface ElectronApp {
  initialize(): Promise<void>
}

export function createElectronApp(): ElectronApp {
  return {
    async initialize() {
      await ensureChannelCatalog()
      await channelApplicationService.restoreRuntime()
    },
  }
}
