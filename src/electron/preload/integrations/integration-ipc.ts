import { ipcMain } from "electron"
import { z } from "zod"
import { ensureWorkspace } from "@/electron/infrastructure/workspace-service"
import { fetchApiDocumentation } from "@/electron/app/integrations/api-documentation"
import { integrationApplicationService } from "@/electron/app/integrations/service"
import {
  integrationCreateSchema,
  integrationEnabledSchema,
  integrationExecuteSchema,
  integrationExecutionRecordSchema,
  integrationIdSchema,
  integrationSaveSchema,
} from "@/electron/preload/integrations/integration-ipc-schemas"

function parseIpcInput<T>(schema: z.ZodType<T>, value: unknown) {
  const result = schema.safeParse(value)
  if (!result.success) throw new Error("Invalid IPC payload.")
  return result.data
}

export function registerIntegrationIpc() {
  ipcMain.handle("integrations:fetchApiDoc", async (_event, url: unknown) => {
    await ensureWorkspace()
    return fetchApiDocumentation(parseIpcInput(z.string().url().max(8192), url))
  })
  ipcMain.handle("integration:execute", (_event, payload: unknown) =>
    integrationApplicationService.execute(parseIpcInput(integrationExecuteSchema, payload)),
  )
  ipcMain.handle("integrations:list", () => integrationApplicationService.list())
  ipcMain.handle("integrations:get", (_event, id: unknown, versionId?: unknown) =>
    integrationApplicationService.get(
      parseIpcInput(integrationIdSchema, id),
      versionId === undefined ? undefined : parseIpcInput(integrationIdSchema, versionId),
    ),
  )
  ipcMain.handle("integrations:create", (_event, payload?: unknown) =>
    integrationApplicationService.create(
      payload === undefined ? undefined : parseIpcInput(integrationCreateSchema, payload),
    ),
  )
  ipcMain.handle("integrations:save", (_event, payload: unknown) =>
    integrationApplicationService.save(parseIpcInput(integrationSaveSchema, payload)),
  )
  ipcMain.handle("integrations:setEnabled", (_event, payload: unknown) =>
    integrationApplicationService.setEnabled(parseIpcInput(integrationEnabledSchema, payload)),
  )
  ipcMain.handle("integrations:delete", (_event, id: unknown) =>
    integrationApplicationService.remove(parseIpcInput(integrationIdSchema, id)),
  )
  ipcMain.handle("integrations:recordExecution", (_event, payload: unknown) =>
    integrationApplicationService.recordExecution(parseIpcInput(integrationExecutionRecordSchema, payload)),
  )
}
