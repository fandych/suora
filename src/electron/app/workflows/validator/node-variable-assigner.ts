import type { Node } from "@xyflow/react"
import type { WorkflowNodeData } from "@/types/workflow"
import type { WorkflowValidationIssue } from "@/lib/workflow/validator"
import { createIssue, requireValue } from "@/lib/workflow/validator/node/types"

const RESERVED_VARIABLE_NAMES = new Set(["current", "input", "runtime", "steps", "vars"])

export function validateVariableAssignerNode(node: Node<WorkflowNodeData>): WorkflowValidationIssue[] {
  const issues = [
    ...requireValue(node, node.data.variableName, "Variable assignment needs a variable name."),
    ...requireValue(node, node.data.variableValue, "Variable assignment needs a value expression."),
  ]
  const variableName = node.data.variableName?.trim()
  if (variableName && RESERVED_VARIABLE_NAMES.has(variableName)) {
    issues.push(createIssue(node, `Variable name '${variableName}' is reserved by the workflow runtime.`))
  }
  return issues
}
