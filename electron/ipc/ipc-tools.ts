import fs from "node:fs/promises"
import path from "node:path"
import { spawn } from "node:child_process"

import { app, dialog, ipcMain, shell } from "electron"

import { appState } from "@electron/others/app-state"
import { getBrowserWindowState, navigateBrowserWindow } from "@electron/others/browser-window"
import { ensureFileSizeWithinLimit, MAX_COMMAND_OUTPUT_BYTES, MAX_TOOL_FILE_BYTES, MAX_TOOL_WRITE_BYTES, parseWorkspaceCommand } from "@electron/others/tool-guardrails"
import { ensureWorkspace } from "@electron/others/workspace"
import { getWorkspacePath } from "@electron/others/paths"
import { applyMigrations, openDatabase } from "@electron/database/db-core"

type PreferenceCommandConfirmationMode = "daily" | "never" | "always"
type PreferenceFileAccessPolicy = "allowlist" | "denylist"

type ToolPreferenceSettings = {
  commandConfirmationMode?: PreferenceCommandConfirmationMode
  fileAccessPolicy?: PreferenceFileAccessPolicy
  fileAccessDirectories?: string[]
  commandAllowlist?: string[]
  commandBlacklist?: string[]
  globalEnvironmentVariables?: Array<{ key?: string; value?: string }>
}

function readToolPreferences(): ToolPreferenceSettings {
  const database = openDatabase()
  applyMigrations(database)
  const row = database.prepare("SELECT value FROM app_meta WHERE key = 'preference_settings'").get() as { value?: string } | undefined

  if (!row?.value) {
    return {}
  }

  try {
    return JSON.parse(row.value) as ToolPreferenceSettings
  } catch {
    return {}
  }
}

function normalizeRuleList(value: unknown) {
  if (!Array.isArray(value)) {
    return []
  }

  return value.filter((item): item is string => typeof item === "string").map((item) => item.trim().toLowerCase()).filter(Boolean)
}

