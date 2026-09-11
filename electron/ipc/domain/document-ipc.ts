import { ipcMain } from "electron"
import { createDocumentWithDrizzle, deleteDocumentWithDrizzle, getDocumentWithDrizzle, listDocumentsWithDrizzle, saveDocumentWithDrizzle } from "@electron/database/drizzle/document-model-repository"
import { documentSaveSchema, entityIdSchema, parseIpcInput } from "@electron/ipc/system/ipc-input-schemas"

export function registerDocumentIpc() {
  ipcMain.handle("documents:list", () => listDocumentsWithDrizzle())
  ipcMain.handle("documents:get", (_event, id: unknown, versionId?: unknown) => getDocumentWithDrizzle(parseIpcInput(entityIdSchema, id), versionId === undefined ? undefined : parseIpcInput(entityIdSchema, versionId)))
  ipcMain.handle("documents:create", () => createDocumentWithDrizzle())
  ipcMain.handle("documents:save", (_event, value: unknown) => saveDocumentWithDrizzle(parseIpcInput(documentSaveSchema, value)))
  ipcMain.handle("documents:delete", (_event, id: unknown) => deleteDocumentWithDrizzle(parseIpcInput(entityIdSchema, id)))
}
