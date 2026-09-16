import type { WorkflowNodeExecutor } from "@/types/workflow-runtime"
import type { HttpIntegrationConfig, IntegrationConfig } from "@/types/integration"
import { interpolate } from "@/electron/app/workflows/variable-context"

export const executeHttpNode: WorkflowNodeExecutor = async (node, context) => {
  const runtime = (
    context as typeof context & {
      runtime?: {
        executeIntegration: (
          config: HttpIntegrationConfig,
          inputJson: string,
          integrationId?: string,
        ) => Promise<unknown>
      }
    }
  ).runtime
  if (!runtime) throw new Error("Workflow runtime is missing integration execution capability.")
  const interpolateJson = (value: string | undefined) => interpolate(value ?? "{}", context)
  const config: IntegrationConfig = {
    kind: "http",
    baseUrl: interpolate(node.data.url ?? "", context),
    selectedEndpointId: "",
    endpoints: [],
    method: node.data.method ?? "POST",
    url: interpolate(node.data.url ?? "", context),
    description: node.data.integrationName ?? "Workflow HTTP request",
    headersJson: interpolateJson(node.data.headersJson),
    queryJson: interpolateJson(node.data.queryJson),
    bodyJson: interpolateJson(node.data.bodyJson),
    authType: "none",
    authConfigJson: "{}",
    parameterSchemaJson: "{}",
  } satisfies HttpIntegrationConfig
  return runtime.executeIntegration(config, interpolateJson(node.data.bodyJson), node.data.integrationId)
}
