import type { WorkflowDefinition, WorkflowInvocationRecord } from "@/data/domain/workflow-models"
import { DEFAULT_WORKFLOW_NOTIFICATION_SETTINGS } from "@/domain/workflows/workflow-notifications"
export { DEFAULT_WORKFLOW_NOTIFICATION_SETTINGS }
import { projectIpc } from "@/lib/ipc"

export async function sendWorkflowNotification(input: {
  workflowTitle: string
  trigger: string
  invocation: WorkflowInvocationRecord
  definition: WorkflowDefinition
}) {
  if (input.trigger === "dry-run") return

  const notifications = input.definition.notifications ?? DEFAULT_WORKFLOW_NOTIFICATION_SETTINGS
  if (!notifications.enabled || !notifications.to.trim()) return
  if (notifications.triggerOn === "manual" && input.trigger !== "manual") return
  if (notifications.triggerOn === "dry-run" && input.trigger !== "dry-run") return

  const output = JSON.parse(input.invocation.output) as {
    summary?: string
    traversedNodes?: string
    skippedNodes?: number
  }
  const subject = notifications.subjectTemplate
    .replace(/\{\{workflowTitle\}\}/g, input.workflowTitle)
    .replace(/\{\{status\}\}/g, input.invocation.status)
    .replace(/\{\{trigger\}\}/g, input.trigger)
  const lines = [
    `Workflow: ${input.workflowTitle}`,
    `Trigger: ${input.trigger}`,
    `Status: ${input.invocation.status}`,
  ]

  if (notifications.includeSummary) {
    lines.push("", output.summary ?? "No summary available.")
    if (output.traversedNodes) lines.push(`Traversed nodes: ${output.traversedNodes}`)
    if (typeof output.skippedNodes === "number") lines.push(`Skipped nodes: ${output.skippedNodes}`)
  }

  if (notifications.includeTrace) {
    lines.push("", "Trace:")
    for (const trace of input.invocation.traces) {
      lines.push(`- ${trace.label}: ${trace.status} | ${trace.output}`)
    }
  }

  await projectIpc.mail.send({
    to: notifications.to.trim(),
    subject,
    content: lines.join("\n"),
  })
}
