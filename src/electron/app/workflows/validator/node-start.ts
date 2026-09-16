import type { Node } from "@xyflow/react"
import type { WorkflowNodeData } from "@/types/workflow"
import type { WorkflowValidationIssue } from "@/lib/workflow/validator"
import { createIssue } from "@/lib/workflow/validator/node/types"

export function validateStartNode(node: Node<WorkflowNodeData>): WorkflowValidationIssue[] {
  return node.data.inputSchemaJson?.trim() ? [] : [createIssue(node, "Start node needs an input schema.")]
}
