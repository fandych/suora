import type { Node } from "@xyflow/react"
import type { WorkflowNodeData } from "@/types/workflow"
import type { WorkflowValidationIssue } from "@/lib/workflow/validator"
import { createIssue } from "@/lib/workflow/validator/node/types"

export function validateEndNode(node: Node<WorkflowNodeData>): WorkflowValidationIssue[] {
  return node.data.outputKey?.trim() || node.data.inputTemplate?.trim()
    ? []
    : [createIssue(node, "End node needs an output key or result template.")]
}
