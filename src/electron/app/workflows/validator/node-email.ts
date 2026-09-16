import type { Node } from "@xyflow/react"
import type { WorkflowNodeData } from "@/types/workflow"
import type { WorkflowValidationIssue } from "@/lib/workflow/validator"
import { createIssue, requireValue } from "@/lib/workflow/validator/node/types"

export function validateEmailNode(node: Node<WorkflowNodeData>): WorkflowValidationIssue[] {
  const issues = [
    ...requireValue(node, node.data.emailTo, "Email node needs a recipient."),
    ...requireValue(node, node.data.emailSubject, "Email node needs a subject."),
    ...requireValue(node, node.data.emailBody, "Email node needs a message."),
  ]
  if (node.data.emailTo?.trim() && !/\$|\{\{|^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(node.data.emailTo.trim()))
    issues.push(createIssue(node, "Email recipient must be a valid email address or expression."))
  return issues
}
