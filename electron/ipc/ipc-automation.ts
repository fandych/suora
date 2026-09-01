import crypto from "node:crypto"

import { ipcMain } from "electron"

import { applyMigrations, openDatabase } from "@electron/database/db-core"
import { ensureWorkspace } from "@electron/others/workspace"

export function registerAutomationIpc() {
  ipcMain.handle("integrations:list", async () => {
    await ensureWorkspace()
    const database = openDatabase()
    applyMigrations(database)
    return database.prepare(`SELECT id, title, kind, endpoint, updated_at as updatedAt FROM integrations ORDER BY updated_at DESC`).all()
  })

  ipcMain.handle("integrations:get", async (_event, integrationId: string) => {
    await ensureWorkspace()
    const database = openDatabase()
    applyMigrations(database)
    return {
      integration: database.prepare(`SELECT id, title, kind, endpoint, updated_at as updatedAt FROM integrations WHERE id = ?`).get(integrationId) ?? null,
      versions: database.prepare(`SELECT id, major, minor, is_release as isRelease, created_at as createdAt, config_json as configJson FROM integration_versions WHERE integration_id = ? ORDER BY major DESC, minor DESC, created_at DESC`).all(integrationId),
      executions: database.prepare(`SELECT id, version_id as versionId, status, input_json as input, output_json as output, created_at as createdAt FROM integration_executions WHERE integration_id = ? ORDER BY created_at DESC`).all(integrationId),
    }
  })

  ipcMain.handle("integrations:create", async (_event, payload?: Partial<{ kind: string; title: string; endpoint: string; configJson: string }>) => {
    await ensureWorkspace()
    const database = openDatabase()
    applyMigrations(database)
    const integrationId = crypto.randomUUID()
    const versionId = crypto.randomUUID()
    const now = Date.now()
    database.prepare(`INSERT INTO integrations (id, title, kind, endpoint, updated_at) VALUES (?, ?, ?, ?, ?)`).run(integrationId, payload?.title || `New ${payload?.kind || "http"} integration`, payload?.kind || "http", payload?.endpoint || "", now)
    database.prepare(`INSERT INTO integration_versions (id, integration_id, major, minor, is_release, config_json, created_at) VALUES (?, ?, 1, 0, 0, ?, ?)`).run(versionId, integrationId, payload?.configJson || "{}", now)
    return {
      integration: database.prepare(`SELECT id, title, kind, endpoint, updated_at as updatedAt FROM integrations WHERE id = ?`).get(integrationId),
      versions: database.prepare(`SELECT id, major, minor, is_release as isRelease, created_at as createdAt, config_json as configJson FROM integration_versions WHERE integration_id = ? ORDER BY major DESC, minor DESC, created_at DESC`).all(integrationId),
      executions: [],
    }
  })

  ipcMain.handle("integrations:save", async (_event, payload: { id: string; title: string; kind: string; endpoint: string; configJson: string; publish?: boolean }) => {
    await ensureWorkspace()
    const database = openDatabase()
    applyMigrations(database)
    const latest = database.prepare(`SELECT major, minor, is_release as isRelease FROM integration_versions WHERE integration_id = ? ORDER BY major DESC, minor DESC, created_at DESC LIMIT 1`).get(payload.id) as { major: number; minor: number; isRelease: number } | undefined
    const nextMajor = !latest ? 1 : latest.isRelease ? latest.major + 1 : latest.major
    const nextMinor = !latest ? 0 : latest.isRelease ? 0 : latest.minor + 1
    const versionId = crypto.randomUUID()
    const now = Date.now()
    database.prepare(`UPDATE integrations SET title = ?, kind = ?, endpoint = ?, updated_at = ? WHERE id = ?`).run(payload.title, payload.kind, payload.endpoint, now, payload.id)
    database.prepare(`INSERT INTO integration_versions (id, integration_id, major, minor, is_release, config_json, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)`).run(versionId, payload.id, nextMajor, nextMinor, payload.publish ? 1 : 0, payload.configJson, now)
    return {
      integration: database.prepare(`SELECT id, title, kind, endpoint, updated_at as updatedAt FROM integrations WHERE id = ?`).get(payload.id),
      versions: database.prepare(`SELECT id, major, minor, is_release as isRelease, created_at as createdAt, config_json as configJson FROM integration_versions WHERE integration_id = ? ORDER BY major DESC, minor DESC, created_at DESC`).all(payload.id),
      executions: database.prepare(`SELECT id, version_id as versionId, status, input_json as input, output_json as output, created_at as createdAt FROM integration_executions WHERE integration_id = ? ORDER BY created_at DESC`).all(payload.id),
    }
  })

  ipcMain.handle("integrations:recordExecution", async (_event, payload: { id: string; versionId: string; status: string; input: string; output: string }) => {
    await ensureWorkspace()
    const database = openDatabase()
    applyMigrations(database)
    database.prepare(`INSERT INTO integration_executions (id, integration_id, version_id, status, input_json, output_json, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)`).run(crypto.randomUUID(), payload.id, payload.versionId, payload.status, payload.input, payload.output, Date.now())
    return database.prepare(`SELECT id, version_id as versionId, status, input_json as input, output_json as output, created_at as createdAt FROM integration_executions WHERE integration_id = ? ORDER BY created_at DESC`).all(payload.id)
  })

  ipcMain.handle("workflows:list", async () => {
    await ensureWorkspace()
    const database = openDatabase()
    applyMigrations(database)
    return database.prepare(`SELECT id, title, summary, updated_at as updatedAt FROM workflows ORDER BY updated_at DESC`).all()
  })

  ipcMain.handle("workflows:get", async (_event, workflowId: string) => {
    await ensureWorkspace()
    const database = openDatabase()
    applyMigrations(database)
    return {
      workflow: database.prepare(`SELECT id, title, summary, updated_at as updatedAt FROM workflows WHERE id = ?`).get(workflowId) ?? null,
      versions: database.prepare(`SELECT id, major, minor, is_release as isRelease, created_at as createdAt, definition_json as definitionJson FROM workflow_versions WHERE workflow_id = ? ORDER BY major DESC, minor DESC, created_at DESC`).all(workflowId),
      invocations: database.prepare(`SELECT id, version_id as versionId, status, trigger, input_json as input, output_json as output, trace_json as traceJson, created_at as createdAt FROM workflow_invocations WHERE workflow_id = ? ORDER BY created_at DESC`).all(workflowId),
    }
  })

  ipcMain.handle("workflows:create", async () => {
    await ensureWorkspace()
    const database = openDatabase()
    applyMigrations(database)
    const workflowId = crypto.randomUUID()
    const versionId = crypto.randomUUID()
    const now = Date.now()
    const definition = JSON.stringify({ nodes: [{ id: "start", type: "input", position: { x: 60, y: 140 }, data: { label: "Start", prompt: "Capture input variables.", kind: "start" } }], edges: [], viewport: { x: 0, y: 0, zoom: 1 } })
    database.prepare(`INSERT INTO workflows (id, title, summary, updated_at) VALUES (?, ?, ?, ?)`).run(workflowId, "New workflow", "", now)
    database.prepare(`INSERT INTO workflow_versions (id, workflow_id, major, minor, is_release, definition_json, created_at) VALUES (?, ?, 1, 0, 0, ?, ?)`).run(versionId, workflowId, definition, now)
    return {
      workflow: database.prepare(`SELECT id, title, summary, updated_at as updatedAt FROM workflows WHERE id = ?`).get(workflowId),
      versions: database.prepare(`SELECT id, major, minor, is_release as isRelease, created_at as createdAt, definition_json as definitionJson FROM workflow_versions WHERE workflow_id = ? ORDER BY major DESC, minor DESC, created_at DESC`).all(workflowId),
      invocations: [],
    }
  })

  ipcMain.handle("workflows:save", async (_event, payload: { id: string; title: string; summary: string; definitionJson: string; publish?: boolean }) => {
    await ensureWorkspace()
    const database = openDatabase()
    applyMigrations(database)
    const latest = database.prepare(`SELECT major, minor, is_release as isRelease FROM workflow_versions WHERE workflow_id = ? ORDER BY major DESC, minor DESC, created_at DESC LIMIT 1`).get(payload.id) as { major: number; minor: number; isRelease: number } | undefined
    const nextMajor = !latest ? 1 : latest.isRelease ? latest.major + 1 : latest.major
    const nextMinor = !latest ? 0 : latest.isRelease ? 0 : latest.minor + 1
    const versionId = crypto.randomUUID()
    const now = Date.now()
    database.prepare(`UPDATE workflows SET title = ?, summary = ?, updated_at = ? WHERE id = ?`).run(payload.title, payload.summary, now, payload.id)
    database.prepare(`INSERT INTO workflow_versions (id, workflow_id, major, minor, is_release, definition_json, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)`).run(versionId, payload.id, nextMajor, nextMinor, payload.publish ? 1 : 0, payload.definitionJson, now)
    return {
      workflow: database.prepare(`SELECT id, title, summary, updated_at as updatedAt FROM workflows WHERE id = ?`).get(payload.id),
      versions: database.prepare(`SELECT id, major, minor, is_release as isRelease, created_at as createdAt, definition_json as definitionJson FROM workflow_versions WHERE workflow_id = ? ORDER BY major DESC, minor DESC, created_at DESC`).all(payload.id),
      invocations: database.prepare(`SELECT id, version_id as versionId, status, trigger, input_json as input, output_json as output, trace_json as traceJson, created_at as createdAt FROM workflow_invocations WHERE workflow_id = ? ORDER BY created_at DESC`).all(payload.id),
    }
  })

  ipcMain.handle("workflows:recordInvocation", async (_event, payload: { workflowId: string; versionId: string; status: string; trigger: string; input: string; output: string; traceJson: string }) => {
    await ensureWorkspace()
    const database = openDatabase()
    applyMigrations(database)
    database.prepare(`INSERT INTO workflow_invocations (id, workflow_id, version_id, status, trigger, input_json, output_json, trace_json, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(crypto.randomUUID(), payload.workflowId, payload.versionId, payload.status, payload.trigger, payload.input, payload.output, payload.traceJson, Date.now())
    return database.prepare(`SELECT id, version_id as versionId, status, trigger, input_json as input, output_json as output, trace_json as traceJson, created_at as createdAt FROM workflow_invocations WHERE workflow_id = ? ORDER BY created_at DESC`).all(payload.workflowId)
  })

  ipcMain.handle("channels:list", async () => {
    await ensureWorkspace()
    const database = openDatabase()
    applyMigrations(database)
    return database.prepare(`SELECT id, title, platform, updated_at as updatedAt FROM channels ORDER BY updated_at DESC`).all()
  })

  ipcMain.handle("channels:get", async (_event, channelId: string) => {
    await ensureWorkspace()
    const database = openDatabase()
    applyMigrations(database)
    return database.prepare(`SELECT id, title, platform, updated_at as updatedAt FROM channels WHERE id = ?`).get(channelId) ?? null
  })

  ipcMain.handle("channels:create", async () => {
    await ensureWorkspace()
    const database = openDatabase()
    applyMigrations(database)
    const channelId = crypto.randomUUID()
    const now = Date.now()
    database.prepare(`INSERT INTO channels (id, title, platform, updated_at) VALUES (?, ?, ?, ?)`).run(channelId, "New channel", "web", now)
    return database.prepare(`SELECT id, title, platform, updated_at as updatedAt FROM channels WHERE id = ?`).get(channelId)
  })

  ipcMain.handle("channels:save", async (_event, payload: { id: string; title: string; platform: string }) => {
    await ensureWorkspace()
    const database = openDatabase()
    applyMigrations(database)
    database.prepare(`UPDATE channels SET title = ?, platform = ?, updated_at = ? WHERE id = ?`).run(payload.title, payload.platform, Date.now(), payload.id)
    return database.prepare(`SELECT id, title, platform, updated_at as updatedAt FROM channels WHERE id = ?`).get(payload.id)
  })

  ipcMain.handle("channels:delete", async (_event, channelId: string) => {
    await ensureWorkspace()
    const database = openDatabase()
    applyMigrations(database)
    database.prepare(`DELETE FROM channels WHERE id = ?`).run(channelId)
    return { success: true }
  })

  ipcMain.handle("schedulers:list", async () => {
    await ensureWorkspace()
    const database = openDatabase()
    applyMigrations(database)
    return database.prepare(`SELECT id, title, description, enabled, schedule, time_zone as timeZone, target_type as targetType, target_id as targetId, target_name as targetName, missed_run_policy as missedRunPolicy, retry_limit as retryLimit, retry_backoff_seconds as retryBackoffSeconds, input_payload_json as inputPayloadJson, updated_at as updatedAt FROM schedulers ORDER BY updated_at DESC`).all()
  })

  ipcMain.handle("schedulers:get", async (_event, schedulerId: string) => {
    await ensureWorkspace()
    const database = openDatabase()
    applyMigrations(database)
    return database.prepare(`SELECT id, title, description, enabled, schedule, time_zone as timeZone, target_type as targetType, target_id as targetId, target_name as targetName, missed_run_policy as missedRunPolicy, retry_limit as retryLimit, retry_backoff_seconds as retryBackoffSeconds, input_payload_json as inputPayloadJson, updated_at as updatedAt FROM schedulers WHERE id = ?`).get(schedulerId) ?? null
  })

  ipcMain.handle("schedulers:create", async () => {
    await ensureWorkspace()
    const database = openDatabase()
    applyMigrations(database)
    const schedulerId = crypto.randomUUID()
    const now = Date.now()
    database.prepare(`INSERT INTO schedulers (id, title, description, enabled, schedule, time_zone, target_type, target_id, target_name, missed_run_policy, retry_limit, retry_backoff_seconds, input_payload_json, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(
      schedulerId,
      "New scheduler",
      "",
      1,
      "0 9 * * *",
      "Asia/Shanghai",
      "workflow",
      "",
      "",
      "skip",
      0,
      300,
      "{}",
      now
    )
    return database.prepare(`SELECT id, title, description, enabled, schedule, time_zone as timeZone, target_type as targetType, target_id as targetId, target_name as targetName, missed_run_policy as missedRunPolicy, retry_limit as retryLimit, retry_backoff_seconds as retryBackoffSeconds, input_payload_json as inputPayloadJson, updated_at as updatedAt FROM schedulers WHERE id = ?`).get(schedulerId)
  })

  ipcMain.handle("schedulers:save", async (_event, payload: { id: string; title: string; description: string; enabled: boolean; schedule: string; timeZone: string; targetType: string; targetId: string; targetName: string; missedRunPolicy: string; retryLimit: number; retryBackoffSeconds: number; inputPayloadJson: string }) => {
    await ensureWorkspace()
    const database = openDatabase()
    applyMigrations(database)
    database.prepare(`UPDATE schedulers SET title = ?, description = ?, enabled = ?, schedule = ?, time_zone = ?, target_type = ?, target_id = ?, target_name = ?, missed_run_policy = ?, retry_limit = ?, retry_backoff_seconds = ?, input_payload_json = ?, updated_at = ? WHERE id = ?`).run(
      payload.title,
      payload.description,
      payload.enabled ? 1 : 0,
      payload.schedule,
      payload.timeZone,
      payload.targetType,
      payload.targetId,
      payload.targetName,
      payload.missedRunPolicy,
      payload.retryLimit,
      payload.retryBackoffSeconds,
      payload.inputPayloadJson,
      Date.now(),
      payload.id
    )
    return database.prepare(`SELECT id, title, description, enabled, schedule, time_zone as timeZone, target_type as targetType, target_id as targetId, target_name as targetName, missed_run_policy as missedRunPolicy, retry_limit as retryLimit, retry_backoff_seconds as retryBackoffSeconds, input_payload_json as inputPayloadJson, updated_at as updatedAt FROM schedulers WHERE id = ?`).get(payload.id)
  })

  ipcMain.handle("preferences:get", async () => {
    await ensureWorkspace()
    const database = openDatabase()
    applyMigrations(database)
    const row = database.prepare(`SELECT value FROM app_meta WHERE key = 'preference_settings'`).get() as { value?: string } | undefined
    return row?.value ?? null
  })

  ipcMain.handle("preferences:save", async (_event, value: string) => {
    await ensureWorkspace()
    const database = openDatabase()
    applyMigrations(database)
    database.prepare(`INSERT INTO app_meta (key, value) VALUES ('preference_settings', ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value`).run(value)
    return value
  })
}
