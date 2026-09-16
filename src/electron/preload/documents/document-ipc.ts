import { ipcMain } from "electron"
import { documentService } from "@/electron/app/documents/service"
import { documentMetadataSchema, documentSaveSchema } from "@/electron/preload/documents/document-ipc-schemas"
import { entityIdSchema, parseIpcInput } from "@/electron/preload/system/ipc-input-schemas"

export function registerDocumentIpc() {
  ipcMain.handle("documents:list", () => documentService.list())
  ipcMain.handle("documents:get", (_event, id: unknown, versionId?: unknown) =>
    documentService.get(
      parseIpcInput(entityIdSchema, id),
      versionId === undefined ? undefined : parseIpcInput(entityIdSchema, versionId),
    ),
  )
  ipcMain.handle("documents:create", () => documentService.create())
  ipcMain.handle("documents:getFileTree", (_event, id: unknown, versionId?: unknown) =>
    documentService.getFileTree(
      parseIpcInput(entityIdSchema, id),
      versionId === undefined ? undefined : parseIpcInput(entityIdSchema, versionId),
    ),
  )
  ipcMain.handle("documents:getFile", (_event, id: unknown, fileId: unknown, versionId?: unknown) =>
    documentService.getFile(
      parseIpcInput(entityIdSchema, id),
      parseIpcInput(entityIdSchema, fileId),
      versionId === undefined ? undefined : parseIpcInput(entityIdSchema, versionId),
    ),
  )
  ipcMain.handle("documents:createWithMetadata", (_event, value: unknown) =>
    documentService.createWithMetadata(parseIpcInput(documentMetadataSchema, value)),
  )
  ipcMain.handle("documents:save", (_event, value: unknown) =>
    documentService.save(parseIpcInput(documentSaveSchema, value)),
  )
  ipcMain.handle("documents:delete", (_event, id: unknown) => documentService.remove(parseIpcInput(entityIdSchema, id)))
}
