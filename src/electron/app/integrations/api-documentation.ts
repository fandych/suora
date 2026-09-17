import http from "node:http"
import https from "node:https"

import { appState } from "@/electron/infrastructure/app-state"
import { getProxyAgent } from "@/electron/infrastructure/proxy-service"
import { getPreferenceSettingsSnapshot } from "@/electron/app/preferences/runtime"
import { assertSafeHttpUrl } from "@/electron/infrastructure/url-security"

const MAX_REDIRECTS = 5
const MAX_API_DOCUMENT_BYTES = 10 * 1024 * 1024

function isConnectionReset(error: unknown) {
  const message = error instanceof Error ? error.message : String(error)
  const code = error instanceof Error && "code" in error ? String(error.code ?? "") : ""
  const normalized = `${code} ${message}`.toLowerCase()
  return normalized.includes("econnreset") || normalized.includes("connection reset") || normalized.includes("socket hang up")
}

function describeRequestError(error: unknown) {
  const message = error instanceof Error ? error.message : String(error)
  const code = error instanceof Error && "code" in error ? String(error.code ?? "") : ""
  if (isConnectionReset(error))
    return `API documentation server closed the connection (${code || "ECONNRESET"}). Verify the URL and proxy settings, then retry. Enable “Ignore SSL / CA certificate validation” only for a trusted server with a private or self-signed certificate.`
  return code ? `API documentation request failed (${code}): ${message}` : message
}

export async function fetchApiDocumentation(sourceUrl: string) {
  const preferenceSettings = getPreferenceSettingsSnapshot()
  const proxySettings = appState.currentProxySettings
  const ignoreSsl = proxySettings.ignoreSslErrors === true || preferenceSettings.ignoreSslErrors === true
  const fetchDocument = async (url: URL, redirects = 0): Promise<string> => {
    if (redirects > MAX_REDIRECTS) throw new Error(`API doc request exceeded ${MAX_REDIRECTS} redirects.`)
    const transport = url.protocol === "https:" ? https : http

    return new Promise<string>((resolve, reject) => {
    let attempt = 0
    const requestApiDoc = () => {
      attempt += 1
      const agent =
        getProxyAgent(url, ignoreSsl) ??
        (url.protocol === "https:"
          ? new https.Agent({ keepAlive: false, rejectUnauthorized: !ignoreSsl })
          : new http.Agent({ keepAlive: false }))
      const request = transport.request(
        url,
        {
          method: "GET",
          agent,
          headers: {
            "User-Agent": "SUORA/1.0 (Desktop API Doc Importer)",
            Accept: "application/json, application/yaml, text/yaml, text/plain, */*;q=0.8",
            Connection: "close",
          },
          rejectUnauthorized: ignoreSsl ? false : (proxySettings.rejectUnauthorized ?? true),
        },
        (response) => {
          const location = response.headers.location
          if ([301, 302, 303, 307, 308].includes(response.statusCode ?? 0) && location) {
            response.resume()
            void assertSafeHttpUrl(new URL(location, url).toString(), { allowLocalNetwork: true })
              .then((redirectUrl) => fetchDocument(redirectUrl, redirects + 1))
              .then(resolve, reject)
            return
          }
          const chunks: Buffer[] = []
          let bytes = 0
          let settled = false
          const fail = (error: Error) => {
            if (settled) return
            settled = true
            reject(error)
          }
          response.on("data", (chunk: Buffer) => chunks.push(chunk))
          response.on("data", (chunk: Buffer) => {
            bytes += chunk.byteLength
            if (bytes > MAX_API_DOCUMENT_BYTES)
              response.destroy(new Error("API documentation exceeds the 10 MB import limit."))
          })
          response.on("end", () => {
            if (settled) return
            settled = true
            const body = Buffer.concat(chunks).toString("utf8")
            if ((response.statusCode ?? 500) < 200 || (response.statusCode ?? 500) >= 300) {
              reject(new Error(`API doc request failed with HTTP ${response.statusCode ?? 500}.`))
              return
            }
            resolve(body)
          })
          response.on("error", (error) => {
            if (isConnectionReset(error) && attempt < 3) {
              setTimeout(requestApiDoc, 300)
              return
            }
            fail(new Error(describeRequestError(error), { cause: error }))
          })
        },
      )
      request.on("error", (error) => {
        if (isConnectionReset(error) && attempt < 3) {
          setTimeout(requestApiDoc, 300)
          return
        }
        reject(new Error(describeRequestError(error), { cause: error }))
      })
      request.setTimeout(30_000, () => request.destroy(new Error("API doc request timed out.")))
      request.end()
    }
    requestApiDoc()
  })
  }

  return fetchDocument(await assertSafeHttpUrl(sourceUrl, { allowLocalNetwork: true }))
}
