import { interpolate } from "@/electron/app/workflows/variable-context"
import type { WorkflowNodeExecutor } from "@/types/workflow-runtime"

const RESERVED_VARIABLE_NAMES = new Set(["current", "input", "runtime", "steps", "vars"])

export const executeVariableNode: WorkflowNodeExecutor = async (node, context) => {
  const name = node.data.variableName || "variable"
  if (RESERVED_VARIABLE_NAMES.has(name)) {
    throw new Error(`Variable name '${name}' is reserved by the workflow runtime.`)
  }
  const value = interpolate(node.data.variableValue, context)
  context.vars[name] = value
  return value
}
