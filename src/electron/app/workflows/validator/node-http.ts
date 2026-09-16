import type { Node } from "@xyflow/react"
import type { WorkflowNodeData } from "@/types/workflow"
import type { WorkflowValidationIssue } from "@/lib/workflow/validator"
import { createIssue, type NodePropertyValidationContext } from "@/lib/workflow/validator/node/types"

const methods = new Set(["GET", "POST", "PUT", "PATCH", "DELETE"])
const json = (node: Node<WorkflowNodeData>, value: string | undefined, label: string) => {
  if (!value?.trim()) return []
  try {
    JSON.parse(value)
    return []
  } catch {
    return [createIssue(node, `${label} must be valid JSON.`)]
  }
}

export function validateHttpNode(
  node: Node<WorkflowNodeData>,
  context: NodePropertyValidationContext,
): WorkflowValidationIssue[] {
  const issues: WorkflowValidationIssue[] = []
  if (!node.data.integrationId?.trim() && !node.data.url?.trim())
    issues.push(createIssue(node, "HTTP node needs a bound integration or URL."))
  if (
    node.data.integrationId?.trim() &&
    context.availableIntegrationIds.length > 0 &&
    !context.availableIntegrationIds.includes(node.data.integrationId)
  )
    issues.push(createIssue(node, "Bound integration no longer exists in the workspace."))
  if (node.data.url?.trim()) {
    try {
      const url = new URL(node.data.url)
      if (!["http:", "https:"].includes(url.protocol))
        issues.push(createIssue(node, "HTTP URL must use http or https."))
    } catch {
      issues.push(createIssue(node, "HTTP URL must be a valid URL."))
    }
  }
  if (!methods.has(node.data.method ?? "POST")) issues.push(createIssue(node, "HTTP method is not supported."))
  issues.push(
    ...json(node, node.data.headersJson, "Headers"),
    ...json(node, node.data.queryJson, "Query parameters"),
    ...json(node, node.data.bodyJson, "Body"),
  )
  return issues
}
