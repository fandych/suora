import type { Edge, Node } from "@xyflow/react"
import type { WorkflowNodeData } from "@/types/workflow"
import type { WorkflowDesignIssue } from "@/lib/workflow/editor-state"

export type WorkflowValidationContext = {
  nodes: Node<WorkflowNodeData>[]
  edges: Edge[]
  availableAgentIds: string[]
  availableDocumentIds: string[]
  availableIntegrationIds: string[]
  availableModelIds: string[]
}

export type WorkflowNodeValidator = (
  node: Node<WorkflowNodeData>,
  context: WorkflowValidationContext,
) => WorkflowDesignIssue[]
