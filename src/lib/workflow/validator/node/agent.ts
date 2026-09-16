import type { Node } from "@xyflow/react"
import type { WorkflowNodeData } from "@/types/workflow"
import type { WorkflowValidationIssue } from "@/lib/workflow/validator"
import { createIssue, requireValue, type NodePropertyValidationContext } from "@/lib/workflow/validator/node/types"

export function validateAgentNodeProperties(
  node: Node<WorkflowNodeData>,
  context: NodePropertyValidationContext,
): WorkflowValidationIssue[] {
  const issues = [...requireValue(node, node.data.prompt, "Agent node is missing a prompt.")]
  if (
    node.data.agentId?.trim() &&
    context.availableAgentIds.length > 0 &&
    !context.availableAgentIds.includes(node.data.agentId)
  )
    issues.push(createIssue(node, "Agent binding no longer exists in the workspace."))
  if (
    node.data.modelId?.trim() &&
    context.availableModelIds.length > 0 &&
    !context.availableModelIds.includes(node.data.modelId)
  )
    issues.push(createIssue(node, "Model override no longer exists in the configured provider catalog."))
  return issues
}
