import dns from "node:dns/promises"
import { Script, createContext } from "node:vm"
import { isIP } from "node:net"

const MAX_LOG_ENTRIES = 500
const MAX_LOG_BYTES = 256 * 1024
const MAX_OUTPUT_BYTES = 1024 * 1024
const MAX_FETCH_REDIRECTS = 5

process.stdin.setEncoding("utf8")
let buffer = ""
process.stdin.on("data", (chunk) => {
  buffer += chunk
  const newline = buffer.indexOf("\n")
  if (newline < 0) return
  const raw = buffer.slice(0, newline)
  buffer = ""
  void run(JSON.parse(raw))
})

async function safeUrl(value) {
  const url = new URL(value)
  if (!["http:", "https:"].includes(url.protocol)) throw new Error("Only HTTP and HTTPS URLs are allowed.")
  const host = url.hostname.replace(/^\[|\]$/g, "").toLowerCase()
  if (isPrivate(host)) throw new Error("Private and local network URLs are not allowed.")
  const records = await dns.lookup(host, { all: true, verbatim: true })
  if (!records.length || records.some((record) => isPrivate(record.address)))
    throw new Error("Private and local network URLs are not allowed.")
  return url
}

async function safeFetch(input, init = {}, redirectsRemaining = MAX_FETCH_REDIRECTS) {
  const url = await safeUrl(String(input))
  const response = await fetch(url, { ...init, redirect: "manual" })
  if (![301, 302, 303, 307, 308].includes(response.status)) {
    return response
  }
  if (redirectsRemaining <= 0) {
    throw new Error("Too many HTTP redirects.")
  }
  const location = response.headers.get("location")
  if (!location) {
    return response
  }
  const nextUrl = new URL(location, url)
  const nextInit = response.status === 307 || response.status === 308 ? init : { ...init, method: "GET", body: undefined }
  return safeFetch(nextUrl.toString(), nextInit, redirectsRemaining - 1)
}

function isPrivate(address) {
  const version = isIP(address)
  if (version === 4) {
    const [a, b] = address.split(".").map(Number)
    return (
      a === 0 ||
      a === 10 ||
      a === 127 ||
      (a === 169 && b === 254) ||
      (a === 172 && b >= 16 && b <= 31) ||
      (a === 192 && b === 168)
    )
  }
  if (version === 6) return address === "::" || address === "::1" || /^f[cd]/i.test(address) || /^fe80:/i.test(address)
  return ["localhost", "localhost.localdomain", "metadata.google.internal"].includes(address)
}

async function run(request) {
  try {
    const logs = []
    const sandbox = {
      AbortController,
      URL,
      URLSearchParams,
      TextDecoder,
      TextEncoder,
      console: {
        log: (...args) => appendLog(logs, args),
        warn: (...args) => appendLog(logs, args),
        error: (...args) => appendLog(logs, args),
      },
      fetch: async (input, init) => safeFetch(input, init),
      input: parseInput(request.inputJson),
      structuredClone,
    }
    const context = createContext(sandbox)
    const handlerName = JSON.stringify(request.handler || "main")
    const script = new Script(
      `"use strict";\n${request.source}\n(async () => { const handlerFn = globalThis[${handlerName}]; if (typeof handlerFn !== 'function') return { ok: false, error: 'Handler not found' }; return await handlerFn(input); })();`,
    )
    const output = await script.runInContext(context, { timeout: request.timeoutMs })
    const body = JSON.stringify({ output, logs }, null, 2)
    if (Buffer.byteLength(body) > MAX_OUTPUT_BYTES) throw new Error("Script output exceeds the 1 MB safety limit.")
    respond({ ok: true, body })
  } catch (error) {
    respond({ ok: false, error: error instanceof Error ? error.message : String(error) })
  }
}

function parseInput(value) {
  try {
    return value?.trim() ? JSON.parse(value) : {}
  } catch {
    return {}
  }
}
function appendLog(logs, args) {
  if (logs.length >= MAX_LOG_ENTRIES) return
  const next = args.map(String).join(" ")
  if (Buffer.byteLength(logs.join("\n") + next) <= MAX_LOG_BYTES) logs.push(next)
}
function respond(value) {
  process.stdout.write(`${JSON.stringify(value)}\n`)
}
