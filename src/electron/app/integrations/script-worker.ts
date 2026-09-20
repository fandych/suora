import dns from "node:dns/promises"
import net from "node:net"
import { Script, createContext } from "node:vm"
import { Agent, ProxyAgent, setGlobalDispatcher } from "undici"
import { assertSafeHttpUrl } from "@/electron/infrastructure/url-security"

type WorkerRequest = {
  source: string
  handler: string
  inputJson?: string
  timeoutMs: number
  proxy?: { type: "http" | "https"; host: string; port: number; username?: string; password?: string } | null
}
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
    if (request.proxy) setGlobalDispatcher(new ProxyAgent(buildProxyUrl(request.proxy)))
    const useProxy = Boolean(request.proxy)
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
      fetch: async (input: string | URL, init?: RequestInit) => {
        const target = await resolveSafeFetchTarget(String(input))
        const dispatcher = useProxy ? undefined : createPinnedDispatcher(target)
        return fetch(target.url, { ...init, ...(dispatcher ? { dispatcher } : {}) })
      },
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
    new Script(
      `
        "use strict";
        for (const key of ["constructor", "globalThis", "process", "require"]) {
          try {
            Object.defineProperty(globalThis, key, {
              value: undefined,
              configurable: false,
              enumerable: false,
              writable: false,
            })
          } catch {}
        }
        for (const prototype of [Object.prototype, Function.prototype]) {
          try {
            Object.defineProperty(prototype, "constructor", {
              value: undefined,
              configurable: false,
              enumerable: false,
              writable: false,
            })
            Object.freeze(prototype)
          } catch {}
        }
      `,
    ).runInContext(context, { timeout: request.timeoutMs })
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

async function resolveSafeFetchTarget(value: string) {
  const url = await assertSafeHttpUrl(value)
  const hostname = url.hostname.replace(/^\[|\]$/g, "")
  const ipVersion = net.isIP(hostname)
  if (ipVersion !== 0) {
    return { url, address: hostname, family: ipVersion }
  }
  const [resolved] = await dns.lookup(hostname, { all: true, verbatim: true })
  if (!resolved) {
    throw new Error("Unable to resolve the target URL.")
  }
  return { url, address: resolved.address, family: resolved.family }
}

function createPinnedDispatcher(target: { url: URL; address: string; family: number }) {
  return new Agent({
    connect: {
      lookup: ((
        _hostname: string,
        _options: unknown,
        callback: (error: NodeJS.ErrnoException | null, address: string, family: number) => void,
      ) => callback(null, target.address, target.family)) as never,
      ...(target.url.protocol === "https:" ? { servername: target.url.hostname } : {}),
    },
  })
}

function buildProxyUrl(proxy: NonNullable<WorkerRequest["proxy"]>) {
  const auth = proxy.username
    ? `${encodeURIComponent(proxy.username)}:${encodeURIComponent(proxy.password ?? "")}@`
    : ""
  return `${proxy.type}://${auth}${proxy.host}:${proxy.port}`
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
