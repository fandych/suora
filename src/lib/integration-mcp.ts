import type { McpToolRecord } from "@/data/domain/models"

function createId(prefix: string) {
  return `${prefix}-${globalThis.crypto.randomUUID()}`
}

function parseJson<T>(value: string, fallback: T): T {
  try {
    return JSON.parse(value) as T
  } catch {
    return fallback
  }
}

function toPrettyJson(value: unknown) {
  try {
    return JSON.stringify(value, null, 2)
  } catch {
    return "{}"
  }
}

export function readMcpTools(toolCatalogJson: string): McpToolRecord[] {
  const parsed = parseJson<unknown>(toolCatalogJson, [])
  const source = Array.isArray(parsed) ? parsed : typeof parsed === "object" && parsed !== null && "tools" in parsed && Array.isArray((parsed as { tools: unknown[] }).tools) ? (parsed as { tools: unknown[] }).tools : []
  return source.map((item, index) => {
    const tool = item as { id?: string; name?: string; description?: string; inputSchemaJson?: string; inputSchema?: unknown }
    return { id: tool.id ?? createId(`mcp-tool-${index}`), name: tool.name ?? `Tool ${index + 1}`, description: tool.description ?? "", inputSchemaJson: tool.inputSchemaJson ?? toPrettyJson(tool.inputSchema ?? {}) }
  })
}
