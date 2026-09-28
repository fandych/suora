import { describe, expect, it, vi } from "vitest"
import { createServer } from "node:http"

vi.mock("@/electron/infrastructure/url-security", () => ({
  assertSafeHttpUrl: async (value: string | URL) => new URL(typeof value === "string" ? value : value.toString()),
}))

vi.mock("@/electron/app/preferences/runtime", () => ({
  getPreferenceSettingsSnapshot: () => ({}),
}))

import { configuredFetch, requestHttp } from "@/electron/infrastructure/http-client"

async function withEchoServer(
  run: (url: string) => Promise<void>,
) {
  const server = createServer((req, res) => {
    const chunks: Buffer[] = []
    req.on("data", (chunk: Buffer) => chunks.push(Buffer.from(chunk)))
    req.on("end", () => {
      res.setHeader("content-type", "application/json")
      res.end(
        JSON.stringify({
          body: Buffer.concat(chunks).toString("utf8"),
          contentLength: req.headers["content-length"] ?? null,
          transferEncoding: req.headers["transfer-encoding"] ?? null,
        }),
      )
    })
  })

  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", () => resolve()))
  const address = server.address()
  if (!address || typeof address === "string") {
    throw new Error("Test server did not bind")
  }

  try {
    await run(`http://127.0.0.1:${address.port}/echo`)
  } finally {
    await new Promise<void>((resolve, reject) => server.close((error) => (error ? reject(error) : resolve())))
  }
}

describe("http client body headers", () => {
  it("sets Content-Length for requestHttp JSON bodies", async () => {
    const payload = JSON.stringify({ content: "wechat-qr" })

    await withEchoServer(async (url) => {
      const response = await requestHttp(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: payload,
      })

      expect(response.status).toBe(200)
      expect(response.data).toEqual({
        body: payload,
        contentLength: String(Buffer.byteLength(payload)),
        transferEncoding: null,
      })
    })
  })

  it("sets Content-Length for configuredFetch request bodies", async () => {
    const payload = JSON.stringify({ content: "configured-fetch" })

    await withEchoServer(async (url) => {
      const response = await configuredFetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: payload,
      })

      expect(response.status).toBe(200)
      await expect(response.json()).resolves.toEqual({
        body: payload,
        contentLength: String(Buffer.byteLength(payload)),
        transferEncoding: null,
      })
    })
  })
})
