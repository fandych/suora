import type { Node } from "@xyflow/react"
import type { WorkflowNodeData } from "@/types/workflow"
import type { WorkflowValidationIssue } from "@/lib/workflow/validator"
import { createIssue, requireValue, type NodePropertyValidationContext } from "@/lib/workflow/validator/node/types"

export function validateAiResponseNode(
  node: Node<WorkflowNodeData>,
  context: NodePropertyValidationContext,
): WorkflowValidationIssue[] {
  const issues = [...requireValue(node, node.data.prompt, "AI response node needs a prompt.")]
  if (node.data.modelId?.trim() && !context.availableModelIds.includes(node.data.modelId))
    issues.push(createIssue(node, "AI response model no longer exists in the configured provider catalog."))
  if (!Number.isFinite(node.data.temperature) || (node.data.temperature ?? -1) < 0 || (node.data.temperature ?? 3) > 2)
    issues.push(createIssue(node, "AI response temperature must be between 0 and 2."))
  if (!Number.isInteger(node.data.maxTokens) || (node.data.maxTokens ?? 0) < 1 || (node.data.maxTokens ?? 0) > 32768)
    issues.push(createIssue(node, "AI response maximum tokens must be between 1 and 32768."))
  return issues
}
