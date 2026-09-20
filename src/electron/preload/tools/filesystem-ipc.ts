import { constants as fsConstants } from "node:fs"
import fs from "node:fs/promises"
import path from "node:path"
import { ipcMain } from "electron"
import { appState } from "@/electron/infrastructure/app-state"
import {
  ensureFileSizeWithinLimit,
  MAX_TOOL_FILE_BYTES,
  MAX_TOOL_WRITE_BYTES,
} from "@/electron/app/tools/tool-guardrails"
import { ensureWorkspace } from "@/electron/infrastructure/workspace-service"
import { resolveWorkspaceTarget, enforceRelativePathPolicy } from "@/electron/app/tools/tool-policy"
import {
  parseFilesystemInput,
  readPathSchema,
  relativePathSchema,
  saveFileSchema,
  writeFileSchema,
} from "@/electron/preload/tools/filesystem-ipc-schemas"

const NOFOLLOW_FLAG = process.platform === "win32" ? 0 : fsConstants.O_NOFOLLOW

async function assertRealPath(target: string) {
  const stats = await fs.lstat(target)
  if (stats.isSymbolicLink()) throw new Error("Symbolic links are not allowed for filesystem tools.")
  return stats
}

async function assertPathHasNoSymlinkSegments(target: string, allowMissingLeaf = false) {
  const workspaceRoot = path.resolve(resolveWorkspaceTarget())
  const absoluteTarget = path.resolve(target)
  const relativeTarget = path.relative(workspaceRoot, absoluteTarget)
  if (relativeTarget.startsWith("..") || path.isAbsolute(relativeTarget)) {
    throw new Error("Filesystem target must stay within the workspace root.")
  }
  if (!relativeTarget) {
    return
  }
  let current = workspaceRoot
  const segments = relativeTarget.split(path.sep).filter(Boolean)
  for (let index = 0; index < segments.length; index += 1) {
    current = path.join(current, segments[index])
    try {
      await assertRealPath(current)
    } catch (error) {
      const code = (error as NodeJS.ErrnoException).code
      const isLeaf = index === segments.length - 1
      if (code === "ENOENT" && (allowMissingLeaf || !isLeaf)) {
        return
      }
      throw error
    }
  }
}

async function resolveVerifiedPath(target: string) {
  const workspaceRoot = await fs.realpath(resolveWorkspaceTarget())
  const resolvedTarget = await fs.realpath(target)
  const relativeTarget = path.relative(workspaceRoot, resolvedTarget)
  if (relativeTarget.startsWith("..") || path.isAbsolute(relativeTarget)) {
    throw new Error("Filesystem target must stay within the workspace root.")
  }
  return resolvedTarget
}

export function registerFilesystemIpc() {
  ipcMain.handle("tools:listFiles", async (_event, relativePath?: string) => {
    const input = parseFilesystemInput(relativePathSchema, relativePath)
    await ensureWorkspace()
    const target = resolveWorkspaceTarget(input)
    await enforceRelativePathPolicy(input, target)
    await assertPathHasNoSymlinkSegments(target)
    await assertRealPath(target)
    const resolvedTarget = await resolveVerifiedPath(target)
    return (await fs.readdir(resolvedTarget, { withFileTypes: true })).map((entry) => ({
      name: entry.name,
      path: path.relative(resolveWorkspaceTarget(), path.join(resolvedTarget, entry.name)).replace(/\\/g, "/"),
      type: entry.isDirectory() ? "directory" : "file",
    }))
  })
  ipcMain.handle("tools:readFile", async (_event, relativePath: string) => {
    const input = parseFilesystemInput(readPathSchema, relativePath)
    await ensureWorkspace()
    const target = resolveWorkspaceTarget(input)
    await enforceRelativePathPolicy(input, target)
    await assertPathHasNoSymlinkSegments(target)
    await assertRealPath(target)
    const resolvedTarget = await resolveVerifiedPath(target)
    const handle = await fs.open(resolvedTarget, fsConstants.O_RDONLY | NOFOLLOW_FLAG)
    try {
      const stats = await handle.stat()
      ensureFileSizeWithinLimit(stats.size, `File '${input}'`, MAX_TOOL_FILE_BYTES)
      return {
        path: path.relative(resolveWorkspaceTarget(), resolvedTarget).replace(/\\/g, "/"),
        content: await handle.readFile("utf8"),
      }
    } finally {
      await handle.close()
    }
  })
  ipcMain.handle("tools:writeFile", async (_event, payload: unknown) => {
    const input = parseFilesystemInput(writeFileSchema, payload)
    await ensureWorkspace()
    const target = resolveWorkspaceTarget(input.path)
    await enforceRelativePathPolicy(input.path, target)
    const parentDirectory = path.dirname(target)
    await assertPathHasNoSymlinkSegments(parentDirectory, true)
    try {
      await assertPathHasNoSymlinkSegments(target, true)
      await assertRealPath(target)
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error
    }
    ensureFileSizeWithinLimit(
      Buffer.byteLength(input.content, "utf8"),
      `Write payload for '${input.path}'`,
      MAX_TOOL_WRITE_BYTES,
    )
    await fs.mkdir(parentDirectory, { recursive: true })
    await assertPathHasNoSymlinkSegments(parentDirectory)
    const resolvedParentDirectory = await resolveVerifiedPath(parentDirectory)
    const tempPath = path.join(
      resolvedParentDirectory,
      `.suora-write-${process.pid}-${Date.now()}-${Math.random().toString(16).slice(2)}.tmp`,
    )
    try {
      const handle = await fs.open(tempPath, fsConstants.O_CREAT | fsConstants.O_EXCL | fsConstants.O_WRONLY | NOFOLLOW_FLAG)
      try {
        await handle.writeFile(input.content, { encoding: "utf8" })
      } finally {
        await handle.close()
      }
      await assertPathHasNoSymlinkSegments(tempPath)
      await assertPathHasNoSymlinkSegments(resolvedParentDirectory)
      await fs.rename(tempPath, target)
    } catch (error) {
      await fs.rm(tempPath, { force: true }).catch(() => undefined)
      throw error
    }
    return { ok: true, path: path.relative(resolveWorkspaceTarget(), target).replace(/\\/g, "/") }
  })
  ipcMain.handle("tools:saveFile", async (_event, payload: unknown) => {
    const input = parseFilesystemInput(saveFileSchema, payload)
    const browserWindow = appState.mainWindow ?? undefined
    const { dialog, app } = await import("electron")
    const options = {
      defaultPath: path.join(app.getPath("documents"), path.basename(input.defaultName)),
      filters: input.filters,
    }
    const result = browserWindow ? await dialog.showSaveDialog(browserWindow, options) : await dialog.showSaveDialog(options)
    if (result.canceled || !result.filePath) return { ok: true, canceled: true, path: null }
    await fs.writeFile(result.filePath, Buffer.from(input.dataBase64, "base64"))
    return { ok: true, canceled: false, path: result.filePath }
  })
}
