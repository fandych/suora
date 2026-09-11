import type { IntegrationConfig } from "@/data/domain/integration-models"
import type { IntegrationExecutionResult } from "@/data/domain/integration-runtime-models"

export type { IntegrationExecutionResult } from "@/data/domain/integration-runtime-models"

export async function executeIntegration(config: IntegrationConfig, inputJson = "{}", integrationId?: string) {
  const bridge = window.electron
  if (!bridge?.invoke) {
    throw new Error("Electron IPC bridge is not available.")
  }

  return bridge.invoke("integration:execute", {
    ...(integrationId ? { integrationId } : {}),
    kind: config.kind,
    config,
    inputJson,
  }) as Promise<IntegrationExecutionResult>
}