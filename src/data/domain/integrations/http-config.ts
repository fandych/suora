import type {
  HttpEndpointConfig,
  HttpEndpointParameter,
  HttpIntegrationAuthType,
  HttpIntegrationConfig,
} from "@/data/domain/models"

export const DEFAULT_PARAMETER_SCHEMA_JSON = "{\n  \"type\": \"object\",\n  \"properties\": {}\n}"

function createId(prefix: string) {
  return `${prefix}-${globalThis.crypto.randomUUID()}`
}

export function createHttpEndpointParameter(partial?: Partial<HttpEndpointParameter>): HttpEndpointParameter {
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

export function createHttpEndpoint(partial?: Partial<HttpEndpointConfig>): HttpEndpointConfig {
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
    parameters: partial?.parameters?.map(createHttpEndpointParameter) ?? [],
  }
}

export function createDefaultHttpIntegrationConfig(): HttpIntegrationConfig {
  return {
    kind: "http",
    baseUrl: "",
    selectedEndpointId: "",
    endpoints: [],
    method: "POST",
    url: "",
    description: "",
    headersJson: "{}",
    queryJson: "{}",
    bodyJson: "{}",
    authType: "none",
    authConfigJson: "{}",
    parameterSchemaJson: DEFAULT_PARAMETER_SCHEMA_JSON,
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
  if (!baseUrl.trim()) return path.trim()

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
  const endpoints = config.endpoints.map(createHttpEndpoint)
  const selectedEndpoint = endpoints.find((endpoint) => endpoint.id === config.selectedEndpointId) ?? endpoints[0]

  return {
    ...config,
    selectedEndpointId: selectedEndpoint?.id ?? "",
    endpoints,
    method: selectedEndpoint?.method ?? config.method,
    url: selectedEndpoint ? buildHttpEndpointUrl(config.baseUrl, selectedEndpoint.path) : "",
    headersJson: selectedEndpoint?.headersJson ?? config.headersJson,
    queryJson: selectedEndpoint?.queryJson ?? config.queryJson,
    bodyJson: selectedEndpoint?.bodyJson ?? config.bodyJson,
    parameterSchemaJson: selectedEndpoint?.parameterSchemaJson ?? config.parameterSchemaJson,
  }
}

export function normalizeHttpIntegrationConfig(config: Partial<HttpIntegrationConfig>): HttpIntegrationConfig {
  const fallback = createDefaultHttpIntegrationConfig()
  const existingEndpoints = config.endpoints?.length ? config.endpoints : [(() => {
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
      name: "Imported endpoint",
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
    endpoints: existingEndpoints.map(createHttpEndpoint),
    selectedEndpointId: config.selectedEndpointId ?? existingEndpoints[0]?.id ?? fallback.selectedEndpointId,
  })
}
