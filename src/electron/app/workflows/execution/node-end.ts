import { interpolate } from "@/electron/app/workflows/variable-context"
import type { WorkflowNodeExecutor } from "@/types/workflow-runtime"

export const executeEndNode: WorkflowNodeExecutor = async (node, context) =>
  node.data.inputTemplate || node.data.template
    ? interpolate(node.data.inputTemplate || node.data.template, context)
    : { input: context.input, vars: context.vars }
