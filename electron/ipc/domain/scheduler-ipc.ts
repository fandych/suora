import { ipcMain } from "electron"
import { z } from "zod"
import { createSchedulerWithDrizzle, deleteSchedulerWithDrizzle, getSchedulerWithDrizzle, listSchedulerRunsWithDrizzle, listSchedulersWithDrizzle, saveSchedulerWithDrizzle, setSchedulerEnabledWithDrizzle } from "@electron/database/drizzle/skill-scheduler-repository"
import { entityIdSchema, parseIpcInput, schedulerSaveSchema } from "@electron/ipc/system/ipc-input-schemas"

export function registerSchedulerIpc() {
  ipcMain.handle("schedulers:list", () => listSchedulersWithDrizzle())
  ipcMain.handle("schedulers:get", (_event, id: unknown) => getSchedulerWithDrizzle(parseIpcInput(entityIdSchema, id)))
  ipcMain.handle("schedulers:create", () => createSchedulerWithDrizzle())
  ipcMain.handle("schedulers:save", (_event, value: unknown) => saveSchedulerWithDrizzle(parseIpcInput(schedulerSaveSchema, value)))
  ipcMain.handle("schedulers:setEnabled", (_event, value: unknown) => { const payload = parseIpcInput(z.object({ id: entityIdSchema, enabled: z.boolean() }), value); return setSchedulerEnabledWithDrizzle(payload.id, payload.enabled) })
  ipcMain.handle("schedulers:listRuns", (_event, id: unknown) => listSchedulerRunsWithDrizzle(parseIpcInput(entityIdSchema, id)))
  ipcMain.handle("schedulers:delete", (_event, id: unknown) => deleteSchedulerWithDrizzle(parseIpcInput(entityIdSchema, id)))
}
