import type { Node } from "@xyflow/react"
import type { WorkflowNodeData } from "@/types/workflow"
import type { WorkflowValidationIssue } from "@/lib/workflow/validator"
import { createIssue } from "@/lib/workflow/validator/node/types"

const strategies = new Set(["all-settled", "fail-fast"])

export function validateParallelNode(node: Node<WorkflowNodeData>): WorkflowValidationIssue[] {
  const issues: WorkflowValidationIssue[] = []
  if (!Number.isInteger(node.data.concurrency) || (node.data.concurrency ?? 0) < 2 || (node.data.concurrency ?? 0) > 20) {
    issues.push(createIssue(node, "Parallel node concurrency must be between 2 and 20."))
  }
  if (!strategies.has(node.data.mergeStrategy ?? "all-settled")) {
    issues.push(createIssue(node, "Parallel node merge strategy must be all-settled or fail-fast."))
  }
  return issues
}