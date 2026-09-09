import type { VersionOption } from "@/data/domain/version-models"

export type HttpIntegrationAuthType = "none" | "bearer" | "basic" | "api-key" | "custom"
export type HttpEndpointBodyMode = "none" | "json" | "form-data" | "x-www-form-urlencoded"
export type HttpEndpointParameterLocation = "path" | "query" | "header" | "form-data" | "json"
export type HttpEndpointParameter = { id: string; name: string; in: HttpEndpointParameterLocation; type: string; required: boolean; description: string; defaultValue: string }
export type HttpEndpointConfig = { id: string; name: string; description: string; method: string; path: string; bodyMode: HttpEndpointBodyMode; headersJson: string; queryJson: string; bodyJson: string; parameterSchemaJson: string; responseSchemaJson: string; responseDescription: string; parameters: HttpEndpointParameter[] }
export type HttpIntegrationConfig = { kind: "http"; baseUrl: string; selectedEndpointId: string; endpoints: HttpEndpointConfig[]; method: string; url: string; description: string; headersJson: string; queryJson: string; bodyJson: string; authType: HttpIntegrationAuthType; authConfigJson: string; parameterSchemaJson: string }
export type ScriptWorkbenchItem = { id: string; name: string; handler: string; code: string }
export type ScriptIntegrationConfig = { kind: "scripts"; description: string; runtime: string; timeoutMs: number; inputSchemaJson: string; outputSchemaJson: string; selectedScriptId: string; scripts: ScriptWorkbenchItem[] }
export type McpToolRecord = { id: string; name: string; description: string; inputSchemaJson: string }
export type McpIntegrationConfig = { kind: "mcp"; description: string; endpoint: string; launchCommand: string; protocols: string[]; authModes: string[]; authConfigJson: string; toolCatalogJson: string; tools: McpToolRecord[] }
export type IntegrationConfig = HttpIntegrationConfig | ScriptIntegrationConfig | McpIntegrationConfig
export type IntegrationSummary = { id: string; title: string; kind: string; endpoint: string; enabled: boolean; updatedAt: number }
export type IntegrationDetail = { integration: IntegrationSummary; versions: VersionOption[]; latestVersion: VersionOption; selectedVersion: VersionOption; config: IntegrationConfig; executions: IntegrationExecutionRecord[] }
export type IntegrationExecutionRecord = { id: string; versionId: string; status: string; input: string; output: string; createdAt: number }
