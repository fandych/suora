import { ipcMain } from "electron"

import { createWorkflowRows, deleteWorkflowRows, getWorkflowRows, listWorkflowRows, recordWorkflowInvocationRow, saveWorkflowRows } from "@electron/database/workflow-database-repository"
import { entityIdSchema, parseIpcInput, workflowInvocationSchema, workflowSaveSchema } from "@electron/ipc/system/ipc-input-schemas"

export function registerWorkflowIpc() {
  ipcMain.handle("workflows:list", () => listWorkflowRows())
  ipcMain.handle("workflows:get", (_event, workflowId: unknown) => getWorkflowRows(parseIpcInput(entityIdSchema, workflowId)))
  ipcMain.handle("workflows:create", () => createWorkflowRows())
  ipcMain.handle("workflows:save", (_event, value: unknown) => saveWorkflowRows(parseIpcInput(workflowSaveSchema, value)))
  ipcMain.handle("workflows:delete", (_event, workflowId: string) => deleteWorkflowRows(workflowId))
  ipcMain.handle("workflows:recordInvocation", (_event, value: unknown) => recordWorkflowInvocationRow(parseIpcInput(workflowInvocationSchema, value)))
}
