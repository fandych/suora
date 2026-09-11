import { getWorkflowDatabase } from "@electron/database/workflow-database-context"

export async function assertWorkflowVersionExists(workflowId: string, versionId: string) {
  const database = await getWorkflowDatabase()
  const row = database.prepare(`SELECT id FROM workflow_versions WHERE workflow_id = ? AND id = ? LIMIT 1`).get(workflowId, versionId)
  if (!row) throw new Error("Workflow or version not found")
  return row
}
