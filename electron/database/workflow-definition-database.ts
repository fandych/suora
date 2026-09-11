import crypto from "node:crypto"
import { createDefaultWorkflowDefinition, validateWorkflowDefinitionJson } from "@electron/others/services/workflow-definition"
import { getWorkflowDatabase } from "@electron/database/workflow-database-context"

export async function listWorkflowDefinitions() {
  const database = await getWorkflowDatabase()
  return database.prepare(`SELECT id, title, summary, updated_at as updatedAt FROM workflows ORDER BY updated_at DESC`).all()
}

export async function getWorkflowDefinitionRows(workflowId: string) {
  const database = await getWorkflowDatabase()
  return {
    workflow: database.prepare(`SELECT id, title, summary, updated_at as updatedAt FROM workflows WHERE id = ?`).get(workflowId) ?? null,
    versions: database.prepare(`SELECT id, major, minor, is_release as isRelease, created_at as createdAt, definition_json as definitionJson FROM workflow_versions WHERE workflow_id = ? ORDER BY major DESC, minor DESC, created_at DESC`).all(),
    invocations: database.prepare(`SELECT id, version_id as versionId, status, trigger, input_json as input, output_json as output, trace_json as traceJson, created_at as createdAt FROM workflow_invocations WHERE workflow_id = ? ORDER BY created_at DESC`).all(),
  }
}

export async function createWorkflowDefinition() {
  const database = await getWorkflowDatabase()
  const workflowId = crypto.randomUUID()
  const now = Date.now()
  database.prepare(`INSERT INTO workflows (id, title, summary, updated_at) VALUES (?, ?, ?, ?)`).run(workflowId, "New workflow", "", now)
  database.prepare(`INSERT INTO workflow_versions (id, workflow_id, major, minor, is_release, definition_json, created_at) VALUES (?, ?, 1, 0, 0, ?, ?)`).run(crypto.randomUUID(), workflowId, JSON.stringify(createDefaultWorkflowDefinition()), now)
  return getWorkflowDefinitionRows(workflowId)
}

export async function saveWorkflowDefinition(payload: { id: string; title: string; summary: string; definitionJson: string; selectedVersionId?: string; publish?: boolean }) {
  await getWorkflowDatabase()
  validateWorkflowDefinitionJson(payload.definitionJson)
  const database = await getWorkflowDatabase()
  const now = Date.now()
  const latest = database.prepare(`SELECT major, minor, is_release as isRelease FROM workflow_versions WHERE workflow_id = ? ORDER BY major DESC, minor DESC, created_at DESC LIMIT 1`).get(payload.id) as { major: number; minor: number; isRelease: number } | undefined
  const targetDraft = payload.selectedVersionId ? database.prepare(`SELECT id, is_release as isRelease FROM workflow_versions WHERE workflow_id = ? AND id = ? LIMIT 1`).get(payload.id, payload.selectedVersionId) as { id: string; isRelease: number } | undefined : undefined
  const selectedVersion = targetDraft && !targetDraft.isRelease ? targetDraft : database.prepare(`SELECT id FROM workflow_versions WHERE workflow_id = ? AND is_release = 0 ORDER BY major DESC, minor DESC, created_at DESC LIMIT 1`).get(payload.id) as { id: string } | undefined
  const nextMajor = !latest ? 1 : latest.isRelease ? latest.major + 1 : latest.major
  const nextMinor = !latest || latest.isRelease ? 0 : latest.minor + 1
  database.prepare(`UPDATE workflows SET title = ?, summary = ?, updated_at = ? WHERE id = ?`).run(payload.title, payload.summary, now, payload.id)
  if (!payload.publish && selectedVersion) database.prepare(`UPDATE workflow_versions SET definition_json = ?, created_at = ? WHERE id = ?`).run(payload.definitionJson, now, selectedVersion.id)
  else database.prepare(`INSERT INTO workflow_versions (id, workflow_id, major, minor, is_release, definition_json, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)`).run(crypto.randomUUID(), payload.id, nextMajor, nextMinor, payload.publish ? 1 : 0, payload.definitionJson, now)
  return database.prepare(`SELECT id, title, summary, updated_at as updatedAt FROM workflows WHERE id = ?`).get(payload.id)
}

export async function deleteWorkflowDefinition(workflowId: string) {
  const database = await getWorkflowDatabase()
  database.exec("BEGIN")
  try {
    database.prepare(`DELETE FROM workflow_invocations WHERE workflow_id = ?`).run(workflowId)
    database.prepare(`DELETE FROM workflow_versions WHERE workflow_id = ?`).run(workflowId)
    const result = database.prepare(`DELETE FROM workflows WHERE id = ?`).run(workflowId)
    database.exec("COMMIT")
    return Number(result.changes ?? 0) > 0
  } catch (error) {
    database.exec("ROLLBACK")
    throw error
  }
}
