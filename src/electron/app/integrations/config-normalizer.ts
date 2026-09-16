import crypto from "node:crypto"
import type {
  HttpEndpointConfig,
  HttpEndpointParameter,
  HttpIntegrationAuthType,
  IntegrationConfig,
} from "@/types/integration"

const defaultParameterSchemaJson = '{\n  "type": "object",\n  "properties": {}\n}'

function createEndpointParameter(partial?: Partial<HttpEndpointParameter>): HttpEndpointParameter {
  return {
    id: partial?.id ?? `http-param-${crypto.randomUUID()}`,
    name: partial?.name ?? "",
    in: partial?.in ?? "query",
    type: partial?.type ?? "string",
    required: partial?.required ?? false,
    description: partial?.description ?? "",
    defaultValue: partial?.defaultValue ?? "",
  }
}

function createEndpoint(partial?: Partial<HttpEndpointConfig>): HttpEndpointConfig {
  return {
    id: partial?.id ?? `http-endpoint-${crypto.randomUUID()}`,
    name: partial?.name ?? "New endpoint",
    description: partial?.description ?? "",
    method: partial?.method ?? "GET",
    path: partial?.path ?? "/",
    bodyMode: partial?.bodyMode ?? "none",
    headersJson: partial?.headersJson ?? "{}",
    queryJson: partial?.queryJson ?? "{}",
    bodyJson: partial?.bodyJson ?? "{}",
    parameterSchemaJson: partial?.parameterSchemaJson ?? defaultParameterSchemaJson,
    responseSchemaJson: partial?.responseSchemaJson ?? defaultParameterSchemaJson,
    responseDescription: partial?.responseDescription ?? "",
    parameters: partial?.parameters?.map(createEndpointParameter) ?? [],
  }
}

function buildEndpointUrl(baseUrl: string, path: string) {
  if (!baseUrl.trim()) return path.trim()
  try {
    return new URL(path || "/", baseUrl).toString()
  } catch {
    return `${baseUrl.endsWith("/") ? baseUrl.slice(0, -1) : baseUrl}${path.startsWith("/") ? path : `/${path}`}`
  }
}

function toPrettyJson(value: unknown, fallback = "{}") {
  try {
    return JSON.stringify(value, null, 2)
  } catch {
    return fallback
  }
}

export function normalizeIntegrationConfig(
  kind: string,
  config: Record<string, unknown>,
): IntegrationConfig | Record<string, unknown> {
  if (kind !== "http") return config
  const source = config as Partial<IntegrationConfig> & { url?: string }
  const fallback = {
    kind: "http" as const,
    baseUrl: "",
    selectedEndpointId: "",
    endpoints: [],
    method: "POST",
    url: "",
    description: "",
    headersJson: "{}",
    queryJson: "{}",
    bodyJson: "{}",
    authType: "none" as HttpIntegrationAuthType,
    authConfigJson: "{}",
    parameterSchemaJson: defaultParameterSchemaJson,
  }
  const legacyUrl = source.url?.trim() ?? ""
  let baseUrl = typeof source.baseUrl === "string" ? source.baseUrl : fallback.baseUrl
  let path = "/"
  let queryJson = typeof source.queryJson === "string" ? source.queryJson : fallback.queryJson
  if (legacyUrl) {
    try {
      const parsedUrl = new URL(legacyUrl)
      baseUrl ||= parsedUrl.origin
      path = `${parsedUrl.pathname || "/"}${parsedUrl.hash || ""}`
      if (queryJson === "{}" && parsedUrl.searchParams.size > 0)
        queryJson = toPrettyJson(Object.fromEntries(parsedUrl.searchParams.entries()))
    } catch {
      path = legacyUrl
    }
  }
  const existingEndpoints =
    Array.isArray(source.endpoints) && source.endpoints.length > 0
      ? source.endpoints.map((endpoint) => createEndpoint(endpoint))
      : [
          createEndpoint({
            name: "Imported endpoint",
            description: typeof source.description === "string" ? source.description : "",
            method: typeof source.method === "string" ? source.method : fallback.method,
            path,
            headersJson: typeof source.headersJson === "string" ? source.headersJson : fallback.headersJson,
            queryJson,
            bodyJson: typeof source.bodyJson === "string" ? source.bodyJson : fallback.bodyJson,
            parameterSchemaJson:
              typeof source.parameterSchemaJson === "string"
                ? source.parameterSchemaJson
                : fallback.parameterSchemaJson,
          }),
        ]
  const selectedEndpoint =
    existingEndpoints.find((endpoint) => endpoint.id === source.selectedEndpointId) ?? existingEndpoints[0]
  return {
    ...fallback,
    ...source,
    kind: "http",
    baseUrl,
    authType: (source.authType ?? fallback.authType) as HttpIntegrationAuthType,
    authConfigJson: typeof source.authConfigJson === "string" ? source.authConfigJson : fallback.authConfigJson,
    endpoints: existingEndpoints,
    selectedEndpointId: selectedEndpoint?.id ?? "",
    method: selectedEndpoint?.method ?? fallback.method,
    url: selectedEndpoint ? buildEndpointUrl(baseUrl, selectedEndpoint.path) : "",
    headersJson: selectedEndpoint?.headersJson ?? fallback.headersJson,
    queryJson: selectedEndpoint?.queryJson ?? fallback.queryJson,
    bodyJson: selectedEndpoint?.bodyJson ?? fallback.bodyJson,
    parameterSchemaJson: selectedEndpoint?.parameterSchemaJson ?? fallback.parameterSchemaJson,
  }
}
