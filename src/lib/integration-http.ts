import type {
  HttpEndpointConfig,
  HttpEndpointParameter,
  HttpIntegrationAuthType,
  HttpIntegrationConfig,
  McpToolRecord,
} from "@/data/domain/models"

export const DEFAULT_PARAMETER_SCHEMA_JSON = "{\n  \"type\": \"object\",\n  \"properties\": {}\n}"

function createId(prefix: string) {
  return `${prefix}-${globalThis.crypto.randomUUID()}`
}

export function createHttpEndpointParameter(
  partial?: Partial<HttpEndpointParameter>
): HttpEndpointParameter {
  return {
    id: partial?.id ?? createId("http-param"),
    name: partial?.name ?? "",
    in: partial?.in ?? "query",
    type: partial?.type ?? "string",
    required: partial?.required ?? false,
    description: partial?.description ?? "",
    defaultValue: partial?.defaultValue ?? "",
  }
}

export function createHttpEndpoint(
  partial?: Partial<HttpEndpointConfig>
): HttpEndpointConfig {
  return {
    id: partial?.id ?? createId("http-endpoint"),
    name: partial?.name ?? "New endpoint",
    description: partial?.description ?? "",
    method: partial?.method ?? "GET",
    path: partial?.path ?? "/",
    bodyMode: partial?.bodyMode ?? "none",
    headersJson: partial?.headersJson ?? "{}",
    queryJson: partial?.queryJson ?? "{}",
    bodyJson: partial?.bodyJson ?? "{}",
    parameterSchemaJson: partial?.parameterSchemaJson ?? DEFAULT_PARAMETER_SCHEMA_JSON,
    responseSchemaJson: partial?.responseSchemaJson ?? DEFAULT_PARAMETER_SCHEMA_JSON,
    responseDescription: partial?.responseDescription ?? "",
    parameters: partial?.parameters?.map((parameter) => createHttpEndpointParameter(parameter)) ?? [],
  }
}

export function createDefaultHttpIntegrationConfig(): HttpIntegrationConfig {
  const endpoint = createHttpEndpoint({ name: "Default endpoint", method: "POST", path: "/" })

  return {
    kind: "http",
    baseUrl: "",
    selectedEndpointId: endpoint.id,
    endpoints: [endpoint],
    method: endpoint.method,
    url: "",
    description: "",
    headersJson: endpoint.headersJson,
    queryJson: endpoint.queryJson,
    bodyJson: endpoint.bodyJson,
    authType: "none",
    authConfigJson: "{}",
    parameterSchemaJson: endpoint.parameterSchemaJson,
  }
}

function toPrettyJson(value: unknown, fallback = "{}") {
  try {
    return JSON.stringify(value, null, 2)
  } catch {
    return fallback
  }
}

export function buildHttpEndpointUrl(baseUrl: string, path: string) {
  if (!baseUrl.trim()) {
    return path.trim()
  }

  try {
    return new URL(path || "/", baseUrl).toString()
  } catch {
    const normalizedBase = baseUrl.endsWith("/") ? baseUrl.slice(0, -1) : baseUrl
    const normalizedPath = path.startsWith("/") ? path : `/${path}`
    return `${normalizedBase}${normalizedPath}`
  }
}

export function getSelectedHttpEndpoint(config: HttpIntegrationConfig) {
  return config.endpoints.find((endpoint) => endpoint.id === config.selectedEndpointId) ?? config.endpoints[0] ?? null
}

export function syncHttpIntegrationConfig(config: HttpIntegrationConfig): HttpIntegrationConfig {
  const endpoints = config.endpoints.length > 0
    ? config.endpoints.map((endpoint) => createHttpEndpoint(endpoint))
    : [createHttpEndpoint({ name: "Default endpoint", method: config.method || "POST" })]
  const selectedEndpoint = endpoints.find((endpoint) => endpoint.id === config.selectedEndpointId) ?? endpoints[0]

  return {
    ...config,
    selectedEndpointId: selectedEndpoint.id,
    endpoints,
    method: selectedEndpoint.method,
    url: buildHttpEndpointUrl(config.baseUrl, selectedEndpoint.path),
    headersJson: selectedEndpoint.headersJson,
    queryJson: selectedEndpoint.queryJson,
    bodyJson: selectedEndpoint.bodyJson,
    parameterSchemaJson: selectedEndpoint.parameterSchemaJson,
  }
}

function parseJson<T>(value: string | undefined, fallback: T): T {
  if (!value?.trim()) {
    return fallback
  }

  try {
    return JSON.parse(value) as T
  } catch {
    return fallback
  }
}

