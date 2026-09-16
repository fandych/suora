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
    const sandbox = {
      AbortController,
      URL,
      URLSearchParams,
      TextDecoder,
      TextEncoder,
      console: {
        log: (...args: unknown[]) => appendLog(logs, args),
        warn: (...args: unknown[]) => appendLog(logs, args),
        error: (...args: unknown[]) => appendLog(logs, args),
      },
      fetch: async (input: string | URL, init?: RequestInit) => fetch(await assertSafeHttpUrl(String(input)), init),
      input: parseInput(request.inputJson),
      structuredClone,
    }
    const context = createContext(sandbox)
    const handlerName = JSON.stringify(request.handler || "main")
    const script = new Script(
      `"use strict";\n${request.source}\n(async () => {\n  const handlerFn = globalThis[${handlerName}];\n  if (typeof handlerFn !== "function") return { ok: false, error: "Handler not found" };\n  return await handlerFn(input);\n})();`,
    )
    const output = await script.runInContext(context, { timeout: request.timeoutMs })
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
