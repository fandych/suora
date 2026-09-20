import { spawn } from "node:child_process"

import { requestHttp } from "@/electron/infrastructure/http-client"
import { assertSafeHttpUrl } from "@/electron/infrastructure/url-security"
import { executeSandboxedScriptIntegration } from "@/electron/app/integrations/script-runner"
import { parseWorkspaceCommand, resolveWorkspaceSpawnCommand } from "@/electron/app/tools/tool-guardrails"
import {
  applyIntegrationAuth,
  buildIntegrationEndpointUrl,
  buildMultipartIntegrationBody,
  isRestrictedHeaderName,
  parseIntegrationJson,
  sanitizeHeaderRecord,
  type HttpIntegrationConfig,
  type UploadedIntegrationFile,
} from "@/electron/app/integrations/types"
import type { IntegrationExecutePayload } from "@/electron/app/integrations/types"

async function executeHttpIntegration(payload: IntegrationExecutePayload) {
  const config = payload.config as HttpIntegrationConfig
  const selectedEndpoint =
    config.endpoints?.find((endpoint) => endpoint.id === config.selectedEndpointId) ?? config.endpoints?.[0]
  const requestUrl = selectedEndpoint
    ? buildIntegrationEndpointUrl(config.baseUrl, selectedEndpoint.path)
    : config.url || ""
  const url = await assertSafeHttpUrl(requestUrl)
  const input = parseIntegrationJson<Record<string, unknown>>(payload.inputJson, {})
  const query = parseIntegrationJson<Record<string, string>>(selectedEndpoint?.queryJson ?? config.queryJson, {})
  const headers = sanitizeHeaderRecord(
    parseIntegrationJson<Record<string, unknown>>(selectedEndpoint?.headersJson ?? config.headersJson, {}),
  )
  const endpointParameters = selectedEndpoint?.parameters ?? []
  const invalidFileParameter = endpointParameters.find(
    (parameter) =>
      parameter.type === "file" && (parameter.in !== "form-data" || selectedEndpoint?.bodyMode !== "form-data"),
  )
  if (invalidFileParameter?.name) {
    return { ok: false, status: 400, body: `File parameter ${invalidFileParameter.name} requires multipart/form-data.` }
  }
  const missingRequiredParameter = endpointParameters.find((parameter) => {
    const value = input[parameter.name ?? ""]
    return parameter.required && (value === undefined || value === null || value === "")
  })
  if (missingRequiredParameter?.name) {
    return { ok: false, status: 400, body: `Required parameter is missing: ${missingRequiredParameter.name}` }
  }
  for (const parameter of endpointParameters) {
    if (!parameter.name) continue
    const runtimeValue = input[parameter.name] ?? parameter.defaultValue ?? ""
    if (parameter.in === "path") {
      url.pathname = url.pathname
        .replaceAll(`{${parameter.name}}`, encodeURIComponent(String(runtimeValue)))
        .replaceAll(`:${parameter.name}`, encodeURIComponent(String(runtimeValue)))
    }
    if (parameter.in === "query") query[parameter.name] = String(runtimeValue)
    if (parameter.in === "header" && !isRestrictedHeaderName(parameter.name)) headers[parameter.name] = String(runtimeValue)
  }
  for (const [key, value] of Object.entries(query)) url.searchParams.set(key, String(value))
  applyIntegrationAuth(headers, url, config)
  const bodyMode = selectedEndpoint?.bodyMode ?? "json"
  const bodyConfig = parseIntegrationJson<Record<string, unknown>>(selectedEndpoint?.bodyJson ?? config.bodyJson, {})
  let body: string | Buffer | undefined
  const canSendBody = !["GET", "HEAD"].includes(String(selectedEndpoint?.method ?? "").toUpperCase())
  if (canSendBody && bodyMode === "json") {
    const jsonFields = endpointParameters
      .filter((parameter) => parameter.in === "json")
      .reduce<Record<string, unknown>>((accumulator, parameter) => {
        if (parameter.name) accumulator[parameter.name] = input[parameter.name] ?? parameter.defaultValue ?? ""
        return accumulator
      }, {})
    body = JSON.stringify({ ...bodyConfig, ...jsonFields })
    headers["content-type"] = headers["content-type"] || "application/json"
  }
  if (canSendBody && bodyMode === "x-www-form-urlencoded") {
    const formPayload = new URLSearchParams()
    for (const [key, value] of Object.entries(bodyConfig)) formPayload.set(key, String(value ?? ""))
    for (const parameter of endpointParameters.filter((item) => item.in === "form-data")) {
      if (parameter.name) formPayload.set(parameter.name, String(input[parameter.name] ?? parameter.defaultValue ?? ""))
    }
    body = formPayload.toString()
    headers["content-type"] = headers["content-type"] || "application/x-www-form-urlencoded"
  }
  if (canSendBody && bodyMode === "form-data") {
    const boundary = `----suora-${Date.now().toString(16)}`
    const formFields: Record<string, unknown> = { ...bodyConfig }
    for (const parameter of endpointParameters.filter((item) => item.in === "form-data")) {
      if (parameter.name) {
        const file = input[parameter.name] as UploadedIntegrationFile | undefined
        if (
          file?.__suoraFile &&
          (!file.dataBase64 || Buffer.byteLength(file.dataBase64, "base64") > 10 * 1024 * 1024)
        ) {
          return {
            ok: false,
            status: 400,
            body: `Uploaded file is invalid or exceeds the 10 MB limit: ${parameter.name}`,
          }
        }
        formFields[parameter.name] = input[parameter.name] ?? parameter.defaultValue ?? ""
      }
    }
    body = buildMultipartIntegrationBody(formFields, boundary)
    headers["content-type"] = `multipart/form-data; boundary=${boundary}`
  }
  const method = selectedEndpoint?.method || config.method || "GET"
  const redactHeaders = (source: Record<string, string>) =>
    Object.fromEntries(
      Object.entries(source).map(([key, value]) => [
        key,
        /authorization|cookie|api[-_]?key|token|secret/i.test(key) ? "[REDACTED]" : value,
      ]),
    )
  const responseHeaders = (source: Record<string, string | string[] | undefined>) =>
    Object.fromEntries(
      Object.entries(source)
        .filter((entry): entry is [string, string | string[]] => entry[1] !== undefined)
        .map(([key, value]) => [key, /set-cookie/i.test(key) ? "[REDACTED]" : value]),
    )
  const sentBody = method === "GET" || Buffer.isBuffer(body) ? null : (body ?? null)
  const response = await requestHttp(url.toString(), {
    method,
    headers,
    body: body && method !== "GET" ? body : undefined,
    timeoutMs: 60_000,
  })
  const responseBody = response.text
  let json: unknown
  let hasJson = false
  try {
    json = JSON.parse(responseBody)
    hasJson = true
  } catch {
    // Preserve non-JSON responses as raw text.
  }
  const status = response.status
  return {
    ok: status < 400,
    status,
    body: responseBody,
    request: { url: url.toString(), method, headers: redactHeaders(headers), body: sentBody },
    response: {
      status,
      headers: responseHeaders(response.headers),
      body: responseBody,
      ...(hasJson ? { json } : {}),
    },
  }
}

