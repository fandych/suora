import type { WorkflowDefinition, WorkflowInvocationRecord } from "@/data/domain/models"

export type WorkflowRunCommand = {
  requestId: string
  workflowId: string
  versionId: string
  definition: WorkflowDefinition
  input: unknown
  mode: "dry-run" | "manual"
}

export type WorkflowRunEvent = {
  requestId: string
  type: "started" | "trace" | "completed" | "failed" | "cancelled"
  trace?: WorkflowInvocationRecord["traces"][number]
  invocation?: WorkflowInvocationRecord
  error?: string
}
