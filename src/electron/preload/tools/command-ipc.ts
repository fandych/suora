import { spawn } from "node:child_process"
import { ipcMain } from "electron"
import {
  MAX_COMMAND_OUTPUT_BYTES,
  parseWorkspaceCommand,
  resolveWorkspaceSpawnCommand,
} from "@/electron/app/tools/tool-guardrails"
import { ensureWorkspace } from "@/electron/infrastructure/workspace-service"
import { enforceCommandPolicy, readToolPreferences, resolveWorkspaceTarget } from "@/electron/app/tools/tool-policy"

export function registerCommandIpc() {
  ipcMain.handle(
    "tools:runCommand",
    async (_event, payload: { command: string; cwd?: string; timeoutMs?: number; env?: Record<string, string> }) => {
      await ensureWorkspace()
      const parsed = parseWorkspaceCommand(payload.command)
      const spawnCommand = resolveWorkspaceSpawnCommand(parsed)
      await enforceCommandPolicy(payload.command, parsed.executableName)
      const cwd = resolveWorkspaceTarget(payload.cwd)
      const preferences = await readToolPreferences()
      const env = {
        ...process.env,
        ...(payload.env ?? {}),
        ...Object.fromEntries(
          (preferences.globalEnvironmentVariables ?? [])
            .filter((item) => item.key)
            .map((item) => [item.key!, item.value ?? ""]),
        ),
      }
      const timeoutMs = Math.max(1000, Math.min(payload.timeoutMs ?? 30000, 120000))
      return new Promise<{ ok: boolean; exitCode: number | null; stdout: string; stderr: string }>((resolve) => {
        const child = spawn(spawnCommand.executable, spawnCommand.args, {
          cwd,
          shell: spawnCommand.shell,
          env,
          windowsHide: true,
        })
        const stdout: Buffer[] = []
        const stderr: Buffer[] = []
        let bytes = 0
        let settled = false
        const finish = (result: { ok: boolean; exitCode: number | null; stdout: string; stderr: string }) => {
          if (settled) return
          settled = true
          clearTimeout(timer)
          resolve(result)
        }
        const collect = (list: Buffer[], chunk: Buffer) => {
          bytes += chunk.byteLength
          list.push(chunk)
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
            stderr: `Command timed out after ${timeoutMs}ms.`,
          })
        }, timeoutMs)
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
    },
  )
}