function parseMcpAuthHeaders(authConfigJson?: string): Record<string, string> {
  const headers: Record<string, string> = {}
  try {
    const parsed = JSON.parse(authConfigJson || "{}") as {
      token?: string
      apiKey?: string
      headerName?: string
      headers?: Record<string, string>
    }
    if (parsed.token) headers["authorization"] = `Bearer ${parsed.token}`
    if (parsed.apiKey) {
      const configuredHeaderName = parsed.headerName || "x-api-key"
      headers[isRestrictedHeaderName(configuredHeaderName) ? "x-api-key" : configuredHeaderName] = parsed.apiKey
    }
    if (parsed.headers && typeof parsed.headers === "object") {
      for (const [key, value] of Object.entries(sanitizeHeaderRecord(parsed.headers))) {
        headers[key.toLowerCase()] = String(value)
      }
    }
  } catch {
    // Ignore malformed auth config; proceed without extra headers.
  }
  return headers
}

function parseMcpResponseBody(contentType: string, text: string): unknown {
  if (contentType.includes("text/event-stream")) {
    const dataLines = text
      .split(/\r?\n/)
      .filter((line) => line.startsWith("data:"))
      .map((line) => line.slice(5).trim())
      .filter(Boolean)
    for (const line of dataLines.reverse()) {
      try {
        return JSON.parse(line)
      } catch {
        // Try the next SSE data frame.
      }
    }
    return null
  }
  try {
    return JSON.parse(text)
  } catch {
    return null
  }
}

