import { registerAutomationIpc } from "@electron/ipc/ipc-automation"
import { registerCatalogIpc } from "@electron/ipc/ipc-catalog"
import { registerContentIpc } from "@electron/ipc/ipc-content"
import { registerCoreIpc } from "@electron/ipc/ipc-core"

export function setupIpc() {
  registerCoreIpc()
  registerContentIpc()
  registerCatalogIpc()
  registerAutomationIpc()
}
