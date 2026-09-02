import http from "node:http"
import https from "node:https"
import { spawn } from "node:child_process"

import { getProxyAgent } from "@electron/others/proxy"
import type { IntegrationExecutePayload } from "@electron/types"

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

function buildEndpointUrl(baseUrl: string | undefined, path: string | undefined) {
  if (!baseUrl?.trim()) {
    return path || ""
  }

  try {
    return new URL(path || "/", baseUrl).toString()
  } catch {
    return `${baseUrl}${path?.startsWith("/") ? path : `/${path || ""}`}`
  }
}

function applyHttpAuth(headers: Record<string, string>, url: URL, config: { authType?: string; authConfigJson?: string }) {
  const authConfig = parseJson<Record<string, string>>(config.authConfigJson, {})

  switch (config.authType) {
    case "bearer":
      if (authConfig.token) {
        headers.Authorization = `Bearer ${authConfig.token}`
      }
      break
    case "basic":
      if (authConfig.username || authConfig.password) {
        const credentials = Buffer.from(`${authConfig.username || ""}:${authConfig.password || ""}`).toString("base64")
        headers.Authorization = `Basic ${credentials}`
      } else if (authConfig.credentials) {
        headers.Authorization = `Basic ${authConfig.credentials}`
      }
      break
    case "api-key": {
      const location = authConfig.location || "header"
      const name = authConfig.name || "x-api-key"
      const value = authConfig.value || ""
      if (location === "query") {
        url.searchParams.set(name, value)
      } else {
        headers[name] = value
      }
      break
    }
    case "custom":
      Object.assign(headers, authConfig)
      break
  }
}

function buildMultipartBody(fields: Record<string, unknown>, boundary: string) {
  const chunks = Object.entries(fields).map(([key, value]) => [
    `--${boundary}`,
    `Content-Disposition: form-data; name="${key}"`,
    "",
    String(value ?? ""),
  ].join("\r\n"))

  return `${chunks.join("\r\n")}\r\n--${boundary}--\r\n`
}

async function executeHttpIntegration(payload: IntegrationExecutePayload) {
  const config = payload.config as {
    baseUrl?: string
    authType?: string
    authConfigJson?: string
    selectedEndpointId?: string
    endpoints?: Array<{
      id?: string
      method?: string
      path?: string
      headersJson?: string
      queryJson?: string
      bodyJson?: string
      bodyMode?: string
      parameters?: Array<{ name?: string; in?: string; defaultValue?: string }>
    }>
    method?: string
    url?: string
    headersJson?: string
    queryJson?: string
    bodyJson?: string
  }

  const selectedEndpoint = config.endpoints?.find((endpoint) => endpoint.id === config.selectedEndpointId) ?? config.endpoints?.[0]
  const requestUrl = selectedEndpoint
    ? buildEndpointUrl(config.baseUrl, selectedEndpoint.path)
    : (config.url || "")
  const url = new URL(requestUrl)
  const input = parseJson<Record<string, unknown>>(payload.inputJson, {})
  const query = parseJson<Record<string, string>>(selectedEndpoint?.queryJson ?? config.queryJson, {})
  const headers = parseJson<Record<string, string>>(selectedEndpoint?.headersJson ?? config.headersJson, {})
  const endpointParameters = selectedEndpoint?.parameters ?? []

  for (const parameter of endpointParameters) {
    if (!parameter.name) {
      continue
    }

    const runtimeValue = input[parameter.name] ?? parameter.defaultValue ?? ""
    if (parameter.in === "path") {
      url.pathname = url.pathname
        .replaceAll(`{${parameter.name}}`, encodeURIComponent(String(runtimeValue)))
        .replaceAll(`:${parameter.name}`, encodeURIComponent(String(runtimeValue)))
    }
    if (parameter.in === "query") {
      query[parameter.name] = String(runtimeValue)
    }
    if (parameter.in === "header") {
      headers[parameter.name] = String(runtimeValue)
    }
  }

  for (const [key, value] of Object.entries(query)) {
    url.searchParams.set(key, String(value))
  }

  applyHttpAuth(headers, url, config)

  const bodyMode = selectedEndpoint?.bodyMode ?? "json"
  const bodyConfig = parseJson<Record<string, unknown>>(selectedEndpoint?.bodyJson ?? config.bodyJson, {})
  const transport = url.protocol === "https:" ? https : http
  let body: string | undefined

  if (bodyMode === "json") {
    const jsonFields = endpointParameters
      .filter((parameter) => parameter.in === "json")
      .reduce<Record<string, unknown>>((accumulator, parameter) => {
        if (parameter.name) {
          accumulator[parameter.name] = input[parameter.name] ?? parameter.defaultValue ?? ""
        }
        return accumulator
      }, {})
    const payloadBody = { ...bodyConfig, ...jsonFields }
    body = JSON.stringify(payloadBody)
    headers["content-type"] = headers["content-type"] || "application/json"
  }

  if (bodyMode === "x-www-form-urlencoded") {
    const formPayload = new URLSearchParams()
    for (const [key, value] of Object.entries(bodyConfig)) {
      formPayload.set(key, String(value ?? ""))
    }
    for (const parameter of endpointParameters.filter((item) => item.in === "form-data")) {
      if (parameter.name) {
        formPayload.set(parameter.name, String(input[parameter.name] ?? parameter.defaultValue ?? ""))
      }
    }
    body = formPayload.toString()
    headers["content-type"] = headers["content-type"] || "application/x-www-form-urlencoded"
  }

  if (bodyMode === "form-data") {
    const boundary = `----suora-${Date.now().toString(16)}`
    const formFields: Record<string, unknown> = { ...bodyConfig }
    for (const parameter of endpointParameters.filter((item) => item.in === "form-data")) {
      if (parameter.name) {
        formFields[parameter.name] = input[parameter.name] ?? parameter.defaultValue ?? ""
      }
    }
    body = buildMultipartBody(formFields, boundary)
    headers["content-type"] = `multipart/form-data; boundary=${boundary}`
  }

  return new Promise<{ ok: boolean; status: number; body: string }>((resolve, reject) => {
    const request = transport.request(url, {
      method: selectedEndpoint?.method || config.method || "GET",
      headers,
      agent: getProxyAgent(url),
    }, (response) => {
      const chunks: Buffer[] = []
      response.on("data", (chunk: Buffer) => chunks.push(chunk))
      response.on("end", () => {
        resolve({
          ok: (response.statusCode ?? 500) < 400,
          status: response.statusCode ?? 500,
          body: Buffer.concat(chunks).toString("utf8"),
        })
      })
    })

    request.on("error", reject)
    request.setTimeout(60_000, () => request.destroy(new Error("HTTP integration timed out")))
    if (body && (selectedEndpoint?.method || config.method || "GET") !== "GET") {
      request.write(body)
    }
    request.end()
  })
}

