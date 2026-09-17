import type { Node } from "@xyflow/react"
import type { WorkflowNodeData } from "@/types/workflow"
import type { WorkflowValidationIssue } from "@/lib/workflow/validator"

export type WorkflowPropertyValidationContext = {
  availableAgentIds: string[]
  availableDocumentIds: string[]
  availableIntegrationIds: string[]
  availableModelIds: string[]
}

const issue = (node: Node<WorkflowNodeData>, message: string): WorkflowValidationIssue => ({
  nodeId: node.id,
  label: node.data.label.trim() || node.id,
  message,
  severity: "error",
})

const required = (node: Node<WorkflowNodeData>, value: string | undefined, message: string) =>
  value?.trim() ? [] : [issue(node, message)]

export function validateWorkflowNodeProperties(
  node: Node<WorkflowNodeData>,
  context: WorkflowPropertyValidationContext,
): WorkflowValidationIssue[] {
  const data = node.data
  const issues: WorkflowValidationIssue[] = []
  if (!data.label.trim()) issues.push(issue(node, "Node label is empty."))
  switch (data.kind) {
    case "agent":
      issues.push(...required(node, data.prompt, "Agent node is missing a prompt."))
      if (data.agentId?.trim() && !context.availableAgentIds.includes(data.agentId))
        issues.push(issue(node, "Agent binding no longer exists in the workspace."))
      if (data.modelId?.trim() && !context.availableModelIds.includes(data.modelId))
        issues.push(issue(node, "Model override no longer exists in the configured provider catalog."))
      break
    case "http":
      if (!data.integrationId?.trim() && !data.url?.trim())
        issues.push(issue(node, "HTTP node needs a bound integration or URL."))
      if (data.integrationId?.trim() && !context.availableIntegrationIds.includes(data.integrationId))
        issues.push(issue(node, "Bound integration no longer exists in the workspace."))
      break
    case "document-retrieval":
      issues.push(...required(node, data.documentId, "Document retrieval node has no source document."))
      if (data.documentId?.trim() && !context.availableDocumentIds.includes(data.documentId))
        issues.push(issue(node, "Bound document no longer exists in the workspace."))
      break
    case "script":
      issues.push(...required(node, data.script, "Script node has no script body."))
      if (
        !Number.isFinite(data.timeoutSeconds) ||
        (data.timeoutSeconds ?? 0) < 1 ||
        (data.timeoutSeconds ?? 0) > 60
      )
        issues.push(issue(node, "Script timeout must be between 1 and 60 seconds."))
      break
    case "variable-assigner":
      issues.push(...required(node, data.variableName, "Variable assignment needs a variable name."))
      issues.push(...required(node, data.variableValue, "Variable assignment needs a value expression."))
      break
    case "template":
      issues.push(...required(node, data.template, "Template node needs a template body."))
      break
    case "smtp":
      issues.push(...required(node, data.emailTo, "Email node needs a recipient."))
      if (data.emailTo?.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.emailTo.trim()))
        issues.push(issue(node, "Email recipient must be a valid email address or expression."))
      issues.push(...required(node, data.emailSubject, "Email node needs a subject."))
      issues.push(...required(node, data.emailBody, "Email node needs a message."))
      break
    case "loop":
      issues.push(...required(node, data.loopExpression, "Loop node needs a collection expression."))
      if (!Number.isInteger(data.maxIterations) || (data.maxIterations ?? 0) < 1 || (data.maxIterations ?? 0) > 100)
        issues.push(issue(node, "Loop maximum iterations must be between 1 and 100."))
      break
    case "condition":
      issues.push(...required(node, data.runIf, "Condition node needs an expression."))
      break
    case "if-else": {
      const branches = Array.isArray(data.branches) ? data.branches : []
      if (branches.length < 2) issues.push(issue(node, "If / Else node needs at least an if and an else branch."))
      if (branches.length > 0 && !branches.at(-1)?.label.trim())
        issues.push(issue(node, "If / Else else branch needs a label."))
      if (
        !data.runIf?.trim() &&
        !branches.some((branch) => typeof branch?.expression === "string" && branch.expression.trim())
      )
        issues.push(issue(node, "Conditional node needs at least one branch expression."))
      if (branches.slice(0, -1).some((branch) => !branch.label.trim() || !branch.expression.trim()))
        issues.push(issue(node, "Every If / Else conditional branch needs a label and expression."))
      break
    }
  }
  return issues
}
