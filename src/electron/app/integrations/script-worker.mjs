import dns from "node:dns/promises"
import net from "node:net"
import { Script, createContext } from "node:vm"
import { Agent, ProxyAgent, setGlobalDispatcher } from "undici"
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

async function resolveSafeFetchTarget(value) {
  const url = await safeUrl(value)
  const hostname = url.hostname.replace(/^\[|\]$/g, "")
  const ipVersion = net.isIP(hostname)
  if (ipVersion !== 0) {
    return { url, address: hostname, family: ipVersion }
  }
  const records = await dns.lookup(hostname, { all: true, verbatim: true })
  if (
    !records.length ||
    !records[0]?.address ||
    net.isIP(records[0].address) === 0 ||
    ![4, 6].includes(records[0].family)
  ) {
    throw new Error("Unable to resolve the target URL.")
  }
  return { url, address: records[0].address, family: records[0].family }
}

async function safeFetch(input, init = {}, useProxy = false, redirectsRemaining = MAX_FETCH_REDIRECTS) {
  const target = await resolveSafeFetchTarget(String(input))
  if (!useProxy && (!target.address || net.isIP(target.address) === 0 || ![4, 6].includes(target.family))) {
    throw new Error("Unable to resolve the target URL.")
  }
  const dispatcher = useProxy
    ? undefined
    : new Agent({
        connect: {
          lookup: (_hostname, _options, callback) => callback(null, target.address, target.family),
          ...(target.url.protocol === "https:" ? { servername: target.url.hostname } : {}),
        },
      })
  const response = await fetch(target.url, { ...init, redirect: "manual", ...(dispatcher ? { dispatcher } : {}) })
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
  const nextUrl = new URL(location, target.url)
  const nextInit =
    response.status === 307 || response.status === 308 ? init : { ...init, method: "GET", body: undefined }
  return safeFetch(nextUrl.toString(), nextInit, useProxy, redirectsRemaining - 1)
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
    const useProxy = Boolean(request.proxy)
    if (request.proxy) {
      const auth = request.proxy.username
        ? `${encodeURIComponent(request.proxy.username)}:${encodeURIComponent(request.proxy.password || "")}@`
        : ""
      setGlobalDispatcher(new ProxyAgent(`${request.proxy.type}://${auth}${request.proxy.host}:${request.proxy.port}`))
    }
    const logs = []
    const consoleApi = Object.freeze({
      log: (...args) => appendLog(logs, args),
      warn: (...args) => appendLog(logs, args),
      error: (...args) => appendLog(logs, args),
    })
    const sandbox = Object.assign(Object.create(null), {
      AbortController,
      URL,
      URLSearchParams,
      TextDecoder,
      TextEncoder,
      console: consoleApi,
      fetch: async (input, init) => safeFetch(input, init, useProxy),
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
    new Script(`
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
    `).runInContext(context, { timeout: request.timeoutMs })
    new Script(`"use strict";\n${request.source}`).runInContext(context, { timeout: request.timeoutMs })
    const handler = sandbox[request.handler || "main"]
    if (typeof handler !== "function") {
      respond({ ok: false, error: "Handler not found" })
      return
    }
    const output = await Promise.resolve(handler(sandbox.input))
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
