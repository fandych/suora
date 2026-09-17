import type { Node } from "@xyflow/react"
import type { WorkflowNodeData } from "@/types/workflow"
import type { WorkflowValidationIssue } from "@/lib/workflow/validator"
import { createIssue } from "@/lib/workflow/validator/node/types"

export function validateForkNode(node: Node<WorkflowNodeData>): WorkflowValidationIssue[] {
  if (!Number.isInteger(node.data.branchCount) || (node.data.branchCount ?? 0) < 2 || (node.data.branchCount ?? 0) > 20) {
    return [createIssue(node, "Fork node branch count must be between 2 and 20.")]
  }
  return []
}