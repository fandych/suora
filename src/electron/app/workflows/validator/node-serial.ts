import type { Node } from "@xyflow/react"
import type { WorkflowNodeData } from "@/types/workflow"
import type { WorkflowValidationIssue } from "@/lib/workflow/validator"

export function validateSerialNode(_node: Node<WorkflowNodeData>): WorkflowValidationIssue[] {
  return []
}