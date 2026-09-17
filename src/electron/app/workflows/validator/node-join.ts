import type { Node } from "@xyflow/react"
import type { WorkflowNodeData } from "@/types/workflow"
import type { WorkflowValidationIssue } from "@/lib/workflow/validator"
import { createIssue } from "@/lib/workflow/validator/node/types"

const strategies = new Set(["wait-all", "wait-any"])

export function validateJoinNode(node: Node<WorkflowNodeData>): WorkflowValidationIssue[] {
  if (!strategies.has(node.data.joinStrategy ?? "wait-all")) {
    return [createIssue(node, "Join strategy must be wait-all or wait-any.")]
  }
  return []
}