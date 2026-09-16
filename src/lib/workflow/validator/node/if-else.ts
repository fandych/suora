import type { Node } from "@xyflow/react"
import type { WorkflowNodeData } from "@/types/workflow"
import type { WorkflowValidationIssue } from "@/lib/workflow/validator"
import { createIssue } from "@/lib/workflow/validator/node/types"

export function validateIfElseNodeProperties(node: Node<WorkflowNodeData>): WorkflowValidationIssue[] {
  const branches = Array.isArray(node.data.branches) ? node.data.branches : []
  const issues: WorkflowValidationIssue[] = []
  const branchIds = new Set<string>()
  if (branches.length < 2) issues.push(createIssue(node, "If / Else node needs at least an if and an else branch."))
  for (const branch of branches) {
    if (!branch.id.trim() || branchIds.has(branch.id))
      issues.push(createIssue(node, "If / Else branches need unique non-empty ids."))
    branchIds.add(branch.id)
  }
  if (
    !node.data.runIf?.trim() &&
    !branches.some((branch) => typeof branch?.expression === "string" && branch.expression.trim())
  )
    issues.push(createIssue(node, "Conditional node needs at least one branch expression."))
  if (branches.slice(0, -1).some((branch) => !branch.label.trim() || !branch.expression.trim()))
    issues.push(createIssue(node, "Every If / Else conditional branch needs a label and expression."))
  if (branches.length > 0 && branches.at(-1)?.expression.trim())
    issues.push(createIssue(node, "The final If / Else branch must be the unconditional else branch."))
  return issues
}
