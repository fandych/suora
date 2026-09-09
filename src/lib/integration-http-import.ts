import type { HttpEndpointConfig, HttpEndpointParameter, HttpIntegrationAuthType } from "@/data/domain/models"
import { createHttpEndpoint, createHttpEndpointParameter, DEFAULT_PARAMETER_SCHEMA_JSON } from "@/lib/integration-http-config"

function toPrettyJson(value: unknown, fallback = "{}") {
  try {
    return JSON.stringify(value, null, 2)
  } catch {
    return fallback
  }
}

export type CurlImportResult = {
  baseUrl: string
  endpoint: HttpEndpointConfig
  authType: HttpIntegrationAuthType
  authConfigJson: string
}

function tokenizeCommand(command: string) {
  const tokens = command.match(/"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'|\S+/g) ?? []
  return tokens.map((token) => token.startsWith('"') && token.endsWith('"') || token.startsWith("'") && token.endsWith("'") ? token.slice(1, -1) : token)
}

export function parseCurlImport(command: string): CurlImportResult {
  const tokens = tokenizeCommand(command.trim())
  if (tokens.length === 0 || tokens[0].toLowerCase() !== "curl") throw new Error("Paste a curl command to import an endpoint.")

  let method = "GET"
  let url = ""
  const headers: Record<string, string> = {}
  let bodyText = ""

  for (let index = 1; index < tokens.length; index += 1) {
    const token = tokens[index]
    const next = tokens[index + 1]
    if ((token === "-X" || token === "--request") && next) {
      method = next.toUpperCase(); index += 1; continue
    }
    if ((token === "-H" || token === "--header") && next) {
      const splitAt = next.indexOf(":")
      if (splitAt > -1) headers[next.slice(0, splitAt).trim()] = next.slice(splitAt + 1).trim()
      index += 1; continue
    }
    if (["--data", "--data-raw", "--data-binary", "-d"].includes(token) && next) {
      bodyText = next; if (method === "GET") method = "POST"; index += 1; continue
    }
    if (!token.startsWith("-") && !url) url = token
  }

  if (!url) throw new Error("The curl command does not contain a request URL.")
  const parsedUrl = new URL(url)
  const query = Object.fromEntries(parsedUrl.searchParams.entries())
  let authType: HttpIntegrationAuthType = "none"
  let authConfig: Record<string, string> = {}

  const authorizationHeader = Object.entries(headers).find(([key]) => key.toLowerCase() === "authorization")
  if (authorizationHeader) {
    const [, value] = authorizationHeader
    if (/^Bearer\s+/i.test(value)) { authType = "bearer"; authConfig = { token: value.replace(/^Bearer\s+/i, "") } }
    else if (/^Basic\s+/i.test(value)) { authType = "basic"; authConfig = { credentials: value.replace(/^Basic\s+/i, "") } }
    else { authType = "custom"; authConfig = { authorization: value } }
    delete headers[authorizationHeader[0]]
  }

  const apiKeyHeader = Object.entries(headers).find(([key]) => /x-api-key|api-key|apikey/i.test(key))
  if (apiKeyHeader && authType === "none") {
    authType = "api-key"
    authConfig = { location: "header", name: apiKeyHeader[0], value: apiKeyHeader[1] }
    delete headers[apiKeyHeader[0]]
  }

  const bodyMode = bodyText ? (headers["Content-Type"]?.includes("form") || headers["content-type"]?.includes("form") ? "form-data" : "json") : "none"
  return {
    baseUrl: parsedUrl.origin,
    authType,
    authConfigJson: toPrettyJson(authConfig),
    endpoint: createHttpEndpoint({
      name: `${method} ${parsedUrl.pathname}`,
      description: "Imported from cURL.",
      method,
      path: parsedUrl.pathname || "/",
      bodyMode,
      headersJson: toPrettyJson(headers),
      queryJson: toPrettyJson(query),
      bodyJson: bodyText ? (() => { try { return JSON.stringify(JSON.parse(bodyText), null, 2) } catch { return bodyText } })() : "{}",
    }),
  }
}

export type OpenApiImportResult = {
  baseUrl: string
  description: string
  authType: HttpIntegrationAuthType
  authConfigJson: string
  endpoints: HttpEndpointConfig[]
}

export function parseOpenApiImport(source: string): OpenApiImportResult {
  const parsed = JSON.parse(source) as {
    info?: { description?: string }
    servers?: Array<{ url?: string }>
    paths?: Record<string, Record<string, { summary?: string; description?: string; parameters?: Array<{ name?: string; in?: string; required?: boolean; description?: string; schema?: { type?: string } }>; requestBody?: { content?: Record<string, { schema?: { properties?: Record<string, { type?: string; description?: string }>; type?: string } }> } }>>
    components?: { securitySchemes?: Record<string, { type?: string; name?: string; in?: string; scheme?: string }> }
  }
  const baseUrl = parsed.servers?.[0]?.url ?? ""
  const firstSecurityScheme = parsed.components?.securitySchemes ? Object.values(parsed.components.securitySchemes)[0] : undefined
  const authType: HttpIntegrationAuthType = firstSecurityScheme?.type === "apiKey" ? "api-key" : firstSecurityScheme?.type === "http" && firstSecurityScheme.scheme === "basic" ? "basic" : firstSecurityScheme?.type === "http" && firstSecurityScheme.scheme === "bearer" ? "bearer" : "none"
  const authConfigJson = firstSecurityScheme ? toPrettyJson({ name: firstSecurityScheme.name ?? "", location: firstSecurityScheme.in ?? "header", scheme: firstSecurityScheme.scheme ?? "", value: "" }) : "{}"
  const endpoints = Object.entries(parsed.paths ?? {}).flatMap(([path, operations]) => Object.entries(operations ?? {}).map(([method, operation]) => {
    const parameters = (operation.parameters ?? []).map((parameter) => createHttpEndpointParameter({ name: parameter.name ?? "", in: (parameter.in as HttpEndpointParameter["in"]) ?? "query", type: parameter.schema?.type ?? "string", required: parameter.required ?? false, description: parameter.description ?? "" }))
    const firstContent = Object.entries(operation.requestBody?.content ?? {})[0]
    const contentType = firstContent?.[0] ?? ""
    const bodySchema = firstContent?.[1]?.schema
    const bodyFields = Object.entries(bodySchema?.properties ?? {}).map(([key, value]) => createHttpEndpointParameter({ name: key, in: contentType.includes("form") ? "form-data" : "json", type: value.type ?? "string", description: value.description ?? "" }))
    return createHttpEndpoint({ name: operation.summary || `${method.toUpperCase()} ${path}`, description: operation.description || operation.summary || "Imported from API doc.", method: method.toUpperCase(), path, bodyMode: contentType.includes("form-data") ? "form-data" : contentType.includes("x-www-form-urlencoded") ? "x-www-form-urlencoded" : contentType.includes("json") ? "json" : "none", parameters: [...parameters, ...bodyFields], parameterSchemaJson: bodySchema ? JSON.stringify(bodySchema, null, 2) : DEFAULT_PARAMETER_SCHEMA_JSON, bodyJson: bodySchema?.properties ? toPrettyJson(Object.fromEntries(Object.keys(bodySchema.properties).map((key) => [key, ""]))) : "{}" })
  }))
  return { baseUrl, description: parsed.info?.description ?? "", authType, authConfigJson, endpoints }
}

export function mergeHttpEndpoints(current: HttpEndpointConfig[], incoming: HttpEndpointConfig[]) {
  const merged = [...current]
  for (const endpoint of incoming) {
    const existingIndex = merged.findIndex((item) => item.method === endpoint.method && item.path === endpoint.path)
    if (existingIndex === -1) merged.push(endpoint)
    else merged[existingIndex] = { ...merged[existingIndex], ...endpoint, id: merged[existingIndex].id }
  }
  return merged
}
