import { interpolate } from "@/electron/app/workflows/variable-context"
import type { WorkflowNodeExecutor } from "@/types/workflow-runtime"

export const executeConditionNode: WorkflowNodeExecutor = async (node, context) =>
  Boolean(interpolate(node.data.runIf || node.data.prompt, context))
