import { Script, createContext } from "node:vm"

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

function parseJson<T>(value: string | undefined, fallback: T): T {
  if (!value?.trim()) {
    return fallback
  }

  try {
    return JSON.parse(value) as T
  } catch {
    return fallback
  }
}

function normalizeScriptSource(code: string) {
  return code.replace(/^\s*export\s+/gm, "")
}

function assertScriptIsSafe(code: string) {
  const blockedPattern = BLOCKED_SCRIPT_PATTERNS.find((pattern) => pattern.test(code))
  if (blockedPattern) {
    throw new Error("Script contains blocked runtime APIs. Use HTTP or MCP integrations for privileged operations.")
  }
}

function runPromiseWithTimeout<T>(promise: Promise<T>, timeoutMs: number) {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`Script integration timed out after ${timeoutMs}ms.`)), timeoutMs)
    promise.then((value) => {
      clearTimeout(timer)
      resolve(value)
    }).catch((error) => {
      clearTimeout(timer)
      reject(error)
    })
  })
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
  assertScriptIsSafe(source)

  const logs: string[] = []
  const sandbox = {
    AbortController,
    URL,
    URLSearchParams,
    TextDecoder,
    TextEncoder,
    console: {
      log: (...args: unknown[]) => logs.push(args.map((value) => String(value)).join(" ")),
      warn: (...args: unknown[]) => logs.push(args.map((value) => String(value)).join(" ")),
      error: (...args: unknown[]) => logs.push(args.map((value) => String(value)).join(" ")),
    },
    fetch,
    input: parseJson(payload.inputJson, {} as Record<string, unknown>),
    structuredClone,
  }

  const context = createContext(sandbox)
  const handlerName = JSON.stringify(selectedScript.handler || "main")
  const script = new Script(`
    "use strict";
    ${source}
    (async () => {
      const handlerFn = globalThis[${handlerName}];
      if (typeof handlerFn !== "function") {
        return { ok: false, error: "Handler not found" };
      }
      return await handlerFn(input);
    })();
  `)

  const output = await runPromiseWithTimeout(Promise.resolve(script.runInContext(context, { timeout: timeoutMs })), timeoutMs)
  const body = JSON.stringify({ output, logs }, null, 2)
  return {
    ok: true,
    status: 200,
    body,
  }
}