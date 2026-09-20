import { interpolate } from "@/electron/app/workflows/variable-context"
import type { WorkflowNodeExecutor } from "@/types/workflow-runtime"

export const executeVariableNode: WorkflowNodeExecutor = async (node, context) => {
  const name = node.data.variableName || "variable"
  const value = interpolate(node.data.variableValue, context)
  context.vars[name] = value
  return value
}
