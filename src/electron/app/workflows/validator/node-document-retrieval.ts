import type { Node } from "@xyflow/react"
import type { WorkflowNodeData } from "@/types/workflow"
import type { WorkflowValidationIssue } from "@/lib/workflow/validator"
import { createIssue, type NodePropertyValidationContext, requireValue } from "@/lib/workflow/validator/node/types"

export function validateDocumentRetrievalNode(
  node: Node<WorkflowNodeData>,
  context: NodePropertyValidationContext,
): WorkflowValidationIssue[] {
  const issues = [...requireValue(node, node.data.documentId, "Document retrieval node needs a source document.")]
  if (
    node.data.documentId?.trim() &&
    context.availableDocumentIds.length > 0 &&
    !context.availableDocumentIds.includes(node.data.documentId)
  )
    issues.push(createIssue(node, "Bound document no longer exists in the workspace."))
  issues.push(...requireValue(node, node.data.queryExpression, "Document retrieval node needs a search question."))
  if (!Number.isInteger(node.data.resultLimit) || (node.data.resultLimit ?? 0) < 1 || (node.data.resultLimit ?? 0) > 20)
    issues.push(createIssue(node, "Document retrieval result count must be between 1 and 20."))
  return issues
}
