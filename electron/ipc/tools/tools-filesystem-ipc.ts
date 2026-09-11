import fs from "node:fs/promises"
import path from "node:path"
import { ipcMain } from "electron"
import { appState } from "@electron/others/infrastructure/app-state"
import { ensureFileSizeWithinLimit, MAX_TOOL_FILE_BYTES, MAX_TOOL_WRITE_BYTES } from "@electron/others/infrastructure/tool-guardrails"
import { ensureWorkspace } from "@electron/others/infrastructure/workspace-service"
import { resolveWorkspaceTarget, enforceRelativePathPolicy } from "@electron/ipc/tools/tools-policy"
import { parseFilesystemInput, readPathSchema, relativePathSchema, saveFileSchema, writeFileSchema } from "@electron/ipc/tools/tools-filesystem-schemas"

async function assertRealPath(target: string) {
  const stats = await fs.lstat(target)
  if (stats.isSymbolicLink()) throw new Error("Symbolic links are not allowed for filesystem tools.")
  return stats
}
export function registerToolFilesystemIpc() {
  ipcMain.handle("tools:listFiles", async (_event, relativePath?: string) => { const input = parseFilesystemInput(relativePathSchema, relativePath); await ensureWorkspace(); const target = resolveWorkspaceTarget(input); enforceRelativePathPolicy(input, target); await assertRealPath(target); return (await fs.readdir(target, { withFileTypes: true })).map((entry) => ({ name: entry.name, path: path.relative(resolveWorkspaceTarget(), path.join(target, entry.name)).replace(/\\/g, "/"), type: entry.isDirectory() ? "directory" : "file" })) })
  ipcMain.handle("tools:readFile", async (_event, relativePath: string) => { const input = parseFilesystemInput(readPathSchema, relativePath); await ensureWorkspace(); const target = resolveWorkspaceTarget(input); enforceRelativePathPolicy(input, target); const stats = await assertRealPath(target); ensureFileSizeWithinLimit(stats.size, `File '${input}'`, MAX_TOOL_FILE_BYTES); return { path: path.relative(resolveWorkspaceTarget(), target).replace(/\\/g, "/"), content: await fs.readFile(target, "utf8") } })
  ipcMain.handle("tools:writeFile", async (_event, payload: unknown) => { const input = parseFilesystemInput(writeFileSchema, payload); await ensureWorkspace(); const target = resolveWorkspaceTarget(input.path); enforceRelativePathPolicy(input.path, target); try { await assertRealPath(target) } catch (error) { if ((error as Error).code !== "ENOENT") throw error } ensureFileSizeWithinLimit(Buffer.byteLength(input.content, "utf8"), `Write payload for '${input.path}'`, MAX_TOOL_WRITE_BYTES); await fs.mkdir(path.dirname(target), { recursive: true }); await fs.writeFile(target, input.content, "utf8", { flag: "w" }); return { ok: true, path: path.relative(resolveWorkspaceTarget(), target).replace(/\\/g, "/") } })
  ipcMain.handle("tools:saveFile", async (_event, payload: unknown) => { const input = parseFilesystemInput(saveFileSchema, payload); const browserWindow = appState.mainWindow ?? undefined; const { dialog, app } = await import("electron"); const result = await dialog.showSaveDialog(browserWindow, { defaultPath: path.join(app.getPath("documents"), path.basename(input.defaultName)), filters: input.filters }); if (result.canceled || !result.filePath) return { ok: true, canceled: true, path: null }; await fs.writeFile(result.filePath, Buffer.from(input.dataBase64, "base64")); return { ok: true, canceled: false, path: result.filePath } })
}