async function callMcpHttpEndpoint(endpoint: string, authConfigJson?: string) {
  const url = await assertSafeHttpUrl(endpoint)
  const baseHeaders: Record<string, string> = {
    "content-type": "application/json",
    accept: "application/json, text/event-stream",
    ...parseMcpAuthHeaders(authConfigJson),
  }
  const rpc = async (
    headers: Record<string, string>,
    method: string,
    params: Record<string, unknown> | undefined,
    id: number | null,
  ) => {
    const message: Record<string, unknown> = { jsonrpc: "2.0", method }
    if (id !== null) message.id = id
    if (params) message.params = params
    return requestHttp(url.toString(), {
      method: "POST",
      headers,
      body: JSON.stringify(message),
      timeoutMs: 30_000,
    })
  }
  const initResponse = await rpc(
    baseHeaders,
    "initialize",
    {
      protocolVersion: "2025-06-18",
      capabilities: {},
      clientInfo: { name: "suora", version: "1.0.0" },
    },
    1,
  )
  if (initResponse.status >= 400) {
    return {
      ok: false,
      status: initResponse.status,
      body: `MCP initialize failed with status ${initResponse.status}\n\n${initResponse.text}`,
    }
  }
  const sessionHeaderKey = Object.keys(initResponse.headers).find((key) => key.toLowerCase() === "mcp-session-id")
  const sessionId = sessionHeaderKey ? initResponse.headers[sessionHeaderKey] : undefined
  const sessionHeaders = { ...baseHeaders }
  if (typeof sessionId === "string" && sessionId) sessionHeaders["mcp-session-id"] = sessionId
  await rpc(sessionHeaders, "notifications/initialized", undefined, null)
  const toolsResponse = await rpc(sessionHeaders, "tools/list", {}, 2)
  const contentType = String(toolsResponse.headers["content-type"] ?? "")
  const parsed = parseMcpResponseBody(contentType, toolsResponse.text) as {
    result?: { tools?: unknown[] }
    error?: { message?: string }
  } | null
  if (parsed?.error) {
    return {
      ok: false,
      status: toolsResponse.status >= 400 ? toolsResponse.status : 500,
      body: `MCP tools/list error: ${parsed.error.message ?? "Unknown error"}`,
    }
  }
  const tools = parsed?.result?.tools ?? []
  return {
    ok: toolsResponse.status < 400,
    status: toolsResponse.status,
    body: JSON.stringify({ sessionId: sessionId ?? null, toolCount: tools.length, tools }, null, 2),
  }
}

async function executeMcpIntegration(payload: IntegrationExecutePayload) {
  const config = payload.config as {
    endpoint?: string
    launchCommand?: string
    authConfigJson?: string
  }
  if (config.endpoint) {
    return callMcpHttpEndpoint(config.endpoint, config.authConfigJson)
  }
  if (config.launchCommand) {
    const parsedCommand = parseWorkspaceCommand(config.launchCommand)
    const spawnCommand = resolveWorkspaceSpawnCommand(parsedCommand)
    return new Promise<{ ok: boolean; status: number; body: string }>((resolve) => {
      const child = spawn(spawnCommand.executable, spawnCommand.args, { shell: spawnCommand.shell, windowsHide: true })
      const chunks: Buffer[] = []
      const errors: Buffer[] = []
      const timer = setTimeout(() => {
        child.kill()
        resolve({
          ok: true,
          status: 200,
          body: `Spawned command: ${parsedCommand.executable} ${parsedCommand.args.join(" ")}\n${Buffer.concat(chunks).toString("utf8")}\n${Buffer.concat(errors).toString("utf8")}`,
        })
      }, 2000)
      child.stdout.on("data", (chunk) => chunks.push(Buffer.from(chunk)))
      child.stderr.on("data", (chunk) => errors.push(Buffer.from(chunk)))
      child.on("close", (code) => {
        clearTimeout(timer)
        resolve({
          ok: code === 0,
          status: code ?? 0,
          body:
            Buffer.concat(chunks).toString("utf8") ||
            Buffer.concat(errors).toString("utf8") ||
            `Process exited with code ${code}`,
        })
      })
      child.on("error", (error) => {
        clearTimeout(timer)
        resolve({ ok: false, status: 500, body: error.message })
      })
    })
  }
  return { ok: false, status: 400, body: "MCP integration requires endpoint or launch command." }
}

export async function executeIntegration(payload: IntegrationExecutePayload) {
  try {
    if (payload.kind === "http") return await executeHttpIntegration(payload)
    if (payload.kind === "scripts") return await executeSandboxedScriptIntegration(payload)
    return await executeMcpIntegration(payload)
  } catch (error) {
    return { ok: false, status: 500, body: error instanceof Error ? error.message : String(error) }
  }
}
