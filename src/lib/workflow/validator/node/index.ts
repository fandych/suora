import type { Node } from "@xyflow/react"
import type { WorkflowNodeData } from "@/types/workflow"
import type { WorkflowValidationIssue } from "@/lib/workflow/validator"
import type { NodePropertyValidationContext } from "@/lib/workflow/validator/node/types"
import { validateAgentNodeProperties } from "@/lib/workflow/validator/node/agent"
import { validateConditionNodeProperties } from "@/lib/workflow/validator/node/condition"
import { validateIfElseNodeProperties } from "@/lib/workflow/validator/node/if-else"
import { validateLoopNodeProperties } from "@/lib/workflow/validator/node/loop"
import { validateWorkflowNodeProperties } from "@/lib/workflow/validator/node-properties"

export function validateNodeProperties(
  node: Node<WorkflowNodeData>,
  context: NodePropertyValidationContext,
): WorkflowValidationIssue[] {
  switch (node.data.kind) {
    case "agent":
      return validateAgentNodeProperties(node, context)
    case "condition":
      return validateConditionNodeProperties(node)
    case "if-else":
      return validateIfElseNodeProperties(node)
    case "loop":
      return validateLoopNodeProperties(node)
    default:
      return validateWorkflowNodeProperties(node, context)
  }
}
