import { describe, expect, it } from "vitest"

import { normalizeIntegrationConfig } from "@/electron/app/integrations/config-normalizer"

describe("integration config normalizer", () => {
  it("fills script defaults for legacy or partial script configs", () => {
    const normalized = normalizeIntegrationConfig("scripts", {
      scripts: [{ id: "script-1", name: "Script 1", handler: "", code: "" }],
    })

    expect(normalized).toMatchObject({
      kind: "scripts",
      description: "",
      runtime: "node",
      timeoutMs: 30000,
      selectedScriptId: "script-1",
    })
    if (!("scripts" in normalized)) {
      throw new Error("Expected a script integration config")
    }
    expect(normalized.scripts[0]).toMatchObject({
      id: "script-1",
      name: "Script 1",
      handler: "handler",
      code: "export async function handler(input) {\n  return { ok: true, input }\n}\n",
    })
  })

  it("fills MCP defaults for legacy or partial MCP configs", () => {
    const normalized = normalizeIntegrationConfig("mcp", {})

    expect(normalized).toMatchObject({
      kind: "mcp",
      description: "",
      endpoint: "",
      launchCommand: "",
      protocols: ["stdio"],
      authModes: ["none"],
      authConfigJson: "{}",
      toolCatalogJson: "[]",
      tools: [],
    })
  })
})
