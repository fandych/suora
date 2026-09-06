import http from "node:http"
import https from "node:https"

import { getPreferenceSettingsSnapshot } from "@electron/others/preferences"

export async function httpRequest(url: string, options: { method?: string; headers?: Record<string, string>; body?: string }) {
  return new Promise<{ status: number; data: unknown }>((resolve, reject) => {
    let parsedUrl: URL
    try {
      parsedUrl = new URL(url)
    } catch {
      reject(new Error(`Invalid URL: ${url}`))
      return
    }

    const ignoreSsl = getPreferenceSettingsSnapshot().ignoreSslErrors
    const transport = parsedUrl.protocol === "https:" ? https : http
    const request = transport.request(parsedUrl, {
      method: options.method || "GET",
      headers: options.headers || {},
      rejectUnauthorized: !ignoreSsl,
    }, (response) => {
      let body = ""
      response.on("data", (chunk: Buffer) => {
        body += chunk.toString()
      })
      response.on("end", () => {
        try {
          resolve({ status: response.statusCode || 0, data: JSON.parse(body) })
        } catch {
          resolve({ status: response.statusCode || 0, data: body })
        }
      })
      response.on("error", reject)
    })

    request.on("error", reject)
    if (options.body) {
      request.write(options.body)
    }
    request.end()
  })
}
