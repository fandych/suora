import http from "node:http"
import https from "node:https"
import { getPreferenceSettingsSnapshot } from "@/electron/app/preferences/runtime"
import { appState } from "@/electron/infrastructure/app-state"
import { getProxyAgent } from "@/electron/infrastructure/proxy-service"

export type HttpRequestOptions = {
  method?: string
  headers?: Record<string, string>
  body?: string | Buffer
  timeoutMs?: number
  signal?: AbortSignal
  ignoreSslErrors?: boolean
}
export type HttpResponse = {
  status: number
  headers: Record<string, string | string[] | undefined>
  text: string
  data: unknown
}

export async function configuredFetch(input: string | URL | Request, init: RequestInit = {}): Promise<Response> {
  const request = input instanceof Request ? input : new Request(input, init)
  const parsedUrl = parseHttpUrl(request.url)
  const preferenceSettings = getPreferenceSettingsSnapshot()
  const proxySettings = appState.currentProxySettings
  const ignoreSsl = proxySettings.ignoreSslErrors === true || preferenceSettings.ignoreSslErrors === true
  const transport = parsedUrl.protocol === "https:" ? https : http
  const agent =
    getProxyAgent(parsedUrl, ignoreSsl) ??
    (parsedUrl.protocol === "https:"
      ? new https.Agent({ keepAlive: false, rejectUnauthorized: !ignoreSsl })
      : new http.Agent({ keepAlive: false }))
  const body = request.method === "GET" || request.method === "HEAD" ? undefined : Buffer.from(await request.arrayBuffer())

  return new Promise((resolve, reject) => {
    const nodeRequest = transport.request(
      parsedUrl,
      {
        method: request.method,
        headers: Object.fromEntries(request.headers),
        agent,
        rejectUnauthorized: ignoreSsl ? false : (proxySettings.rejectUnauthorized ?? true),
      },
      (response) => {
        const bodyStream = new ReadableStream<Uint8Array>({
          start(controller) {
            response.on("data", (chunk: Buffer) => controller.enqueue(new Uint8Array(chunk)))
            response.on("end", () => controller.close())
            response.on("error", (error) => controller.error(error))
          },
          cancel() {
            response.destroy()
          },
        })
        resolve(new Response(bodyStream, { status: response.statusCode ?? 0, headers: response.headers as Record<string, string> }))
      },
    )
    const abort = () => nodeRequest.destroy(new Error("HTTP request aborted"))
    if (request.signal.aborted) abort()
    else request.signal.addEventListener("abort", abort, { once: true })
    nodeRequest.on("error", reject)
    if (body) nodeRequest.write(body)
    nodeRequest.end()
  })
}

export async function requestHttp(url: string, options: HttpRequestOptions = {}): Promise<HttpResponse> {
  const parsedUrl = parseHttpUrl(url)
  const proxySettings = appState.currentProxySettings
  const ignoreSsl = proxySettings.ignoreSslErrors === true || options.ignoreSslErrors === true
  const transport = parsedUrl.protocol === "https:" ? https : http
  const agent =
    getProxyAgent(parsedUrl, ignoreSsl) ??
    (parsedUrl.protocol === "https:"
      ? new https.Agent({ keepAlive: false, rejectUnauthorized: !ignoreSsl })
      : new http.Agent({ keepAlive: false }))
  return new Promise((resolve, reject) => {
    const request = transport.request(
      parsedUrl,
      {
        method: options.method || "GET",
        headers: options.headers || {},
        agent,
        rejectUnauthorized: ignoreSsl ? false : (proxySettings.rejectUnauthorized ?? true),
        signal: options.signal,
      },
      (response) => {
        const chunks: Buffer[] = []
        response.on("data", (chunk: Buffer) => chunks.push(Buffer.from(chunk)))
        response.on("end", () => {
          const text = Buffer.concat(chunks).toString("utf8")
          resolve({ status: response.statusCode || 0, headers: response.headers, text, data: parseResponseBody(text) })
        })
        response.on("error", reject)
      },
    )
    request.on("error", reject)
    if (options.timeoutMs && options.timeoutMs > 0)
      request.setTimeout(options.timeoutMs, () =>
        request.destroy(new Error(`HTTP request timed out after ${options.timeoutMs}ms.`)),
      )
    if (options.body) request.write(options.body)
    request.end()
  })
}
function parseHttpUrl(value: string) {
  let url: URL
  try {
    url = new URL(value)
  } catch {
    throw new Error(`Invalid URL: ${value}`)
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") throw new Error("Only HTTP and HTTPS URLs are supported.")
  return url
}
function parseResponseBody(text: string): unknown {
  if (!text) return null
  try {
    return JSON.parse(text)
  } catch {
    return text
  }
}
