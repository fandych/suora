import { describe, expect, it } from "vitest"

import { executeSandboxedScriptIntegration } from "@electron/integrations/script-runner"

describe("script integration boundaries", () => {
  it("rejects unsupported runtimes and missing scripts before spawning", async () => {
    const unsupported = await executeSandboxedScriptIntegration({ kind: "scripts", config: { runtime: "python", scripts: [] } })
    expect(unsupported).toMatchObject({ ok: false, status: 400 })

    const missing = await executeSandboxedScriptIntegration({ kind: "scripts", config: { runtime: "node", scripts: [] } })
    expect(missing).toMatchObject({ ok: false, status: 400 })
  })

  it("rejects dangerous and oversized source", async () => {
    await expect(executeSandboxedScriptIntegration({ kind: "scripts", config: { scripts: [{ id: "x", handler: "main", code: "process.exit()" }] } })).rejects.toThrow(/blocked runtime APIs/)
    await expect(executeSandboxedScriptIntegration({ kind: "scripts", config: { scripts: [{ id: "x", handler: "main", code: "x".repeat(256 * 1024 + 1) }] } })).rejects.toThrow(/256 KB/)
  })
})
