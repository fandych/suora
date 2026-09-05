import { Buffer } from "node:buffer"
import crypto from "node:crypto"
import http from "node:http"
import https from "node:https"
import type { WebContents } from "electron"

import { appState } from "@electron/others/app-state"
import { getProxyAgent } from "@electron/others/proxy"
import type { AiFetchStartPayload } from "@electron/types"

function sendAiEvent(target: WebContents, payload: Record<string, unknown>) {
  if (!target.isDestroyed()) {
    target.send("ai:fetch:event", payload)
  }
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

  const request = transport.request(url, {
    method: payload.method ?? "GET",
    headers: payload.headers,
    agent: getProxyAgent(url),
    rejectUnauthorized: appState.currentProxySettings.ignoreSslErrors ? false : appState.currentProxySettings.rejectUnauthorized,
  }, (response) => {
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
      sendAiEvent(target, {
        requestId,
        type: "data",
        chunkBase64: chunk.toString("base64"),
      })
    })

    response.on("end", () => {
      appState.activeAiRequests.delete(requestId)
      sendAiEvent(target, { requestId, type: "end" })
    })
  })

  appState.activeAiRequests.set(requestId, request)

  request.on("error", (error) => {
    appState.activeAiRequests.delete(requestId)
    sendAiEvent(target, { requestId, type: "error", error: error instanceof Error ? error.message : String(error) })
  })

  if (payload.timeoutMs && payload.timeoutMs > 0) {
    request.setTimeout(payload.timeoutMs, () => {
      request.destroy(new Error("AI request timed out"))
    })
  }

  setImmediate(() => {
    if (body) {
      request.write(body)
    }

    request.end()
  })

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
