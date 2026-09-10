import { spawn } from "node:child_process"
import { fileURLToPath } from "node:url"

import type { IntegrationExecutePayload } from "@electron/types"

const ALLOWED_SCRIPT_RUNTIMES = new Set(["node", "sandbox", "javascript"])
const BLOCKED_SCRIPT_PATTERNS = [
  /\brequire\s*\(/,
  /\bprocess\b/,
  /\bchild_process\b/,
  /\bfs\b/,
  /\bimport\s*\(/,
  /\bnew\s+Function\b/,
  /\beval\s*\(/,
]
const MAX_SCRIPT_SOURCE_BYTES = 256 * 1024
const MAX_SCRIPT_INPUT_BYTES = 512 * 1024
const MAX_SCRIPT_OUTPUT_BYTES = 1024 * 1024

function normalizeScriptSource(code: string) {
  return code.replace(/^\s*export\s+/gm, "")
}

function assertScriptIsSafe(code: string) {
  const blockedPattern = BLOCKED_SCRIPT_PATTERNS.find((pattern) => pattern.test(code))
  if (blockedPattern) {
    throw new Error("Script contains blocked runtime APIs. Use HTTP or MCP integrations for privileged operations.")
  }
}

export async function executeSandboxedScriptIntegration(payload: IntegrationExecutePayload) {
  const config = payload.config as {
    runtime?: string
    timeoutMs?: number
    scripts?: Array<{ id: string; handler: string; code: string }>
    selectedScriptId?: string
  }

  const runtime = (config.runtime || "node").trim().toLowerCase()
  if (!ALLOWED_SCRIPT_RUNTIMES.has(runtime)) {
    return {
      ok: false,
      status: 400,
      body: `Unsupported script runtime: ${config.runtime || "unknown"}. Allowed values: node, sandbox, javascript.`,
    }
  }

  const selectedScript = config.scripts?.find((item) => item.id === config.selectedScriptId) ?? config.scripts?.[0]
  if (!selectedScript) {
    return {
      ok: false,
      status: 400,
      body: "No script entry is configured.",
    }
  }

  const timeoutMs = Math.max(1000, Math.min(config.timeoutMs ?? 30_000, 60_000))
  const source = normalizeScriptSource(selectedScript.code || "")
  if (Buffer.byteLength(source, "utf8") > MAX_SCRIPT_SOURCE_BYTES) {
    throw new Error("Script source exceeds the 256 KB safety limit.")
  }
  if (Buffer.byteLength(payload.inputJson || "{}", "utf8") > MAX_SCRIPT_INPUT_BYTES) {
    throw new Error("Script input exceeds the 512 KB safety limit.")
  }
  assertScriptIsSafe(source)

  const body = await executeInWorker({ source, handler: selectedScript.handler || "main", inputJson: payload.inputJson, timeoutMs })
  return {
    ok: true,
    status: 200,
    body,
  }
}

function executeInWorker(request: { source: string; handler: string; inputJson?: string; timeoutMs: number }) {
  return new Promise<string>((resolve, reject) => {
    const workerPath = fileURLToPath(new URL("./script-worker.mjs", import.meta.url))
    const child = spawn(process.execPath, [workerPath], {
      env: { ELECTRON_RUN_AS_NODE: "1", PATH: process.env.PATH || "", NODE_ENV: "production" },
      stdio: ["pipe", "pipe", "pipe"],
      windowsHide: true,
      detached: false,
    })
    let output = ""
    let settled = false
    const finish = (error?: Error) => {
      if (settled) return
      settled = true
      clearTimeout(timer)
      child.kill()
      if (error) reject(error)
    }
    const timer = setTimeout(() => finish(new Error(`Script integration timed out after ${request.timeoutMs}ms.`)), request.timeoutMs)
    child.stdout.setEncoding("utf8")
    child.stdout.on("data", (chunk: string) => {
      output += chunk
      if (Buffer.byteLength(output, "utf8") > MAX_SCRIPT_OUTPUT_BYTES * 2) finish(new Error("Script worker output exceeded the safety limit."))
    })
    child.stderr.on("data", () => undefined)
    child.on("error", (error) => finish(error))
    child.on("close", (code) => {
      if (settled) return
      const line = output.trim().split("\n").filter(Boolean).at(-1)
      if (!line) return finish(new Error(`Script worker exited with code ${code ?? "unknown"}.`))
      try {
        const result = JSON.parse(line) as { ok?: boolean; body?: string; error?: string }
        if (!result.ok || typeof result.body !== "string") return finish(new Error(result.error || "Script worker failed."))
        finish()
        resolve(result.body)
      } catch (error) {
        finish(error instanceof Error ? error : new Error(String(error)))
      }
    })
    child.stdin.end(`${JSON.stringify(request)}\n`)
  })
}