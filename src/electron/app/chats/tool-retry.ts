import { spawn } from "node:child_process"
import fs from "node:fs/promises"
import path from "node:path"
import { shell } from "electron"
import { z } from "zod"
import {
  clickBrowserElement,
  fillBrowserElement,
  getBrowserPageSnapshot,
  navigateBrowserWindow,
} from "@/electron/infrastructure/browser-window"
import {
  ensureFileSizeWithinLimit,
  MAX_COMMAND_OUTPUT_BYTES,
  MAX_TOOL_FILE_BYTES,
  MAX_TOOL_WRITE_BYTES,
  parseWorkspaceCommand,
} from "@/electron/app/tools/tool-guardrails"
import { ensureWorkspace } from "@/electron/infrastructure/workspace-service"
import { assertSafeHttpUrl } from "@/electron/infrastructure/url-security"
import {
  enforceCommandPolicy,
  enforceRelativePathPolicy,
  resolveWorkspaceTarget,
} from "@/electron/app/tools/tool-policy"
import { agentService } from "@/electron/app/agents/service"
import { chatApplicationService } from "@/electron/app/chats/service"
import { integrationApplicationService } from "@/electron/app/integrations/service"

const retryToolSchema = z.object({
  sessionId: z.string().min(1),
  activity: z.object({ toolName: z.string().min(1), input: z.record(z.string(), z.unknown()).optional() }),
})
function stringify(value: unknown) {
  if (typeof value === "string") return value
  try {
    return JSON.stringify(value, null, 2)
  } catch {
    return String(value)
  }
}
function readString(input: Record<string, unknown>, key: string, message: string) {
  const value = input[key]
  if (typeof value !== "string" || !value) throw new Error(message)
  return value
}
async function listFiles(relativePath?: string) {
  await ensureWorkspace()
  const target = resolveWorkspaceTarget(relativePath)
  await enforceRelativePathPolicy(relativePath, target)
  const entries = await fs.readdir(target, { withFileTypes: true })
  return entries.map((entry) => ({
    name: entry.name,
    path: path.relative(resolveWorkspaceTarget(), path.join(target, entry.name)).replace(/\\/g, "/"),
    type: entry.isDirectory() ? "directory" : "file",
  }))
}
async function readFile(relativePath: string) {
  await ensureWorkspace()
  const target = resolveWorkspaceTarget(relativePath)
  await enforceRelativePathPolicy(relativePath, target)
  const stats = await fs.stat(target)
  ensureFileSizeWithinLimit(stats.size, `File '${relativePath}'`, MAX_TOOL_FILE_BYTES)
  return { path: relativePath, content: await fs.readFile(target, "utf8") }
}
async function writeFile(relativePath: string, content: string) {
  await ensureWorkspace()
  const target = resolveWorkspaceTarget(relativePath)
  await enforceRelativePathPolicy(relativePath, target)
  ensureFileSizeWithinLimit(
    Buffer.byteLength(content, "utf8"),
    `Write payload for '${relativePath}'`,
    MAX_TOOL_WRITE_BYTES,
  )
  await fs.mkdir(path.dirname(target), { recursive: true })
  await fs.writeFile(target, content, "utf8")
  return { ok: true, path: relativePath }
}
async function runCommand(command: string, cwd?: string, timeoutMs?: number) {
  await ensureWorkspace()
  const parsed = parseWorkspaceCommand(command)
  await enforceCommandPolicy(command, parsed.executableName)
  const workingDirectory = resolveWorkspaceTarget(cwd)
  const timeout = Math.max(1_000, Math.min(timeoutMs ?? 30_000, 120_000))
  return new Promise<{ ok: boolean; exitCode: number | null; stdout: string; stderr: string }>((resolve) => {
    const child = spawn(parsed.executable, parsed.args, { cwd: workingDirectory, shell: false, windowsHide: true })
    const stdout: Buffer[] = []
    const stderr: Buffer[] = []
    let bytes = 0
    let complete = false
    const finish = (result: { ok: boolean; exitCode: number | null; stdout: string; stderr: string }) => {
      if (complete) return
      complete = true
      clearTimeout(timer)
      resolve(result)
    }
    const collect = (target: Buffer[], chunk: Buffer) => {
      bytes += chunk.byteLength
      target.push(chunk)
      if (bytes > MAX_COMMAND_OUTPUT_BYTES) {
        child.kill()
        finish({
          ok: false,
          exitCode: null,
          stdout: Buffer.concat(stdout).toString(),
          stderr: "Command output exceeded the safety limit.",
        })
      }
    }
    const timer = setTimeout(() => {
      child.kill()
      finish({
        ok: false,
        exitCode: null,
        stdout: Buffer.concat(stdout).toString(),
        stderr: `Command timed out after ${timeout}ms.`,
      })
    }, timeout)
    child.stdout.on("data", (chunk) => collect(stdout, Buffer.from(chunk)))
    child.stderr.on("data", (chunk) => collect(stderr, Buffer.from(chunk)))
    child.on("close", (code) =>
      finish({
        ok: code === 0,
        exitCode: code,
        stdout: Buffer.concat(stdout).toString(),
        stderr: Buffer.concat(stderr).toString(),
      }),
    )
    child.on("error", (error) =>
      finish({ ok: false, exitCode: null, stdout: Buffer.concat(stdout).toString(), stderr: error.message }),
    )
  })
}

