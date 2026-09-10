import type { DatabaseSync } from "node:sqlite"

export function assertWorkflowVersion(database: DatabaseSync, workflowId: string, versionId: string) {
  const row = database.prepare(`SELECT workflows.id FROM workflows INNER JOIN workflow_versions ON workflow_versions.workflow_id = workflows.id WHERE workflows.id = ? AND workflow_versions.id = ?`).get(workflowId, versionId)
  if (!row) {
    throw new Error("Workflow or version not found")
  }
}
