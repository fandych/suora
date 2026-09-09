type AiFetchStartResult = { requestId?: string }

type AiFetchEventPayload =
  | { requestId: string; type: "response"; status: number; statusText: string; headers: Record<string, string> }
  | { requestId: string; type: "data"; chunkBase64: string }
  | { requestId: string; type: "end" }
  | { requestId: string; type: "error"; error: string }

function decodeBase64(base64: string) {
  return Uint8Array.from(atob(base64), (char) => char.charCodeAt(0))
}

function createAbortError() {
  return new DOMException("The operation was aborted.", "AbortError")
}

export function createAiProxyFetch(settings: { requestTimeoutMs: number }): typeof fetch | undefined {
  const bridge = window.electron
  if (!bridge?.invoke || !bridge.on || !bridge.off) return undefined

  return async (input: RequestInfo | URL, init?: RequestInit) => {
    const request = new Request(input, init)
    const headers = Object.fromEntries(request.headers.entries())
    const bodyText = request.method === "GET" || request.method === "HEAD" ? undefined : await request.text()

    return new Promise<Response>((resolve, reject) => {
      let requestId: string | undefined
      let controller: ReadableStreamDefaultController<Uint8Array> | undefined
      let responseResolved = false
      const pendingEvents: unknown[][] = []
      const cleanup = () => {
        bridge.off?.("ai:fetch:event", handleEvent)
        request.signal.removeEventListener("abort", handleAbort)
      }
      const handleAbort = () => {
        if (requestId) void bridge.invoke("ai:fetch:abort", requestId).catch(() => {})
        cleanup()
        reject(createAbortError())
      }
      const stream = new ReadableStream<Uint8Array>({
        start(nextController) { controller = nextController },
        cancel() { if (requestId) void bridge.invoke("ai:fetch:abort", requestId).catch(() => {}) },
      })
      const processEvent = (...args: unknown[]) => {
        const payload = args[1] as AiFetchEventPayload | undefined
        if (!payload || !requestId || payload.requestId !== requestId) return
        if (payload.type === "response" && !responseResolved) {
          responseResolved = true
          resolve(new Response(stream, { status: payload.status, statusText: payload.statusText, headers: payload.headers }))
        } else if (payload.type === "data") controller?.enqueue(decodeBase64(payload.chunkBase64))
        else if (payload.type === "end") { cleanup(); controller?.close() }
        else if (payload.type === "error") {
          cleanup()
          if (!responseResolved) reject(new Error(payload.error))
          else controller?.error(new Error(payload.error))
        }
      }
      const handleEvent = (...args: unknown[]) => {
        if (!requestId) pendingEvents.push(args)
        else processEvent(...args)
      }
      bridge.on("ai:fetch:event", handleEvent)
      request.signal.addEventListener("abort", handleAbort, { once: true })
      void bridge.invoke("ai:fetch:start", { url: request.url, method: request.method, headers, bodyText, ...(settings.requestTimeoutMs > 0 ? { timeoutMs: settings.requestTimeoutMs } : {}) }).then((result) => {
        requestId = (result as AiFetchStartResult).requestId
        if (!requestId) { cleanup(); reject(new Error("AI fetch did not return a request ID")); return }
        for (const event of pendingEvents.splice(0)) processEvent(...event)
      }).catch((error) => { cleanup(); reject(error instanceof Error ? error : new Error(String(error))) })
    })
  }
}
