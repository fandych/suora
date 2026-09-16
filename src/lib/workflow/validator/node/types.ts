import type { Node } from "@xyflow/react"
import type { WorkflowNodeData } from "@/types/workflow"
import type { WorkflowValidationIssue } from "@/lib/workflow/validator"

export type NodePropertyValidationContext = {
  availableAgentIds: string[]
  availableDocumentIds: string[]
  availableIntegrationIds: string[]
  availableModelIds: string[]
}

export type NodePropertyValidator = (
  node: Node<WorkflowNodeData>,
  context: NodePropertyValidationContext,
) => WorkflowValidationIssue[]

export const createIssue = (node: Node<WorkflowNodeData>, message: string): WorkflowValidationIssue => ({
  nodeId: node.id,
  label: node.data.label.trim() || node.id,
  message,
  severity: "error",
})

export const requireValue = (node: Node<WorkflowNodeData>, value: string | undefined, message: string) =>
  value?.trim() ? [] : [createIssue(node, message)]
