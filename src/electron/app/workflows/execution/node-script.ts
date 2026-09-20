import type { IntegrationConfig, ScriptIntegrationConfig } from "@/types/integration"
import type { WorkflowNodeExecutor } from "@/types/workflow-runtime"

function serializeScriptInput(input: unknown) {
  if (typeof input === "string") {
    return input
  }

  return JSON.stringify(input ?? {})
}

export const executeScriptNode: WorkflowNodeExecutor = async (node, context, _mode, signal) => {
  const runtime = (
    context as typeof context & {
      runtime?: {
        executeIntegration: (
          config: ScriptIntegrationConfig,
          inputJson: string,
          integrationId?: string,
          abortSignal?: AbortSignal,
        ) => Promise<unknown>
      }
    }
  ).runtime
  if (!runtime) throw new Error("Workflow runtime is missing integration execution capability.")

  const scriptId = `${node.id}-script`
  const config: IntegrationConfig = {
    kind: "scripts",
    description: node.data.label || "Workflow script",
    runtime: (node.data.runtime || "node").trim().toLowerCase(),
    timeoutMs: Math.max(1000, Math.min((node.data.timeoutSeconds ?? 60) * 1000, 60_000)),
    inputSchemaJson: node.data.inputSchemaJson ?? "{}",
    outputSchemaJson: node.data.outputSchemaJson ?? "{}",
    selectedScriptId: scriptId,
    scripts: [
      {
        id: scriptId,
        name: node.data.label || "Workflow script",
        handler: "main",
        code: node.data.script ?? "",
      },
    ],
  } satisfies ScriptIntegrationConfig

  const result = await runtime.executeIntegration(config, serializeScriptInput(context.current ?? context.input), node.data.integrationId, signal)
  if (result && typeof result === "object" && "ok" in result && result.ok === false) {
    const error = "error" in result && typeof result.error === "string" ? result.error : "Integration execution failed."
    throw new Error(error)
  }

  return result
}