async function executeScriptIntegration(payload: IntegrationExecutePayload) {
  const config = payload.config as {
    scripts?: Array<{ id: string; handler: string; code: string }>
    selectedScriptId?: string
  }

  const selectedScript = config.scripts?.find((item) => item.id === config.selectedScriptId) ?? config.scripts?.[0]

  if (!selectedScript) {
    return {
      ok: false,
      status: 400,
      body: "No script entry is configured.",
    }
  }

  const AsyncFunction = Object.getPrototypeOf(async function () { }).constructor as new (...args: string[]) => (input: unknown) => Promise<unknown>
  const compiled = new AsyncFunction(`${selectedScript.code || ""}; return typeof ${selectedScript.handler || "main"} === 'function' ? ${selectedScript.handler || "main"}(input) : { ok: false, error: 'Handler not found' };`)
  const parsedInput = payload.inputJson ? JSON.parse(payload.inputJson) : {}
  const output = await compiled(parsedInput)
  return {
    ok: true,
    status: 200,
    body: JSON.stringify(output, null, 2),
  }
}

async function executeMcpIntegration(payload: IntegrationExecutePayload) {
  const config = payload.config as {
    endpoint?: string
    launchCommand?: string
  }

  if (config.endpoint) {
    const probe = await executeHttpIntegration({
      kind: "http",
      config: {
        method: "GET",
        url: config.endpoint,
        headersJson: "{}",
        queryJson: "{}",
        bodyJson: "{}",
      },
    })
    return {
      ...probe,
      body: `MCP endpoint responded with status ${probe.status}\n\n${probe.body}`,
    }
  }

  if (config.launchCommand) {
    return new Promise<{ ok: boolean; status: number; body: string }>((resolve) => {
      const child = spawn(config.launchCommand || "", { shell: true })
      const chunks: Buffer[] = []
      const errors: Buffer[] = []
      const timer = setTimeout(() => {
        child.kill()
        resolve({ ok: true, status: 200, body: `Spawned command: ${config.launchCommand}\n${Buffer.concat(chunks).toString("utf8")}\n${Buffer.concat(errors).toString("utf8")}` })
      }, 2000)

      child.stdout.on("data", (chunk) => chunks.push(Buffer.from(chunk)))
      child.stderr.on("data", (chunk) => errors.push(Buffer.from(chunk)))
      child.on("close", (code) => {
        clearTimeout(timer)
        resolve({ ok: code === 0, status: code ?? 0, body: Buffer.concat(chunks).toString("utf8") || Buffer.concat(errors).toString("utf8") || `Process exited with code ${code}` })
      })
      child.on("error", (error) => {
        clearTimeout(timer)
        resolve({ ok: false, status: 500, body: error.message })
      })
    })
  }

  return { ok: false, status: 400, body: "MCP integration requires endpoint or launch command." }
}

export function executeIntegration(payload: IntegrationExecutePayload) {
  if (payload.kind === "http") {
    return executeHttpIntegration(payload)
  }
  if (payload.kind === "scripts") {
    return executeScriptIntegration(payload)
  }
  return executeMcpIntegration(payload)
}
