import crypto from "node:crypto"
import { ipcMain } from "electron"

import { applyMigrations, openDatabase } from "@electron/database/db-core"
import { ensureWorkspace } from "@electron/others/workspace"
import { createDefaultWorkflowDefinition, validateWorkflowDefinitionJson } from "@electron/ipc/workflow/workflow-definition"

export function registerWorkflowIpc() {
  ipcMain.handle("workflows:list", async () => {
    await ensureWorkspace(); const database = openDatabase(); applyMigrations(database)
    return database.prepare(`SELECT id, title, summary, updated_at as updatedAt FROM workflows ORDER BY updated_at DESC`).all()
  })
  ipcMain.handle("workflows:get", async (_event, workflowId: string) => {
    await ensureWorkspace(); const database = openDatabase(); applyMigrations(database)
    return {
      workflow: database.prepare(`SELECT id, title, summary, updated_at as updatedAt FROM workflows WHERE id = ?`).get(workflowId) ?? null,
      versions: database.prepare(`SELECT id, major, minor, is_release as isRelease, created_at as createdAt, definition_json as definitionJson FROM workflow_versions WHERE workflow_id = ? ORDER BY major DESC, minor DESC, created_at DESC`).all(workflowId),
      invocations: database.prepare(`SELECT id, version_id as versionId, status, trigger, input_json as input, output_json as output, trace_json as traceJson, created_at as createdAt FROM workflow_invocations WHERE workflow_id = ? ORDER BY created_at DESC`).all(workflowId),
    }
  })
  ipcMain.handle("workflows:create", async () => {
    await ensureWorkspace(); const database = openDatabase(); applyMigrations(database)
    const workflowId = crypto.randomUUID(); const now = Date.now(); const definition = JSON.stringify(createDefaultWorkflowDefinition())
    database.prepare(`INSERT INTO workflows (id, title, summary, updated_at) VALUES (?, ?, ?, ?)`).run(workflowId, "New workflow", "", now)
    database.prepare(`INSERT INTO workflow_versions (id, workflow_id, major, minor, is_release, definition_json, created_at) VALUES (?, ?, 1, 0, 0, ?, ?)`).run(crypto.randomUUID(), workflowId, definition, now)
    return {
      workflow: database.prepare(`SELECT id, title, summary, updated_at as updatedAt FROM workflows WHERE id = ?`).get(workflowId),
      versions: database.prepare(`SELECT id, major, minor, is_release as isRelease, created_at as createdAt, definition_json as definitionJson FROM workflow_versions WHERE workflow_id = ? ORDER BY major DESC, minor DESC, created_at DESC`).all(workflowId),
      invocations: [],
    }
  })
  ipcMain.handle("workflows:save", async (_event, payload: { id: string; title: string; summary: string; definitionJson: string; selectedVersionId?: string; publish?: boolean }) => {
    await ensureWorkspace(); validateWorkflowDefinitionJson(payload.definitionJson)
    const database = openDatabase(); applyMigrations(database); const now = Date.now()
    const latest = database.prepare(`SELECT major, minor, is_release as isRelease FROM workflow_versions WHERE workflow_id = ? ORDER BY major DESC, minor DESC, created_at DESC LIMIT 1`).get(payload.id) as { major: number; minor: number; isRelease: number } | undefined
    const targetDraft = payload.selectedVersionId ? database.prepare(`SELECT id, is_release as isRelease FROM workflow_versions WHERE workflow_id = ? AND id = ? LIMIT 1`).get(payload.id, payload.selectedVersionId) as { id: string; isRelease: number } | undefined : undefined
    const selectedVersion = targetDraft && !targetDraft.isRelease ? targetDraft : database.prepare(`SELECT id FROM workflow_versions WHERE workflow_id = ? AND is_release = 0 ORDER BY major DESC, minor DESC, created_at DESC LIMIT 1`).get(payload.id) as { id: string } | undefined
    const nextMajor = !latest ? 1 : latest.isRelease ? latest.major + 1 : latest.major
    const nextMinor = !latest || latest.isRelease ? 0 : latest.minor + 1
    database.prepare(`UPDATE workflows SET title = ?, summary = ?, updated_at = ? WHERE id = ?`).run(payload.title, payload.summary, now, payload.id)
    if (!payload.publish && selectedVersion) database.prepare(`UPDATE workflow_versions SET definition_json = ?, created_at = ? WHERE id = ?`).run(payload.definitionJson, now, selectedVersion.id)
    else database.prepare(`INSERT INTO workflow_versions (id, workflow_id, major, minor, is_release, definition_json, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)`).run(crypto.randomUUID(), payload.id, nextMajor, nextMinor, payload.publish ? 1 : 0, payload.definitionJson, now)
    return database.prepare(`SELECT id, title, summary, updated_at as updatedAt FROM workflows WHERE id = ?`).get(payload.id)
  })
  ipcMain.handle("workflows:delete", async (_event, workflowId: string) => {
    await ensureWorkspace(); const database = openDatabase(); applyMigrations(database); database.exec("BEGIN")
    try { database.prepare(`DELETE FROM workflow_invocations WHERE workflow_id = ?`).run(workflowId); database.prepare(`DELETE FROM workflow_versions WHERE workflow_id = ?`).run(workflowId); const result = database.prepare(`DELETE FROM workflows WHERE id = ?`).run(workflowId); database.exec("COMMIT"); return Number(result.changes ?? 0) > 0 } catch (error) { database.exec("ROLLBACK"); throw error }
  })
  ipcMain.handle("workflows:recordInvocation", async (_event, payload: { workflowId: string; versionId: string; status: string; trigger: string; input: string; output: string; traceJson: string }) => {
    await ensureWorkspace(); const database = openDatabase(); applyMigrations(database)
    database.prepare(`INSERT INTO workflow_invocations (id, workflow_id, version_id, status, trigger, input_json, output_json, trace_json, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(crypto.randomUUID(), payload.workflowId, payload.versionId, payload.status, payload.trigger, payload.input, payload.output, payload.traceJson, Date.now())
    return database.prepare(`SELECT id, version_id as versionId, status, trigger, input_json as input, output_json as output, trace_json as traceJson, created_at as createdAt FROM workflow_invocations WHERE workflow_id = ? ORDER BY created_at DESC`).all(payload.workflowId)
  })
}
