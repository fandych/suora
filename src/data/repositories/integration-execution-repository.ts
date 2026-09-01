import type { IntegrationConfig } from "@/data/domain/models"

export type IntegrationExecutionResult = {
  ok: boolean
  status: number
  body: string
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