import { ipcMain } from "electron"
import { agentService } from "@/electron/app/agents/service"
import {
  agentListSchema,
  entityIdSchema,
  parseIpcInput,
  versionedResourceSaveSchema,
} from "@/electron/preload/system/ipc-input-schemas"

export function registerAgentIpc() {
  ipcMain.handle("agents:list", (_event, value: unknown) => agentService.list(parseIpcInput(agentListSchema, value)))
  ipcMain.handle("agents:get", (_event, value: unknown) => agentService.get(parseIpcInput(entityIdSchema, value)))
  ipcMain.handle("agents:create", () => agentService.create())
  ipcMain.handle("agents:save", (_event, value: unknown) =>
    agentService.save(parseIpcInput(versionedResourceSaveSchema, value)),
  )
  ipcMain.handle("agents:delete", (_event, value: unknown) => agentService.remove(parseIpcInput(entityIdSchema, value)))
  ipcMain.handle("agents:getSettings", () => agentService.getSettings())
  ipcMain.handle("agents:saveSettings", (_event, value: unknown) => agentService.saveSettings(value))
}
