import { Script, createContext } from "node:vm"
import { ProxyAgent, setGlobalDispatcher } from "undici"
import { assertSafeHttpUrl } from "@/electron/infrastructure/url-security"

type WorkerRequest = { source: string; handler: string; inputJson?: string; timeoutMs: number; proxyUrl?: string }
const MAX_LOG_ENTRIES = 500
const MAX_LOG_BYTES = 256 * 1024
const MAX_OUTPUT_BYTES = 1024 * 1024

process.stdin.setEncoding("utf8")
let buffer = ""
process.stdin.on("data", (chunk) => {
  buffer += chunk
  const newline = buffer.indexOf("\n")
  if (newline < 0) return
  const raw = buffer.slice(0, newline)
  buffer = ""
  void run(JSON.parse(raw) as WorkerRequest)
})

async function run(request: WorkerRequest) {
  try {
    if (request.proxyUrl) setGlobalDispatcher(new ProxyAgent(request.proxyUrl))
    const logs: string[] = []
    const consoleApi = Object.freeze({
      log: (...args: unknown[]) => appendLog(logs, args),
      warn: (...args: unknown[]) => appendLog(logs, args),
      error: (...args: unknown[]) => appendLog(logs, args),
    })
    const sandbox = Object.assign(Object.create(null) as Record<string, unknown>, {
      AbortController,
      URL,
      URLSearchParams,
      TextDecoder,
      TextEncoder,
      console: consoleApi,
      fetch: async (input: string | URL, init?: RequestInit) => fetch(await assertSafeHttpUrl(String(input)), init),
      input: parseInput(request.inputJson),
      structuredClone,
    })
    for (const key of ["Buffer", "exports", "global", "module", "process", "require"]) {
      Object.defineProperty(sandbox, key, {
        value: undefined,
        configurable: false,
        enumerable: false,
        writable: false,
      })
    }
    const context = createContext(sandbox, {
      codeGeneration: { strings: false, wasm: false },
      name: "suora-script-sandbox",
    })
    new Script(`"use strict";\n${request.source}`).runInContext(context, { timeout: request.timeoutMs })
    const handler = sandbox[request.handler || "main"]
    if (typeof handler !== "function") {
      respond({ ok: false, error: "Handler not found" })
      return
    }
    const output = await Promise.resolve((handler as (input: Record<string, unknown>) => unknown)(sandbox.input as Record<string, unknown>))
    const body = JSON.stringify({ output, logs }, null, 2)
    if (Buffer.byteLength(body, "utf8") > MAX_OUTPUT_BYTES)
      throw new Error("Script output exceeds the 1 MB safety limit.")
    respond({ ok: true, body })
  } catch (error) {
    respond({ ok: false, error: error instanceof Error ? error.message : String(error) })
  }
}

function parseInput(value?: string) {
  if (!value?.trim()) return {}
  try {
    return JSON.parse(value) as Record<string, unknown>
  } catch {
    return {}
  }
}

function appendLog(logs: string[], args: unknown[]) {
  if (logs.length >= MAX_LOG_ENTRIES) return
  const next = args.map((value) => String(value)).join(" ")
  if (Buffer.byteLength(logs.join("\n") + next, "utf8") <= MAX_LOG_BYTES) logs.push(next)
}

function respond(value: unknown) {
  process.stdout.write(`${JSON.stringify(value)}\n`)
}
