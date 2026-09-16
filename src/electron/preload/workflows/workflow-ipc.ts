import { ipcMain } from "electron"
import { workflowService } from "@/electron/app/workflows/service"
import { entityIdSchema, parseIpcInput } from "@/electron/preload/system/ipc-input-schemas"
import { workflowInvocationSchema, workflowSaveSchema } from "@/electron/preload/workflows/workflow-ipc-schemas"

export function registerWorkflowIpc() {
  ipcMain.handle("workflows:list", () => workflowService.list())
  ipcMain.handle("workflows:get", (_event, workflowId: unknown) =>
    workflowService.get(parseIpcInput(entityIdSchema, workflowId)),
  )
  ipcMain.handle("workflows:create", () => workflowService.create())
  ipcMain.handle("workflows:save", (_event, value: unknown) =>
    workflowService.save(parseIpcInput(workflowSaveSchema, value)),
  )
  ipcMain.handle("workflows:delete", (_event, workflowId: unknown) =>
    workflowService.remove(parseIpcInput(entityIdSchema, workflowId)),
  )
  ipcMain.handle("workflows:recordInvocation", (_event, value: unknown) =>
    workflowService.recordInvocation(parseIpcInput(workflowInvocationSchema, value)),
  )
}
