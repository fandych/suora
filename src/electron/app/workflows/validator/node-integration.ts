import type { Node } from "@xyflow/react"
import type { WorkflowNodeData } from "@/types/workflow"
import type { WorkflowValidationIssue } from "@/lib/workflow/validator"
import { createIssue, type NodePropertyValidationContext } from "@/lib/workflow/validator/node/types"

export function validateIntegrationNode(
  node: Node<WorkflowNodeData>,
  context: NodePropertyValidationContext,
): WorkflowValidationIssue[] {
  return node.data.integrationId?.trim() &&
    (context.availableIntegrationIds.length === 0 || context.availableIntegrationIds.includes(node.data.integrationId))
    ? []
    : [createIssue(node, "Integration node needs a valid bound integration.")]
}
