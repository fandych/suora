import path from "node:path"

export type IntegrationExecutePayload = {
  integrationId?: string
  kind: "http" | "scripts" | "mcp"
  config: Record<string, unknown>
  inputJson?: string
}

export type UploadedIntegrationFile = {
  __suoraFile?: boolean
  name?: string
  type?: string
  dataBase64?: string
}

export type IntegrationEndpoint = {
  id?: string
  method?: string
  path?: string
  headersJson?: string
  queryJson?: string
  bodyJson?: string
  bodyMode?: string
  parameters?: Array<{ name?: string; in?: string; type?: string; defaultValue?: string; required?: boolean }>
}

export type HttpIntegrationConfig = {
  baseUrl?: string
  authType?: string
  authConfigJson?: string
  selectedEndpointId?: string
  endpoints?: IntegrationEndpoint[]
  method?: string
  url?: string
  headersJson?: string
  queryJson?: string
  bodyJson?: string
}

const RESTRICTED_HEADER_NAMES = [/^authorization$/i, /^proxy-authorization$/i, /^cookie$/i, /^host$/i, /^connection$/i, /^content-length$/i, /^transfer-encoding$/i, /^upgrade$/i, /^proxy-/i, /^sec-/i, /^x-forwarded-/i]

function sanitizeMultipartFilename(value?: string) {
  const baseName = path.basename((value || "upload").trim() || "upload")
  // eslint-disable-next-line no-control-regex -- multipart filenames must strip ASCII control characters on input.
  return baseName.replace(/[\x00-\x1f\x7f"\\]/g, "_")
}

export function isRestrictedHeaderName(name: string) {
  const normalized = name.trim().toLowerCase()
  return !normalized || RESTRICTED_HEADER_NAMES.some((pattern) => pattern.test(normalized))
}

export function sanitizeHeaderRecord(headers: Record<string, unknown>) {
  return Object.fromEntries(
    Object.entries(headers)
      .filter(([name, value]) => !isRestrictedHeaderName(name) && typeof value === "string")
      .map(([name, value]) => [name, value]),
  ) as Record<string, string>
}

export function parseIntegrationJson<T>(value: string | undefined, fallback: T): T {
  if (!value?.trim()) return fallback
  try {
    return JSON.parse(value) as T
  } catch {
    return fallback
  }
}

export function buildIntegrationEndpointUrl(baseUrl: string | undefined, endpointPath: string | undefined) {
  if (!baseUrl?.trim()) return endpointPath || ""
  try {
    return new URL(endpointPath || "/", baseUrl).toString()
  } catch {
    return `${baseUrl}${endpointPath?.startsWith("/") ? endpointPath : `/${endpointPath || ""}`}`
  }
}

export function applyIntegrationAuth(
  headers: Record<string, string>,
  url: URL,
  config: Pick<HttpIntegrationConfig, "authType" | "authConfigJson">,
) {
  const authConfig = parseIntegrationJson<Record<string, unknown>>(config.authConfigJson, {})
  const sharedHeaders = sanitizeHeaderRecord(
    authConfig.headers && typeof authConfig.headers === "object"
      ? (authConfig.headers as Record<string, unknown>)
      : config.authType === "custom"
        ? authConfig
        : {},
  )
  for (const [name, value] of Object.entries(sharedHeaders)) {
    headers[name] = value
  }
  if (config.authType === "bearer" && authConfig.token) headers.Authorization = `Bearer ${authConfig.token}`
  if (config.authType === "basic") {
    const credentials = authConfig.credentials || `${authConfig.username || ""}:${authConfig.password || ""}`
    headers.Authorization = `Basic ${Buffer.from(String(credentials)).toString("base64")}`
  }
  if (config.authType === "api-key") {
    const configuredName = String(authConfig.name || "x-api-key")
    const name = isRestrictedHeaderName(configuredName) ? "x-api-key" : configuredName
    const value = String(authConfig.value || "")
    if (authConfig.location === "query") url.searchParams.set(name, value)
    else headers[name] = value
  }
}

export function buildMultipartIntegrationBody(fields: Record<string, unknown>, boundary: string) {
  const chunks: Buffer[] = []
  for (const [key, value] of Object.entries(fields)) {
    const file = value as UploadedIntegrationFile
    chunks.push(Buffer.from(`--${boundary}\r\n`, "utf8"))
    if (file?.__suoraFile && file.dataBase64) {
      const safeFilename = sanitizeMultipartFilename(file.name)
      chunks.push(
        Buffer.from(
          `Content-Disposition: form-data; name="${key}"; filename="${safeFilename}"\r\nContent-Type: ${file.type || "application/octet-stream"}\r\n\r\n`,
          "utf8",
        ),
        Buffer.from(file.dataBase64, "base64"),
        Buffer.from("\r\n", "utf8"),
      )
    } else {
      chunks.push(
        Buffer.from(`Content-Disposition: form-data; name="${key}"\r\n\r\n${String(value ?? "")}\r\n`, "utf8"),
      )
    }
  }
  chunks.push(Buffer.from(`--${boundary}--\r\n`, "utf8"))
  return Buffer.concat(chunks)
}
