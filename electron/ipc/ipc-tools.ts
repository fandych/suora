import fs from "node:fs/promises"
import path from "node:path"
import { spawn } from "node:child_process"

import { ipcMain, shell } from "electron"

import { ensureWorkspace } from "@electron/others/workspace"
import { getWorkspacePath } from "@electron/others/paths"

function resolveWorkspaceTarget(relativePath = ".") {
  const workspaceRoot = path.resolve(getWorkspacePath())
  const target = path.resolve(workspaceRoot, relativePath)
  if (target !== workspaceRoot && !target.startsWith(`${workspaceRoot}${path.sep}`)) {
    throw new Error("Path must stay within the workspace root.")
  }
  return target
}

export function registerToolsIpc() {
  ipcMain.handle("tools:listFiles", async (_event, relativePath?: string) => {
    await ensureWorkspace()
    const target = resolveWorkspaceTarget(relativePath)
    const entries = await fs.readdir(target, { withFileTypes: true })
    return entries.map((entry) => ({
      name: entry.name,
      path: path.relative(resolveWorkspaceTarget(), path.join(target, entry.name)).replace(/\\/g, "/"),
      type: entry.isDirectory() ? "directory" : "file",
    }))
  })

  ipcMain.handle("tools:readFile", async (_event, relativePath: string) => {
    await ensureWorkspace()
    const target = resolveWorkspaceTarget(relativePath)
    return {
      path: path.relative(resolveWorkspaceTarget(), target).replace(/\\/g, "/"),
      content: await fs.readFile(target, "utf8"),
    }
  })

  ipcMain.handle("tools:writeFile", async (_event, payload: { path: string; content: string }) => {
    await ensureWorkspace()
    const target = resolveWorkspaceTarget(payload.path)
    await fs.mkdir(path.dirname(target), { recursive: true })
    await fs.writeFile(target, payload.content, "utf8")
    return {
      ok: true,
      path: path.relative(resolveWorkspaceTarget(), target).replace(/\\/g, "/"),
    }
  })

  ipcMain.handle("tools:runCommand", async (_event, payload: { command: string; cwd?: string; timeoutMs?: number }) => {
    await ensureWorkspace()
    const cwd = resolveWorkspaceTarget(payload.cwd)
    const timeoutMs = Math.max(1000, Math.min(payload.timeoutMs ?? 30_000, 120_000))

    return await new Promise<{ ok: boolean; exitCode: number | null; stdout: string; stderr: string }>((resolve) => {
      const child = spawn(payload.command, { cwd, shell: true })
      const stdout: Buffer[] = []
      const stderr: Buffer[] = []
      const timer = setTimeout(() => {
        child.kill()
        resolve({
          ok: false,
          exitCode: null,
          stdout: Buffer.concat(stdout).toString("utf8"),
          stderr: `${Buffer.concat(stderr).toString("utf8")}\nCommand timed out after ${timeoutMs}ms.`,
        })
      }, timeoutMs)

      child.stdout.on("data", (chunk) => stdout.push(Buffer.from(chunk)))
      child.stderr.on("data", (chunk) => stderr.push(Buffer.from(chunk)))
      child.on("close", (code) => {
        clearTimeout(timer)
        resolve({
          ok: code === 0,
          exitCode: code,
          stdout: Buffer.concat(stdout).toString("utf8"),
          stderr: Buffer.concat(stderr).toString("utf8"),
        })
      })
      child.on("error", (error) => {
        clearTimeout(timer)
        resolve({ ok: false, exitCode: 1, stdout: Buffer.concat(stdout).toString("utf8"), stderr: error.message })
      })
    })
  })

  ipcMain.handle("tools:openExternal", async (_event, url: string) => {
    await shell.openExternal(url)
    return { ok: true, url }
  })
}