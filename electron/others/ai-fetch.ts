import { Buffer } from "node:buffer"
import crypto from "node:crypto"
import http from "node:http"
import https from "node:https"
import type { WebContents } from "electron"

import { appState } from "@electron/others/app-state"
import { getPreferenceSettingsSnapshot } from "@electron/others/preferences"
import { getProxyAgent } from "@electron/others/proxy"
import type { AiFetchStartPayload } from "@electron/types"

function sendAiEvent(target: WebContents, payload: Record<string, unknown>) {
  if (!target.isDestroyed()) {
    target.send("ai:fetch:event", payload)
  }
}

function logAiFetch(requestId: string, message: string, details?: Record<string, unknown>) {
  console.info(`[SUORA AI][${requestId}] ${message}`, details ?? "")
}

function describeUrl(url: URL) {
  return `${url.protocol}//${url.hostname}${url.port ? `:${url.port}` : ""}${url.pathname}`
}

function formatNetworkError(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error)
  const normalized = message.toLowerCase()
  if (normalized.includes("econnreset") || normalized.includes("connection reset") || normalized.includes("socket hang up")) {
    return `Connection reset by peer (ECONNRESET). The server or proxy closed the connection. Check network/proxy settings or enable "Ignore SSL / CA certificate validation" in Preferences > Security.`
  }
  if (normalized.includes("econnrefused")) {
    return `Connection refused (ECONNREFUSED). The remote server or port is unreachable.`
  }
  if (normalized.includes("etimedout") || normalized.includes("esockettimedout")) {
    return `Network connection timed out (ETIMEDOUT).`
  }
  return message
}

export function startAiFetch(target: WebContents, payload: AiFetchStartPayload) {
  const requestId = crypto.randomUUID()
  const url = new URL(payload.url)
  const transport = url.protocol === "https:" ? https : http
  const body = payload.bodyBase64
    ? Buffer.from(payload.bodyBase64, "base64")
    : payload.bodyText
      ? Buffer.from(payload.bodyText)
      : undefined

  const preferenceSettings = getPreferenceSettingsSnapshot()
  const proxySettings = appState.currentProxySettings
  const ignoreSsl = proxySettings.ignoreSslErrors === true || preferenceSettings.ignoreSslErrors === true

  logAiFetch(requestId, "start", {
    method: payload.method ?? "GET",
    url: describeUrl(url),
    providerProxyEnabled: proxySettings.enabled,
    proxyType: proxySettings.enabled ? proxySettings.type : "none",
    proxyHost: proxySettings.enabled ? proxySettings.host : "",
    proxyPort: proxySettings.enabled ? proxySettings.port : 0,
    ignoreSsl,
    proxyRejectUnauthorized: proxySettings.rejectUnauthorized ?? true,
    bodyBytes: body?.byteLength ?? 0,
    timeoutMs: payload.timeoutMs ?? 0,
  })

  const proxyAgent = getProxyAgent(url, ignoreSsl)
  // Do not reuse sockets for model streaming requests. Enterprise gateways and
  // Azure-compatible proxies often close idle keep-alive sockets; reusing one
  // produces a read ECONNRESET before the first SSE chunk is received.
  const defaultAgent = url.protocol === "https:"
    ? new https.Agent({ keepAlive: false, rejectUnauthorized: !ignoreSsl })
    : new http.Agent({ keepAlive: false })

  const headers = {
    "User-Agent": "SUORA/1.0 (Desktop AI Workbench)",
    Connection: "close",
    ...(payload.headers ?? {}),
  }

  let attemptCount = 0
  let responseBytes = 0

  const executeRequest = () => {
    attemptCount += 1
    const requestAgent = proxyAgent ?? defaultAgent
    logAiFetch(requestId, "attempt", { attempt: attemptCount, viaProxy: Boolean(proxyAgent), agent: requestAgent.constructor.name })
    const request = transport.request(url, {
      method: payload.method ?? "GET",
      headers,
      agent: requestAgent,
      // This option is intentionally explicit: the security preference is
      // scoped to this request rather than changing Node's global TLS state.
      rejectUnauthorized: ignoreSsl ? false : (appState.currentProxySettings.rejectUnauthorized ?? true),
    }, (response) => {
      responseBytes = 0
      logAiFetch(requestId, "response", { attempt: attemptCount, status: response.statusCode ?? 0, statusText: response.statusMessage ?? "" })
      sendAiEvent(target, {
        requestId,
        type: "response",
        status: response.statusCode ?? 500,
        statusText: response.statusMessage ?? "",
        headers: Object.fromEntries(
          Object.entries(response.headers).map(([key, value]) => [key, Array.isArray(value) ? value.join(", ") : String(value ?? "")])
        ),
      })

      response.on("data", (chunk: Buffer) => {
        responseBytes += chunk.byteLength
        sendAiEvent(target, {
          requestId,
          type: "data",
          chunkBase64: chunk.toString("base64"),
        })
      })

      response.on("end", () => {
        logAiFetch(requestId, "complete", { attempt: attemptCount, responseBytes })
        appState.activeAiRequests.delete(requestId)
        sendAiEvent(target, { requestId, type: "end" })
      })

      response.on("error", (error) => {
        const errMsg = error instanceof Error ? error.message : String(error)
        const normalizedError = errMsg.toLowerCase()
        const isReset = normalizedError.includes("econnreset") || normalizedError.includes("socket hang up") || normalizedError.includes("connection reset")
        if (isReset && responseBytes === 0 && attemptCount < 3) {
          logAiFetch(requestId, "retrying after response reset", { attempt: attemptCount, error: errMsg })
          appState.activeAiRequests.delete(requestId)
          setTimeout(() => executeRequest(), 300)
          return
        }
        appState.activeAiRequests.delete(requestId)
        logAiFetch(requestId, "response error", { attempt: attemptCount, responseBytes, error: errMsg })
        sendAiEvent(target, { requestId, type: "error", error: formatNetworkError(error) })
      })
    })

    appState.activeAiRequests.set(requestId, request)

    request.on("error", (error) => {
      const errMsg = error instanceof Error ? error.message : String(error)
      const normalizedError = errMsg.toLowerCase()
      const isReset = normalizedError.includes("econnreset") || normalizedError.includes("socket hang up") || normalizedError.includes("connection reset")
      if (isReset && responseBytes === 0 && attemptCount < 3) {
        logAiFetch(requestId, "retrying after request error", { attempt: attemptCount, error: errMsg })
        appState.activeAiRequests.delete(requestId)
        setTimeout(() => executeRequest(), 300)
        return
      }

      appState.activeAiRequests.delete(requestId)
      logAiFetch(requestId, "request error", { attempt: attemptCount, responseBytes, error: errMsg })
      sendAiEvent(target, { requestId, type: "error", error: formatNetworkError(error) })
    })

    if (payload.timeoutMs && payload.timeoutMs > 0) {
      request.setTimeout(payload.timeoutMs, () => {
        logAiFetch(requestId, "timeout", { attempt: attemptCount, timeoutMs: payload.timeoutMs })
        request.destroy(new Error("AI request timed out"))
      })
    }

    if (body) {
      request.write(body)
    }
    request.end()
  }

  setImmediate(() => executeRequest())

  return { requestId }
}

export function abortAiFetch(requestId: string) {
  const request = appState.activeAiRequests.get(requestId)
  if (request) {
    request.destroy(new Error("AI request aborted"))
    appState.activeAiRequests.delete(requestId)
  }
  return { ok: true }
}
