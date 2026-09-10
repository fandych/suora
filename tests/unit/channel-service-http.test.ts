import { describe, expect, it } from "vitest"

import express from "express"
import { createServer } from "node:http"

describe("local HTTP request harness", () => {
  it("round-trips a JSON webhook-like request", async () => {
    const app = express()
    app.use(express.json())
    app.post("/webhook/test", (req, res) => res.json({ ok: true, content: req.body.content }))
    const server = createServer(app)
    await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", () => resolve()))
    const address = server.address()
    if (!address || typeof address === "string") throw new Error("Test server did not bind")
    const response = await fetch(`http://127.0.0.1:${address.port}/webhook/test`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ content: "hello" }) })
    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({ ok: true, content: "hello" })
    await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()))
  })
})
