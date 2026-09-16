import type { Node } from "@xyflow/react"
import type { WorkflowNodeData } from "@/types/workflow"
import type { WorkflowValidationIssue } from "@/lib/workflow/validator"
import { createIssue, requireValue } from "@/lib/workflow/validator/node/types"

export function validateScriptNode(node: Node<WorkflowNodeData>): WorkflowValidationIssue[] {
  const issues = [...requireValue(node, node.data.script, "Script node needs a script body.")]
  if (
    !Number.isFinite(node.data.timeoutSeconds) ||
    (node.data.timeoutSeconds ?? 0) < 1 ||
    (node.data.timeoutSeconds ?? 0) > 600
  )
    issues.push(createIssue(node, "Script timeout must be between 1 and 600 seconds."))
  if (!node.data.runtime?.trim()) issues.push(createIssue(node, "Script node needs a runtime."))
  return issues
}
