import type { IntegrationConfig } from "@/data/domain/models"

export type IntegrationExecutionResult = {
  ok: boolean
  status: number
  body: string
  request?: {
    url: string
    method: string
    headers: Record<string, string>
    body: string | null
  }
  response?: {
    status: number
    headers: Record<string, string | string[]>
    body: string
    json?: unknown
  }
}

export async function executeIntegration(config: IntegrationConfig, inputJson = "{}") {
  const bridge = window.electron
  if (!bridge?.invoke) {
    throw new Error("Electron IPC bridge is not available.")
  }

  return bridge.invoke("integration:execute", {
    kind: config.kind,
    config,
    inputJson,
  }) as Promise<IntegrationExecutionResult>
}