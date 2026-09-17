import { evaluateExpression } from "@/electron/app/workflows/expression"
import type { WorkflowNodeExecutor } from "@/types/workflow-runtime"

export const executeConditionNode: WorkflowNodeExecutor = async (node, context) =>
  evaluateExpression(node.data.runIf || node.data.prompt || "", context)
