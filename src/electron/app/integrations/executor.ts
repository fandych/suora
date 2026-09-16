import { spawn } from "node:child_process"

import { requestHttp } from "@/electron/infrastructure/http-client"
import { assertSafeHttpUrl } from "@/electron/infrastructure/url-security"
import { executeSandboxedScriptIntegration } from "@/electron/app/integrations/script-runner"
import { parseWorkspaceCommand } from "@/electron/app/tools/tool-guardrails"
import {
  applyIntegrationAuth,
  buildIntegrationEndpointUrl,
  buildMultipartIntegrationBody,
  parseIntegrationJson,
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
  const headers = parseIntegrationJson<Record<string, string>>(selectedEndpoint?.headersJson ?? config.headersJson, {})
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
    if (parameter.in === "header") headers[parameter.name] = String(runtimeValue)
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

async function executeMcpIntegration(payload: IntegrationExecutePayload) {
  const config = payload.config as { endpoint?: string; launchCommand?: string }
  if (config.endpoint) {
    const probe = await executeHttpIntegration({
      kind: "http",
      config: { method: "GET", url: config.endpoint, headersJson: "{}", queryJson: "{}", bodyJson: "{}" },
    })
    return { ...probe, body: `MCP endpoint responded with status ${probe.status}\n\n${probe.body}` }
  }
  if (config.launchCommand) {
    const parsedCommand = parseWorkspaceCommand(config.launchCommand)
    return new Promise<{ ok: boolean; status: number; body: string }>((resolve) => {
      const child = spawn(parsedCommand.executable, parsedCommand.args, { shell: false, windowsHide: true })
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