export function normalizeHttpIntegrationConfig(
  config: Partial<HttpIntegrationConfig>
): HttpIntegrationConfig {
  const fallback = createDefaultHttpIntegrationConfig()
  const existingEndpoints = config.endpoints?.length
    ? config.endpoints
    : [(() => {
      const legacyUrl = config.url?.trim() ?? ""
      let baseUrl = config.baseUrl ?? ""
      let path = "/"
      let queryJson = config.queryJson ?? "{}"

      if (legacyUrl) {
        try {
          const parsedUrl = new URL(legacyUrl)
          baseUrl = baseUrl || parsedUrl.origin
          path = `${parsedUrl.pathname || "/"}${parsedUrl.hash || ""}`
          if (queryJson === "{}" && parsedUrl.searchParams.size > 0) {
            queryJson = toPrettyJson(Object.fromEntries(parsedUrl.searchParams.entries()))
          }
        } catch {
          path = legacyUrl
        }
      }

      const endpoint = createHttpEndpoint({
        name: "Default endpoint",
        description: config.description ?? "",
        method: config.method ?? fallback.method,
        path,
        headersJson: config.headersJson ?? fallback.headersJson,
        queryJson,
        bodyJson: config.bodyJson ?? fallback.bodyJson,
        parameterSchemaJson: config.parameterSchemaJson ?? fallback.parameterSchemaJson,
      })

      fallback.baseUrl = baseUrl
      return endpoint
    })()]

  return syncHttpIntegrationConfig({
    ...fallback,
    ...config,
    baseUrl: config.baseUrl ?? fallback.baseUrl,
    authType: (config.authType ?? fallback.authType) as HttpIntegrationAuthType,
    authConfigJson: config.authConfigJson ?? fallback.authConfigJson,
    endpoints: existingEndpoints.map((endpoint) => createHttpEndpoint(endpoint)),
    selectedEndpointId: config.selectedEndpointId ?? existingEndpoints[0]?.id ?? fallback.selectedEndpointId,
  })
}

type CurlImportResult = {
  baseUrl: string
  endpoint: HttpEndpointConfig
  authType: HttpIntegrationAuthType
  authConfigJson: string
}

function tokenizeCommand(command: string) {
  const tokens = command.match(/"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'|\S+/g) ?? []
  return tokens.map((token) => {
    if ((token.startsWith('"') && token.endsWith('"')) || (token.startsWith("'") && token.endsWith("'"))) {
      return token.slice(1, -1)
    }

    return token
  })
}

export function parseCurlImport(command: string): CurlImportResult {
  const tokens = tokenizeCommand(command.trim())
  if (tokens.length === 0 || tokens[0].toLowerCase() !== "curl") {
    throw new Error("Paste a curl command to import an endpoint.")
  }

  let method = "GET"
  let url = ""
  const headers: Record<string, string> = {}
  let bodyText = ""

  for (let index = 1; index < tokens.length; index += 1) {
    const token = tokens[index]
    const next = tokens[index + 1]

    if ((token === "-X" || token === "--request") && next) {
      method = next.toUpperCase()
      index += 1
      continue
    }

    if ((token === "-H" || token === "--header") && next) {
      const splitAt = next.indexOf(":")
      if (splitAt > -1) {
        const key = next.slice(0, splitAt).trim()
        const value = next.slice(splitAt + 1).trim()
        headers[key] = value
      }
      index += 1
      continue
    }

    if (["--data", "--data-raw", "--data-binary", "-d"].includes(token) && next) {
      bodyText = next
      if (method === "GET") {
        method = "POST"
      }
      index += 1
      continue
    }

    if (!token.startsWith("-") && !url) {
      url = token
    }
  }

  if (!url) {
    throw new Error("The curl command does not contain a request URL.")
  }

  const parsedUrl = new URL(url)
  const query = Object.fromEntries(parsedUrl.searchParams.entries())
  let authType: HttpIntegrationAuthType = "none"
  let authConfig: Record<string, string> = {}

  const authorizationHeader = Object.entries(headers).find(([key]) => key.toLowerCase() === "authorization")
  if (authorizationHeader) {
    const [, value] = authorizationHeader
    if (/^Bearer\s+/i.test(value)) {
      authType = "bearer"
      authConfig = { token: value.replace(/^Bearer\s+/i, "") }
      delete headers[authorizationHeader[0]]
    } else if (/^Basic\s+/i.test(value)) {
      authType = "basic"
      authConfig = { credentials: value.replace(/^Basic\s+/i, "") }
      delete headers[authorizationHeader[0]]
    } else {
      authType = "custom"
      authConfig = { authorization: value }
      delete headers[authorizationHeader[0]]
    }
  }

  const apiKeyHeader = Object.entries(headers).find(([key]) => /x-api-key|api-key|apikey/i.test(key))
  if (apiKeyHeader && authType === "none") {
    authType = "api-key"
    authConfig = { location: "header", name: apiKeyHeader[0], value: apiKeyHeader[1] }
    delete headers[apiKeyHeader[0]]
  }

  const bodyMode = bodyText
    ? (headers["Content-Type"]?.includes("form") || headers["content-type"]?.includes("form") ? "form-data" : "json")
    : "none"

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
      bodyJson: bodyText ? (() => {
        try {
          return JSON.stringify(JSON.parse(bodyText), null, 2)
        } catch {
          return bodyText
        }
      })() : "{}",
      parameters: [],
    }),
  }
}

