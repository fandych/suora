import type { Node } from "@xyflow/react"
import type { WorkflowNodeData } from "@/types/workflow"
import type { WorkflowValidationIssue } from "@/lib/workflow/validator"
import { requireValue } from "@/lib/workflow/validator/node/types"

export function validateTemplateNode(node: Node<WorkflowNodeData>): WorkflowValidationIssue[] {
  return requireValue(node, node.data.template, "Template node needs a template body.")
}
