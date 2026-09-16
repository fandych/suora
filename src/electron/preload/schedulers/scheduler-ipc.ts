import { ipcMain } from "electron"
import { schedulerService } from "@/electron/app/schedulers/service"
import { parseIpcInput } from "@/electron/preload/system/ipc-input-schemas"
import {
  schedulerEnabledSchema,
  schedulerIdSchema,
  schedulerSaveSchema,
} from "@/electron/preload/schedulers/scheduler-ipc-schemas"

export function registerSchedulerIpc() {
  ipcMain.handle("schedulers:list", () => schedulerService.list())
  ipcMain.handle("schedulers:get", (_event, id: unknown) => schedulerService.get(parseIpcInput(schedulerIdSchema, id)))
  ipcMain.handle("schedulers:create", () => schedulerService.create())
  ipcMain.handle("schedulers:save", (_event, value: unknown) =>
    schedulerService.save(parseIpcInput(schedulerSaveSchema, value)),
  )
  ipcMain.handle("schedulers:setEnabled", (_event, value: unknown) => {
    const payload = parseIpcInput(schedulerEnabledSchema, value)
    return schedulerService.setEnabled(payload.id, payload.enabled)
  })
  ipcMain.handle("schedulers:listRuns", (_event, id: unknown) =>
    schedulerService.listRuns(parseIpcInput(schedulerIdSchema, id)),
  )
  ipcMain.handle("schedulers:delete", (_event, id: unknown) =>
    schedulerService.remove(parseIpcInput(schedulerIdSchema, id)),
  )
}