export async function retryChatToolActivity(value: unknown) {
  const { sessionId, activity } = retryToolSchema.parse(value)
  const input = activity.input ?? {}
  switch (activity.toolName) {
    case "listWorkspaceFiles":
      return stringify(await listFiles(typeof input.relativePath === "string" ? input.relativePath : undefined))
    case "readWorkspaceFile":
      return stringify(await readFile(readString(input, "path", "Tool input is missing the file path.")))
    case "writeWorkspaceFile":
      return stringify(
        await writeFile(
          readString(input, "path", "Tool input is missing the file path."),
          readString(input, "content", "Tool input is missing the file content."),
        ),
      )
    case "runWorkspaceCommand":
      return stringify(
        await runCommand(
          readString(input, "command", "Tool input is missing the command."),
          typeof input.cwd === "string" ? input.cwd : undefined,
          typeof input.timeoutMs === "number" ? input.timeoutMs : undefined,
        ),
      )
    case "openExternalUrl": {
      const url = await assertSafeHttpUrl(readString(input, "url", "Tool input is missing the URL."))
      await shell.openExternal(url.toString())
      return stringify({ ok: true, url: url.toString() })
    }
    case "browser_navigate":
      return stringify(
        await navigateBrowserWindow({
          sessionId,
          url: typeof input.url === "string" ? input.url : undefined,
          visible: typeof input.visible === "boolean" ? input.visible : false,
        }),
      )
    case "browser_page":
      return stringify(
        await getBrowserPageSnapshot({
          sessionId,
          includeText: input.includeText !== false,
          includeLinks: input.includeLinks === true,
        }),
      )
    case "browser_click":
      return stringify(
        await clickBrowserElement(readString(input, "selector", "Tool input is missing the CSS selector."), sessionId),
      )
    case "browser_fill":
      return stringify(
        await fillBrowserElement(
          readString(input, "selector", "Tool input is missing the selector."),
          readString(input, "value", "Tool input is missing the value."),
          sessionId,
        ),
      )
    case "runIntegration": {
      const integrationId = readString(input, "integrationId", "Tool input is missing the integration ID.")
      const session = await chatApplicationService.getSessionSettings(sessionId)
      const agent = session.selectedAgentId ? await agentService.get(session.selectedAgentId) : null
      const config = agent?.agent
        ? (JSON.parse(agent.versions[0]?.configJson ?? "{}") as { toolsetIds?: string[] })
        : {}
      if (config.toolsetIds?.length && !config.toolsetIds.includes(integrationId))
        throw new Error("The selected agent cannot access this integration.")
      const detail = await integrationApplicationService.get(integrationId)
      if (!detail) throw new Error("Integration was not found.")
      const result = await integrationApplicationService.execute({
        integrationId,
        kind: detail.integration.kind as "http" | "scripts" | "mcp",
        config: detail.config,
        inputJson: typeof input.inputJson === "string" ? input.inputJson : "{}",
      })
      return stringify({ integration: detail.integration.title, ...result })
    }
    default:
      throw new Error(`Retry is not available for ${activity.toolName}.`)
  }
}
