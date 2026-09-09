import http from "node:http"
import https from "node:https"

import { appState } from "@electron/others/app-state"
import { getProxyAgent } from "@electron/others/proxy"
import { getPreferenceSettingsSnapshot } from "@electron/others/preferences"

export type HttpRequestOptions = {
  method?: string
  headers?: Record<string, string>
  body?: string | Buffer
  timeoutMs?: number
  signal?: AbortSignal
}

export type HttpResponse = {
  status: number
  headers: Record<string, string | string[] | undefined>
  text: string
  data: unknown
}

export async function requestHttp(url: string, options: HttpRequestOptions = {}): Promise<HttpResponse> {
  const parsedUrl = parseHttpUrl(url)
  const preferenceSettings = getPreferenceSettingsSnapshot()
  const proxySettings = appState.currentProxySettings
  const ignoreSsl = proxySettings.ignoreSslErrors === true || preferenceSettings.ignoreSslErrors === true
  const transport = parsedUrl.protocol === "https:" ? https : http
  const agent = getProxyAgent(parsedUrl, ignoreSsl) ?? (parsedUrl.protocol === "https:"
    ? new https.Agent({ keepAlive: false, rejectUnauthorized: !ignoreSsl })
    : new http.Agent({ keepAlive: false }))

  return new Promise((resolve, reject) => {
    const request = transport.request(parsedUrl, {
      method: options.method || "GET",
      headers: options.headers || {},
      agent,
      rejectUnauthorized: ignoreSsl ? false : (proxySettings.rejectUnauthorized ?? true),
      signal: options.signal,
    }, (response) => {
      const chunks: Buffer[] = []
      response.on("data", (chunk: Buffer) => chunks.push(Buffer.from(chunk)))
      response.on("end", () => {
        const text = Buffer.concat(chunks).toString("utf8")
        resolve({ status: response.statusCode || 0, headers: response.headers, text, data: parseResponseBody(text) })
      })
      response.on("error", reject)
    })

    request.on("error", reject)
    if (options.timeoutMs && options.timeoutMs > 0) {
      request.setTimeout(options.timeoutMs, () => request.destroy(new Error(`HTTP request timed out after ${options.timeoutMs}ms.`)))
    }
    if (options.body) request.write(options.body)
    request.end()
  })
}

function parseHttpUrl(value: string) {
  let url: URL
  try { url = new URL(value) } catch { throw new Error(`Invalid URL: ${value}`) }
  if (url.protocol !== "http:" && url.protocol !== "https:") throw new Error("Only HTTP and HTTPS URLs are supported.")
  return url
}

function parseResponseBody(text: string): unknown {
  if (!text) return null
  try { return JSON.parse(text) } catch { return text }
}
