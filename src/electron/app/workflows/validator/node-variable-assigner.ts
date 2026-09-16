import type { Node } from "@xyflow/react"
import type { WorkflowNodeData } from "@/types/workflow"
import type { WorkflowValidationIssue } from "@/lib/workflow/validator"
import { requireValue } from "@/lib/workflow/validator/node/types"

export function validateVariableAssignerNode(node: Node<WorkflowNodeData>): WorkflowValidationIssue[] {
  return [
    ...requireValue(node, node.data.variableName, "Variable assignment needs a variable name."),
    ...requireValue(node, node.data.variableValue, "Variable assignment needs a value expression."),
  ]
}
