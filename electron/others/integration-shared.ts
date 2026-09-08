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

export function parseIntegrationJson<T>(value: string | undefined, fallback: T): T {
  if (!value?.trim()) return fallback
  try { return JSON.parse(value) as T } catch { return fallback }
}

export function buildIntegrationEndpointUrl(baseUrl: string | undefined, endpointPath: string | undefined) {
  if (!baseUrl?.trim()) return endpointPath || ""
  try { return new URL(endpointPath || "/", baseUrl).toString() } catch { return `${baseUrl}${endpointPath?.startsWith("/") ? endpointPath : `/${endpointPath || ""}`}` }
}

export function applyIntegrationAuth(headers: Record<string, string>, url: URL, config: Pick<HttpIntegrationConfig, "authType" | "authConfigJson">) {
  const authConfig = parseIntegrationJson<Record<string, unknown>>(config.authConfigJson, {})
  const sharedHeaders = authConfig.headers && typeof authConfig.headers === "object" ? authConfig.headers as Record<string, unknown> : config.authType === "custom" ? authConfig : {}
  for (const [name, value] of Object.entries(sharedHeaders)) if (typeof value === "string" && name.trim()) headers[name] = value
  if (config.authType === "bearer" && authConfig.token) headers.Authorization = `Bearer ${authConfig.token}`
  if (config.authType === "basic") { const credentials = authConfig.credentials || `${authConfig.username || ""}:${authConfig.password || ""}`; headers.Authorization = `Basic ${Buffer.from(String(credentials)).toString("base64")}` }
  if (config.authType === "api-key") { const name = String(authConfig.name || "x-api-key"); const value = String(authConfig.value || ""); if (authConfig.location === "query") url.searchParams.set(name, value); else headers[name] = value }
}

export function buildMultipartIntegrationBody(fields: Record<string, unknown>, boundary: string) {
  const chunks: Buffer[] = []
  for (const [key, value] of Object.entries(fields)) {
    const file = value as UploadedIntegrationFile
    chunks.push(Buffer.from(`--${boundary}\r\n`, "utf8"))
    if (file?.__suoraFile && file.dataBase64) {
      const safeFilename = (file.name || "upload").replaceAll(/["\\\r\n]/g, "_")
      chunks.push(Buffer.from(`Content-Disposition: form-data; name="${key}"; filename="${safeFilename}"\r\nContent-Type: ${file.type || "application/octet-stream"}\r\n\r\n`, "utf8"), Buffer.from(file.dataBase64, "base64"), Buffer.from("\r\n", "utf8"))
    } else chunks.push(Buffer.from(`Content-Disposition: form-data; name="${key}"\r\n\r\n${String(value ?? "")}\r\n`, "utf8"))
  }
  chunks.push(Buffer.from(`--${boundary}--\r\n`, "utf8"))
  return Buffer.concat(chunks)
}
