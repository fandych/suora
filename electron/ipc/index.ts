import { registerAutomationIpc } from "@electron/ipc/ipc-automation"
import { registerCatalogIpc } from "@electron/ipc/ipc-catalog"
import { registerChannelRuntimeIpc } from "@electron/ipc/ipc-channel-runtime"
import { registerContentIpc } from "@electron/ipc/ipc-content"
import { registerCoreIpc } from "@electron/ipc/ipc-core"
import { registerToolsIpc } from "@electron/ipc/ipc-tools"

export function setupIpc() {
  registerCoreIpc()
  registerContentIpc()
  registerCatalogIpc()
  registerAutomationIpc()
  registerChannelRuntimeIpc()
  registerToolsIpc()
}
