import { ipcMain } from "electron"
import { createAgentWithDrizzle, deleteAgentWithDrizzle, getAgentSettingWithDrizzle, getAgentWithDrizzle, listAgentsWithDrizzle, saveAgentSettingWithDrizzle, saveAgentWithDrizzle } from "@electron/database/drizzle/agent-repository"
import { entityIdSchema, parseIpcInput, versionedResourceSaveSchema } from "@electron/ipc/system/ipc-input-schemas"

export function registerAgentIpc() {
  ipcMain.handle("agents:list", () => listAgentsWithDrizzle())
  ipcMain.handle("agents:get", (_event, value: unknown) => getAgentWithDrizzle(parseIpcInput(entityIdSchema, value)))
  ipcMain.handle("agents:create", () => createAgentWithDrizzle())
  ipcMain.handle("agents:save", (_event, value: unknown) => saveAgentWithDrizzle(parseIpcInput(versionedResourceSaveSchema, value)))
  ipcMain.handle("agents:delete", (_event, value: unknown) => deleteAgentWithDrizzle(parseIpcInput(entityIdSchema, value)))
  ipcMain.handle("agents:getSettings", () => getAgentSettingWithDrizzle("agent_settings"))
  ipcMain.handle("agents:saveSettings", (_event, value: unknown) => saveAgentSettingWithDrizzle("agent_settings", value))
}
