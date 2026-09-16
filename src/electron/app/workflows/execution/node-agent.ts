import type { WorkflowNodeExecutor } from "@/types/workflow-runtime"
import { interpolate } from "@/electron/app/workflows/variable-context"

export const executeAgentNode: WorkflowNodeExecutor = async (node, context) => {
  const runtime = (
    context as typeof context & {
      runtime?: {
        executeAgent: (input: {
          prompt: string
          systemPrompt?: string
          modelId?: string
          selectedAgentId?: string
        }) => Promise<unknown>
      }
    }
  ).runtime
  if (!runtime) throw new Error("Workflow runtime is missing agent execution capability.")
  return runtime.executeAgent({
    prompt: interpolate(node.data.prompt, context),
    systemPrompt: node.data.systemPrompt ? interpolate(node.data.systemPrompt, context) : undefined,
    modelId: node.data.modelId,
    selectedAgentId: node.data.agentId,
  })
}
