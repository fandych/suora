import type { HttpIntegrationConfig, IntegrationConfig, McpIntegrationConfig, ScriptIntegrationConfig } from "@/data/domain/models"
import { createDefaultHttpIntegrationConfig, DEFAULT_PARAMETER_SCHEMA_JSON } from "@/data/domain/integrations"

export function createChangedKindConfig(kind: IntegrationConfig["kind"], current: IntegrationConfig): IntegrationConfig {
  if (current.kind === kind) {
    return current
  }

  if (kind === "mcp") {
    return { kind: "mcp", description: "", endpoint: "", launchCommand: "", protocols: ["stdio"], authModes: ["none"], authConfigJson: "{}", toolCatalogJson: "[]", tools: [] } satisfies McpIntegrationConfig
  }

  if (kind === "scripts") {
    return {
      kind: "scripts",
      description: "",
      runtime: "node",
      timeoutMs: 30000,
      inputSchemaJson: DEFAULT_PARAMETER_SCHEMA_JSON,
      outputSchemaJson: "{}",
      selectedScriptId: "script-main",
      scripts: [{ id: "script-main", name: "Main Script", handler: "main", code: "export async function main(input) {\n  return { ok: true, input }\n}\n" }],
    } satisfies ScriptIntegrationConfig
  }

  return createDefaultHttpIntegrationConfig() satisfies HttpIntegrationConfig
}