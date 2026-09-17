import { channelApplicationService } from "@/electron/app/channels/application/channel-application-service"
import { ensureChannelCatalog } from "@/electron/app/channels/application/channel-catalog-service"
import { schedulerRuntime } from "@/electron/app/schedulers/runtime"

export interface ElectronApp {
  initialize(): Promise<void>
}

export function createElectronApp(): ElectronApp {
  return {
    async initialize() {
      await ensureChannelCatalog()
      await channelApplicationService.restoreRuntime()
      await schedulerRuntime.start()
    },
  }
}
