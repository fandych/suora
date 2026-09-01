import http from "node:http"
import https from "node:https"
import { spawn } from "node:child_process"

import { getProxyAgent } from "@electron/others/proxy"
import type { IntegrationExecutePayload } from "@electron/types"

async function executeHttpIntegration(payload: IntegrationExecutePayload) {
  const config = payload.config as {
    method?: string
    url?: string
    headersJson?: string
    queryJson?: string
    bodyJson?: string
  }

  const baseUrl = new URL(config.url || "")
  const query = config.queryJson ? JSON.parse(config.queryJson) as Record<string, string> : {}
  for (const [key, value] of Object.entries(query)) {
    baseUrl.searchParams.set(key, String(value))
  }

  const body = config.bodyJson ? JSON.parse(config.bodyJson) : undefined
  const headers = config.headersJson ? JSON.parse(config.headersJson) as Record<string, string> : {}
  const transport = baseUrl.protocol === "https:" ? https : http

  return new Promise<{ ok: boolean; status: number; body: string }>((resolve, reject) => {
    const request = transport.request(baseUrl, {
      method: config.method || "GET",
      headers: {
        "content-type": "application/json",
        ...headers,
      },
      agent: getProxyAgent(baseUrl),
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
    if (body && config.method && config.method !== "GET") {
      request.write(JSON.stringify(body))
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
