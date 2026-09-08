import http from "node:http"
import https from "node:https"

import { appState } from "@electron/others/app-state"
import { getProxyAgent } from "@electron/others/proxy"
import { getPreferenceSettingsSnapshot } from "@electron/others/preferences"
import { assertSafeHttpUrl } from "@electron/others/url-security"

export async function fetchApiDocumentation(sourceUrl: string) {
  const url = await assertSafeHttpUrl(sourceUrl, { allowLocalNetwork: true })
  const preferenceSettings = getPreferenceSettingsSnapshot()
  const proxySettings = appState.currentProxySettings
  const ignoreSsl = proxySettings.ignoreSslErrors === true || preferenceSettings.ignoreSslErrors === true
  const transport = url.protocol === "https:" ? https : http
  const proxyAgent = getProxyAgent(url, ignoreSsl)
  const agent = proxyAgent ?? (url.protocol === "https:"
    ? new https.Agent({ keepAlive: false, rejectUnauthorized: !ignoreSsl })
    : new http.Agent({ keepAlive: false }))

  return new Promise<string>((resolve, reject) => {
    let attempt = 0
    const requestApiDoc = () => {
      attempt += 1
      const request = transport.request(url, {
        method: "GET",
        agent,
        headers: { "User-Agent": "SUORA/1.0 (Desktop API Doc Importer)", Connection: "close" },
        rejectUnauthorized: ignoreSsl ? false : (proxySettings.rejectUnauthorized ?? true),
      }, (response) => {
        const chunks: Buffer[] = []
        response.on("data", (chunk: Buffer) => chunks.push(chunk))
        response.on("end", () => {
          const body = Buffer.concat(chunks).toString("utf8")
          if ((response.statusCode ?? 500) < 200 || (response.statusCode ?? 500) >= 300) {
            reject(new Error(`API doc request failed with HTTP ${response.statusCode ?? 500}.`))
            return
          }
          resolve(body)
        })
        response.on("error", (error) => {
          if (String(error).toLowerCase().includes("econnreset") && attempt < 3) {
            setTimeout(requestApiDoc, 300)
            return
          }
          reject(error)
        })
      })
      request.on("error", (error) => {
        const message = error instanceof Error ? error.message : String(error)
        if (message.toLowerCase().includes("econnreset") && attempt < 3) {
          setTimeout(requestApiDoc, 300)
          return
        }
        reject(new Error(message.toLowerCase().includes("econnreset")
          ? "API doc connection reset. Check the URL, proxy, or enable \"Ignore SSL / CA certificate validation\" in Preferences > Security."
          : message, { cause: error }))
      })
      request.setTimeout(30_000, () => request.destroy(new Error("API doc request timed out.")))
      request.end()
    }
    requestApiDoc()
  })
}