type OpenApiImportResult = {
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
  const authType: HttpIntegrationAuthType = firstSecurityScheme?.type === "apiKey"
    ? "api-key"
    : firstSecurityScheme?.type === "http" && firstSecurityScheme.scheme === "basic"
      ? "basic"
      : firstSecurityScheme?.type === "http" && firstSecurityScheme.scheme === "bearer"
        ? "bearer"
        : "none"
  const authConfigJson = firstSecurityScheme
    ? toPrettyJson({
      name: firstSecurityScheme.name ?? "",
      location: firstSecurityScheme.in ?? "header",
      scheme: firstSecurityScheme.scheme ?? "",
      value: "",
    })
    : "{}"

  const endpoints = Object.entries(parsed.paths ?? {}).flatMap(([path, operations]) =>
    Object.entries(operations ?? {}).map(([method, operation]) => {
      const parameters = (operation.parameters ?? []).map((parameter) => createHttpEndpointParameter({
        name: parameter.name ?? "",
        in: (parameter.in as HttpEndpointParameter["in"]) ?? "query",
        type: parameter.schema?.type ?? "string",
        required: parameter.required ?? false,
        description: parameter.description ?? "",
      }))

      const contentEntries = Object.entries(operation.requestBody?.content ?? {})
      const firstContent = contentEntries[0]
      const contentType = firstContent?.[0] ?? ""
      const bodySchema = firstContent?.[1]?.schema
      const bodyFields = Object.entries(bodySchema?.properties ?? {}).map(([key, value]) =>
        createHttpEndpointParameter({
          name: key,
          in: contentType.includes("form") ? "form-data" : "json",
          type: value.type ?? "string",
          description: value.description ?? "",
        })
      )

      return createHttpEndpoint({
        name: operation.summary || `${method.toUpperCase()} ${path}`,
        description: operation.description || operation.summary || "Imported from API doc.",
        method: method.toUpperCase(),
        path,
        bodyMode: contentType.includes("form-data")
          ? "form-data"
          : contentType.includes("x-www-form-urlencoded")
            ? "x-www-form-urlencoded"
            : contentType.includes("json")
              ? "json"
              : "none",
        parameters: [...parameters, ...bodyFields],
        parameterSchemaJson: bodySchema ? JSON.stringify(bodySchema, null, 2) : DEFAULT_PARAMETER_SCHEMA_JSON,
        bodyJson: bodySchema?.properties ? toPrettyJson(Object.fromEntries(Object.keys(bodySchema.properties).map((key) => [key, ""]))) : "{}",
      })
    })
  )

  return {
    baseUrl,
    description: parsed.info?.description ?? "",
    authType,
    authConfigJson,
    endpoints,
  }
}

export function mergeHttpEndpoints(
  current: HttpEndpointConfig[],
  incoming: HttpEndpointConfig[]
) {
  const merged = [...current]

  for (const endpoint of incoming) {
    const existingIndex = merged.findIndex((item) => item.method === endpoint.method && item.path === endpoint.path)
    if (existingIndex === -1) {
      merged.push(endpoint)
      continue
    }

    merged[existingIndex] = {
      ...merged[existingIndex],
      ...endpoint,
      id: merged[existingIndex].id,
    }
  }

  return merged
}

export function readMcpTools(toolCatalogJson: string): McpToolRecord[] {
  const parsed = parseJson<unknown>(toolCatalogJson, [])
  const source = Array.isArray(parsed)
    ? parsed
    : typeof parsed === "object" && parsed !== null && "tools" in parsed && Array.isArray((parsed as { tools: unknown[] }).tools)
      ? (parsed as { tools: unknown[] }).tools
      : []

  return source.map((item, index) => {
    const tool = item as { id?: string; name?: string; description?: string; inputSchemaJson?: string; inputSchema?: unknown }
    return {
      id: tool.id ?? createId(`mcp-tool-${index}`),
      name: tool.name ?? `Tool ${index + 1}`,
      description: tool.description ?? "",
      inputSchemaJson: tool.inputSchemaJson ?? toPrettyJson(tool.inputSchema ?? {}),
    }
  })
}