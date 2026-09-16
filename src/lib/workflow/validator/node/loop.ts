import type { Node } from "@xyflow/react"
import type { WorkflowNodeData } from "@/types/workflow"
import type { WorkflowValidationIssue } from "@/lib/workflow/validator"
import { createIssue, requireValue } from "@/lib/workflow/validator/node/types"

export function validateLoopNodeProperties(node: Node<WorkflowNodeData>): WorkflowValidationIssue[] {
  const issues = [...requireValue(node, node.data.loopExpression, "Loop node needs a collection expression.")]
  if (!node.data.itemAlias?.trim()) issues.push(createIssue(node, "Loop node needs an item variable name."))
  if (
    !Number.isInteger(node.data.maxIterations) ||
    (node.data.maxIterations ?? 0) < 1 ||
    (node.data.maxIterations ?? 0) > 100
  )
    issues.push(createIssue(node, "Loop maximum iterations must be between 1 and 100."))
  return issues
}