function enforceRelativePathPolicy(relativePath: string | undefined, target: string) {
  const preferences = readToolPreferences()
  const workspaceRoot = path.resolve(getWorkspacePath())
  const targetRelativePath = path.relative(workspaceRoot, target).replace(/\\/g, "/").toLowerCase()
  const rules = normalizeRuleList(preferences.fileAccessDirectories)
  const policy = preferences.fileAccessPolicy === "allowlist" ? "allowlist" : "denylist"

  if (rules.length === 0) {
    return
  }

  const matchesRule = rules.some((rule) => {
    const normalizedRule = rule.replace(/^\.\//, "").replace(/\/$/, "")
    if (normalizedRule === ".") {
      return targetRelativePath === ""
    }
    return targetRelativePath === normalizedRule || targetRelativePath.startsWith(`${normalizedRule}/`)
  })

  if (policy === "allowlist" && !matchesRule) {
    throw new Error(`Access to '${relativePath ?? "."}' is outside the allowed directories.`)
  }

  if (policy === "denylist" && matchesRule) {
    throw new Error(`Access to '${relativePath ?? "."}' is blocked by the file access policy.`)
  }
}

function enforceCommandPolicy(command: string, executableName: string) {
  const preferences = readToolPreferences()
  const normalizedCommand = command.trim().toLowerCase()
  const allowlist = normalizeRuleList(preferences.commandAllowlist)
  const blacklist = normalizeRuleList(preferences.commandBlacklist)

  if (allowlist.length > 0 && !allowlist.includes(executableName.toLowerCase())) {
    throw new Error(`Command blocked by allowlist: ${executableName}`)
  }

  const blocked = blacklist.find((entry) => normalizedCommand.includes(entry))
  if (blocked) {
    throw new Error(`Command blocked by preferences: ${blocked}`)
  }
}

function resolveCommandEnvironment(preferences: ToolPreferenceSettings) {
  const entries = Array.isArray(preferences.globalEnvironmentVariables)
    ? preferences.globalEnvironmentVariables
    : []

  return Object.fromEntries(
    entries
      .map((item) => {
        const key = typeof item?.key === "string" ? item.key.trim() : ""
        const value = typeof item?.value === "string" ? item.value : ""
        return key ? [key, value] : null
      })
      .filter((item): item is [string, string] => Array.isArray(item))
  )
}

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
    enforceRelativePathPolicy(relativePath, target)
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
    enforceRelativePathPolicy(relativePath, target)
    const stats = await fs.stat(target)
    ensureFileSizeWithinLimit(stats.size, `File '${relativePath}'`, MAX_TOOL_FILE_BYTES)
    return {
      path: path.relative(resolveWorkspaceTarget(), target).replace(/\\/g, "/"),
      content: await fs.readFile(target, "utf8"),
    }
  })

  ipcMain.handle("tools:writeFile", async (_event, payload: { path: string; content: string }) => {
    await ensureWorkspace()
    const target = resolveWorkspaceTarget(payload.path)
    enforceRelativePathPolicy(payload.path, target)
    ensureFileSizeWithinLimit(Buffer.byteLength(payload.content, "utf8"), `Write payload for '${payload.path}'`, MAX_TOOL_WRITE_BYTES)
    await fs.mkdir(path.dirname(target), { recursive: true })
    await fs.writeFile(target, payload.content, "utf8")
    return {
      ok: true,
      path: path.relative(resolveWorkspaceTarget(), target).replace(/\\/g, "/"),
    }
  })

  ipcMain.handle("tools:runCommand", async (_event, payload: { command: string; cwd?: string; timeoutMs?: number; env?: Record<string, string> }) => {
    await ensureWorkspace()
    const cwd = resolveWorkspaceTarget(payload.cwd)
    enforceRelativePathPolicy(payload.cwd, cwd)
    const parsedCommand = parseWorkspaceCommand(payload.command)
    enforceCommandPolicy(payload.command, parsedCommand.executableName)
    const timeoutMs = Math.max(1000, Math.min(payload.timeoutMs ?? 30_000, 120_000))
    const preferences = readToolPreferences()
    const env = {
      ...process.env,
      ...resolveCommandEnvironment(preferences),
      ...(payload.env ?? {}),
    }

    return await new Promise<{ ok: boolean; exitCode: number | null; stdout: string; stderr: string }>((resolve) => {
      const child = spawn(parsedCommand.executable, parsedCommand.args, { cwd, shell: false, env, windowsHide: true })
      const stdout: Buffer[] = []
      const stderr: Buffer[] = []
      let combinedOutputBytes = 0
      let isSettled = false

      const finalize = (result: { ok: boolean; exitCode: number | null; stdout: string; stderr: string }) => {
        if (isSettled) {
          return
        }

        isSettled = true
        clearTimeout(timer)
        resolve(result)
      }

      const handleChunk = (collection: Buffer[], chunk: Buffer | string) => {
        const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)
        combinedOutputBytes += buffer.byteLength
        collection.push(buffer)
        if (combinedOutputBytes > MAX_COMMAND_OUTPUT_BYTES) {
          child.kill()
          finalize({
            ok: false,
            exitCode: null,
            stdout: Buffer.concat(stdout).toString("utf8"),
            stderr: `${Buffer.concat(stderr).toString("utf8")}\nCommand output exceeded the 256 KB safety limit.`,
          })
        }
      }

      const timer = setTimeout(() => {
        child.kill()
        finalize({
          ok: false,
          exitCode: null,
          stdout: Buffer.concat(stdout).toString("utf8"),
          stderr: `${Buffer.concat(stderr).toString("utf8")}\nCommand timed out after ${timeoutMs}ms.`,
        })
      }, timeoutMs)

      child.stdout.on("data", (chunk) => handleChunk(stdout, chunk))
      child.stderr.on("data", (chunk) => handleChunk(stderr, chunk))
      child.on("close", (code) => {
        finalize({
          ok: code === 0,
          exitCode: code,
          stdout: Buffer.concat(stdout).toString("utf8"),
          stderr: Buffer.concat(stderr).toString("utf8"),
        })
      })
      child.on("error", (error) => {
        finalize({ ok: false, exitCode: 1, stdout: Buffer.concat(stdout).toString("utf8"), stderr: error.message })
      })
    })
  })

  ipcMain.handle("tools:openExternal", async (_event, url: string) => {
    await shell.openExternal(url)
    return { ok: true, url }
  })

  ipcMain.handle("tools:browserNavigate", async (_event, payload: { url?: string; visible?: boolean }) => {
    return await navigateBrowserWindow(payload)
  })

  ipcMain.handle("tools:browserState", async () => getBrowserWindowState())

  ipcMain.handle("tools:saveFile", async (_event, payload: { defaultName: string; filters?: Array<{ name: string; extensions: string[] }>; dataBase64: string }) => {
    const browserWindow = appState.mainWindow ?? undefined
    const result = await dialog.showSaveDialog(browserWindow, {
      defaultPath: path.join(app.getPath("documents"), payload.defaultName),
      filters: payload.filters,
    })

    if (result.canceled || !result.filePath) {
      return { ok: true, canceled: true, path: null }
    }

    const buffer = Buffer.from(payload.dataBase64, "base64")
    await fs.writeFile(result.filePath, buffer)
    return { ok: true, canceled: false, path: result.filePath }
  })
}