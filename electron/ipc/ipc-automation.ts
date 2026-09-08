import crypto from "node:crypto"
import http from "node:http"
import https from "node:https"

import { ipcMain } from "electron"
import { createDefaultChannelConfig, createDefaultChannelRuntime } from "@/data/repositories/channel-defaults"

import { applyMigrations, openDatabase } from "@electron/database/db-core"
import { applySecurityPreferences } from "@electron/others/preferences"
import { ensureWorkspace } from "@electron/others/workspace"
import { assertSafeHttpUrl } from "@electron/others/url-security"
import { getPreferenceSettingsSnapshot } from "@electron/others/preferences"
import { appState } from "@electron/others/app-state"
import { getProxyAgent } from "@electron/others/proxy"

function createDefaultWorkflowDefinition() {
  return {
    nodes: [
      {
        id: "start",
        type: "workflowNode",
        position: { x: 60, y: 140 },
        data: {
          label: "Start",
          prompt: "Capture input variables.",
          kind: "start",
          task: "Normalize incoming input.",
          enabled: true,
          continueOnError: true,
          retryCount: 0,
          timeoutMs: 15000,
          outputKey: "request",
        },
      },
    ],
    edges: [],
    viewport: { x: 0, y: 0, zoom: 1 },
    resourceBindings: {
      providerId: "provider-openai",
      skillId: "skill-plan",
      documentId: "document-product-manual",
      integrationId: "integration-webhook",
    },
    dryRunInputJson: "{\n  \"leadId\": \"LD-1001\"\n}",
    variables: [],
    budget: {
      maxSteps: 8,
      maxDurationMs: 120000,
    },
  }
}

const WORKFLOW_NODE_KINDS = new Set([
  "start", "end", "document-retrieval", "agent", "fork", "join", "if-else", "http", "script",
  "variable-assigner", "template", "ai-response", "loop", "parallel", "serial", "toolset", "webhook", "wiki-retrieval", "smtp", "condition",
])

function validateWorkflowDefinitionJson(value: string) {
  let definition: {
    nodes?: Array<{ id?: unknown; data?: { kind?: unknown } }>
    edges?: Array<{ source?: unknown; target?: unknown }>
    budget?: { maxSteps?: unknown; maxDurationMs?: unknown }
  }
  try {
    definition = JSON.parse(value) as typeof definition
  } catch {
    throw new Error("Workflow definition must be valid JSON.")
  }
  const nodes = definition.nodes
  const edges = definition.edges
  if (!Array.isArray(nodes) || !Array.isArray(edges)) throw new Error("Workflow definition requires nodes and edges.")
  if (nodes.length > 200 || edges.length > 400) throw new Error("Workflow limit is 200 nodes and 400 edges.")
  const ids = new Set<string>()
  for (const node of nodes) {
    if (typeof node.id !== "string" || !node.id.trim() || ids.has(node.id) || !WORKFLOW_NODE_KINDS.has(String(node.data?.kind))) {
      throw new Error("Workflow contains an invalid, duplicate, or unsupported node.")
    }
    ids.add(node.id)
  }
  if (edges.some((edge) => typeof edge.source !== "string" || typeof edge.target !== "string" || !ids.has(edge.source) || !ids.has(edge.target))) {
    throw new Error("Workflow contains an edge with an unknown node.")
  }
  const maxSteps = Number(definition.budget?.maxSteps ?? 100)
  const maxDurationMs = Number(definition.budget?.maxDurationMs ?? 120000)
  if (!Number.isFinite(maxSteps) || maxSteps < 1 || maxSteps > 1000 || !Number.isFinite(maxDurationMs) || maxDurationMs < 1000 || maxDurationMs > 3_600_000) {
    throw new Error("Workflow execution budget is outside the supported limits.")
  }
}

export function registerAutomationIpc() {
  ipcMain.handle("integrations:fetchApiDoc", async (_event, sourceUrl: string) => {
    await ensureWorkspace()
    const url = await assertSafeHttpUrl(sourceUrl, { allowLocalNetwork: true })
    const preferenceSettings = getPreferenceSettingsSnapshot()
    const proxySettings = appState.currentProxySettings
    const ignoreSsl = proxySettings.ignoreSslErrors === true || preferenceSettings.ignoreSslErrors === true
    const transport = url.protocol === "https:" ? https : http
    const proxyAgent = getProxyAgent(url, ignoreSsl)
    const agent = proxyAgent ?? (url.protocol === "https:" ? new https.Agent({ keepAlive: false, rejectUnauthorized: !ignoreSsl }) : new http.Agent({ keepAlive: false }))

    console.info("[SUORA API DOC] fetch", {
      url: `${url.protocol}//${url.hostname}${url.port ? `:${url.port}` : ""}${url.pathname}`,
      ignoreSsl,
      preferenceIgnoreSsl: preferenceSettings.ignoreSslErrors,
      proxyIgnoreSsl: proxySettings.ignoreSslErrors === true,
      viaProxy: Boolean(proxyAgent),
    })

    return new Promise<string>((resolve, reject) => {
      const request = transport.get(url, {
        agent,
        headers: { "User-Agent": "SUORA/1.0 (Desktop API Doc Importer)", Connection: "close" },
        rejectUnauthorized: url.protocol === "https:" ? !ignoreSsl : undefined,
      }, (response) => {
        const chunks: Buffer[] = []
        response.on("data", (chunk: Buffer) => chunks.push(chunk))
        response.on("end", () => {
          const body = Buffer.concat(chunks).toString("utf8")
          if ((response.statusCode ?? 500) < 200 || (response.statusCode ?? 500) >= 300) {
            reject(new Error(`API doc request failed with HTTP ${response.statusCode ?? 500}.`))
            return
          }
          resolve(body)
        })
        response.on("error", reject)
      })
      request.on("error", (error) => {
        const message = error instanceof Error ? error.message : String(error)
        reject(new Error(message.toLowerCase().includes("econnreset") ? `API doc connection reset. Check the URL, proxy, or enable "Ignore SSL / CA certificate validation" in Preferences > Security.` : message, { cause: error }))
      })
      request.setTimeout(30_000, () => request.destroy(new Error("API doc request timed out.")))
    })
  })

  ipcMain.handle("integrations:list", async () => {
    await ensureWorkspace()
    const database = openDatabase()
    applyMigrations(database)
    return database.prepare(`SELECT id, title, kind, endpoint, enabled, updated_at as updatedAt FROM integrations ORDER BY updated_at DESC`).all()
  })

  ipcMain.handle("integrations:get", async (_event, integrationId: string) => {
    await ensureWorkspace()
    const database = openDatabase()
    applyMigrations(database)
    return {
      integration: database.prepare(`SELECT id, title, kind, endpoint, enabled, updated_at as updatedAt FROM integrations WHERE id = ?`).get(integrationId) ?? null,
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
    database.prepare(`INSERT INTO integrations (id, title, kind, endpoint, enabled, updated_at) VALUES (?, ?, ?, ?, 1, ?)`).run(integrationId, payload?.title || `New ${payload?.kind || "http"} integration`, payload?.kind || "http", payload?.endpoint || "", now)
    database.prepare(`INSERT INTO integration_versions (id, integration_id, major, minor, is_release, config_json, created_at) VALUES (?, ?, 1, 0, 0, ?, ?)`).run(versionId, integrationId, payload?.configJson || "{}", now)
    return {
      integration: database.prepare(`SELECT id, title, kind, endpoint, enabled, updated_at as updatedAt FROM integrations WHERE id = ?`).get(integrationId),
      versions: database.prepare(`SELECT id, major, minor, is_release as isRelease, created_at as createdAt, config_json as configJson FROM integration_versions WHERE integration_id = ? ORDER BY major DESC, minor DESC, created_at DESC`).all(integrationId),
      executions: [],
    }
  })

  ipcMain.handle("integrations:save", async (_event, payload: { id: string; title: string; kind: string; endpoint: string; configJson: string; enabled?: boolean; selectedVersionId?: string; publish?: boolean }) => {
    await ensureWorkspace()
    const database = openDatabase()
    applyMigrations(database)
    const latest = database.prepare(`SELECT major, minor, is_release as isRelease FROM integration_versions WHERE integration_id = ? ORDER BY major DESC, minor DESC, created_at DESC LIMIT 1`).get(payload.id) as { major: number; minor: number; isRelease: number } | undefined
    const targetDraft = payload.selectedVersionId
      ? database.prepare(`SELECT id, major, minor, is_release as isRelease FROM integration_versions WHERE integration_id = ? AND id = ? LIMIT 1`).get(payload.id, payload.selectedVersionId) as { id: string; major: number; minor: number; isRelease: number } | undefined
      : undefined
    const nextMajor = !latest ? 1 : latest.isRelease ? latest.major + 1 : latest.major
    const nextMinor = !latest ? 0 : latest.isRelease ? 0 : latest.minor + 1
    const selectedVersion = targetDraft && !targetDraft.isRelease
      ? { id: targetDraft.id }
      : database.prepare(`SELECT id FROM integration_versions WHERE integration_id = ? AND is_release = 0 ORDER BY major DESC, minor DESC, created_at DESC LIMIT 1`).get(payload.id) as { id: string } | undefined
    const now = Date.now()
    database.prepare(`UPDATE integrations SET title = ?, kind = ?, endpoint = ?, enabled = COALESCE(?, enabled), updated_at = ? WHERE id = ?`).run(payload.title, payload.kind, payload.endpoint, payload.enabled == null ? null : (payload.enabled ? 1 : 0), now, payload.id)
    if (!payload.publish && selectedVersion) {
      database.prepare(`UPDATE integration_versions SET config_json = ?, created_at = ? WHERE id = ?`).run(payload.configJson, now, selectedVersion.id)
    } else {
      const versionId = crypto.randomUUID()
      database.prepare(`INSERT INTO integration_versions (id, integration_id, major, minor, is_release, config_json, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)`).run(versionId, payload.id, nextMajor, nextMinor, payload.publish ? 1 : 0, payload.configJson, now)
    }
    return {
      integration: database.prepare(`SELECT id, title, kind, endpoint, enabled, updated_at as updatedAt FROM integrations WHERE id = ?`).get(payload.id),
      versions: database.prepare(`SELECT id, major, minor, is_release as isRelease, created_at as createdAt, config_json as configJson FROM integration_versions WHERE integration_id = ? ORDER BY major DESC, minor DESC, created_at DESC`).all(payload.id),
      executions: database.prepare(`SELECT id, version_id as versionId, status, input_json as input, output_json as output, created_at as createdAt FROM integration_executions WHERE integration_id = ? ORDER BY created_at DESC`).all(payload.id),
    }
  })

  ipcMain.handle("integrations:setEnabled", async (_event, payload: { id: string; enabled: boolean }) => {
    await ensureWorkspace()
    const database = openDatabase()
    applyMigrations(database)
    database.prepare("UPDATE integrations SET enabled = ?, updated_at = ? WHERE id = ?").run(payload.enabled ? 1 : 0, Date.now(), payload.id)
    return database.prepare(`SELECT id, title, kind, endpoint, enabled, updated_at as updatedAt FROM integrations WHERE id = ?`).get(payload.id) ?? null
  })

  ipcMain.handle("integrations:delete", async (_event, integrationId: string) => {
    await ensureWorkspace()
    const database = openDatabase()
    applyMigrations(database)
    database.prepare("DELETE FROM integration_executions WHERE integration_id = ?").run(integrationId)
    database.prepare("DELETE FROM integration_versions WHERE integration_id = ?").run(integrationId)
    const result = database.prepare("DELETE FROM integrations WHERE id = ?").run(integrationId)
    return { ok: Number(result.changes) > 0 }
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
    const definition = JSON.stringify(createDefaultWorkflowDefinition())
    database.prepare(`INSERT INTO workflows (id, title, summary, updated_at) VALUES (?, ?, ?, ?)`).run(workflowId, "New workflow", "", now)
    database.prepare(`INSERT INTO workflow_versions (id, workflow_id, major, minor, is_release, definition_json, created_at) VALUES (?, ?, 1, 0, 0, ?, ?)`).run(versionId, workflowId, definition, now)
    return {
      workflow: database.prepare(`SELECT id, title, summary, updated_at as updatedAt FROM workflows WHERE id = ?`).get(workflowId),
      versions: database.prepare(`SELECT id, major, minor, is_release as isRelease, created_at as createdAt, definition_json as definitionJson FROM workflow_versions WHERE workflow_id = ? ORDER BY major DESC, minor DESC, created_at DESC`).all(workflowId),
      invocations: [],
    }
  })

  ipcMain.handle("workflows:save", async (_event, payload: { id: string; title: string; summary: string; definitionJson: string; selectedVersionId?: string; publish?: boolean }) => {
    await ensureWorkspace()
    validateWorkflowDefinitionJson(payload.definitionJson)
    const database = openDatabase()
    applyMigrations(database)
    const latest = database.prepare(`SELECT major, minor, is_release as isRelease FROM workflow_versions WHERE workflow_id = ? ORDER BY major DESC, minor DESC, created_at DESC LIMIT 1`).get(payload.id) as { major: number; minor: number; isRelease: number } | undefined
    const targetDraft = payload.selectedVersionId
      ? database.prepare(`SELECT id, major, minor, is_release as isRelease FROM workflow_versions WHERE workflow_id = ? AND id = ? LIMIT 1`).get(payload.id, payload.selectedVersionId) as { id: string; major: number; minor: number; isRelease: number } | undefined
      : undefined
    const nextMajor = !latest ? 1 : latest.isRelease ? latest.major + 1 : latest.major
    const nextMinor = !latest ? 0 : latest.isRelease ? 0 : latest.minor + 1
    const selectedVersion = targetDraft && !targetDraft.isRelease
      ? { id: targetDraft.id }
      : database.prepare(`SELECT id FROM workflow_versions WHERE workflow_id = ? AND is_release = 0 ORDER BY major DESC, minor DESC, created_at DESC LIMIT 1`).get(payload.id) as { id: string } | undefined
    const now = Date.now()
    database.prepare(`UPDATE workflows SET title = ?, summary = ?, updated_at = ? WHERE id = ?`).run(payload.title, payload.summary, now, payload.id)
    if (!payload.publish && selectedVersion) {
      database.prepare(`UPDATE workflow_versions SET definition_json = ?, created_at = ? WHERE id = ?`).run(payload.definitionJson, now, selectedVersion.id)
    } else {
      const versionId = crypto.randomUUID()
      database.prepare(`INSERT INTO workflow_versions (id, workflow_id, major, minor, is_release, definition_json, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)`).run(versionId, payload.id, nextMajor, nextMinor, payload.publish ? 1 : 0, payload.definitionJson, now)
    }
    return {
      workflow: database.prepare(`SELECT id, title, summary, updated_at as updatedAt FROM workflows WHERE id = ?`).get(payload.id),
      versions: database.prepare(`SELECT id, major, minor, is_release as isRelease, created_at as createdAt, definition_json as definitionJson FROM workflow_versions WHERE workflow_id = ? ORDER BY major DESC, minor DESC, created_at DESC`).all(payload.id),
      invocations: database.prepare(`SELECT id, version_id as versionId, status, trigger, input_json as input, output_json as output, trace_json as traceJson, created_at as createdAt FROM workflow_invocations WHERE workflow_id = ? ORDER BY created_at DESC`).all(payload.id),
    }
  })

  ipcMain.handle("workflows:delete", async (_event, workflowId: string) => {
    await ensureWorkspace()
    const database = openDatabase()
    applyMigrations(database)
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
    return database.prepare(`SELECT id, title, platform, enabled, status, connection_mode as connectionMode, webhook_path as webhookPath, webhook_secret as webhookSecret, auto_reply as autoReply, reply_agent_id as replyAgentId, created_at as createdAt, last_message_at as lastMessageAt, message_count as messageCount, config_json as configJson, runtime_json as runtimeJson, updated_at as updatedAt FROM channels ORDER BY updated_at DESC`).all()
  })

  ipcMain.handle("channels:get", async (_event, channelId: string) => {
    await ensureWorkspace()
    const database = openDatabase()
    applyMigrations(database)
    return database.prepare(`SELECT id, title, platform, enabled, status, connection_mode as connectionMode, webhook_path as webhookPath, webhook_secret as webhookSecret, auto_reply as autoReply, reply_agent_id as replyAgentId, created_at as createdAt, last_message_at as lastMessageAt, message_count as messageCount, config_json as configJson, runtime_json as runtimeJson, updated_at as updatedAt FROM channels WHERE id = ?`).get(channelId) ?? null
  })

  ipcMain.handle("channels:create", async (_event, defaults?: Partial<{ providerId: string; modelId: string }>) => {
    await ensureWorkspace()
    const database = openDatabase()
    applyMigrations(database)
    const channelId = crypto.randomUUID()
    const now = Date.now()
    const config = createDefaultChannelConfig({ id: channelId, title: "New channel", platform: "web", now, providerId: defaults?.providerId, modelId: defaults?.modelId })
    const runtime = createDefaultChannelRuntime()
    database.prepare(`INSERT INTO channels (id, title, platform, enabled, status, connection_mode, webhook_path, webhook_secret, auto_reply, reply_agent_id, created_at, last_message_at, message_count, config_json, runtime_json, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(
      channelId,
      config.title,
      config.platform,
      config.enabled ? 1 : 0,
      config.status,
      config.connectionMode,
      config.webhookPath,
      config.webhookSecret,
      config.autoReply ? 1 : 0,
      config.replyAgentId,
      config.createdAt,
      null,
      0,
      JSON.stringify(config),
      JSON.stringify(runtime),
      now
    )
    return database.prepare(`SELECT id, title, platform, enabled, status, connection_mode as connectionMode, webhook_path as webhookPath, webhook_secret as webhookSecret, auto_reply as autoReply, reply_agent_id as replyAgentId, created_at as createdAt, last_message_at as lastMessageAt, message_count as messageCount, config_json as configJson, runtime_json as runtimeJson, updated_at as updatedAt FROM channels WHERE id = ?`).get(channelId)
  })

  ipcMain.handle("channels:save", async (_event, payload: { channel: { id: string; title: string; platform: string; enabled: boolean; status: string; connectionMode: string; webhookPath: string; webhookSecret: string; autoReply: boolean; replyAgentId: string; createdAt: number; updatedAt: number; lastMessageAt?: number; messageCount: number }; runtime: unknown }) => {
    await ensureWorkspace()
    const database = openDatabase()
    applyMigrations(database)
    const now = Date.now()
    database.prepare(`UPDATE channels SET title = ?, platform = ?, enabled = ?, status = ?, connection_mode = ?, webhook_path = ?, webhook_secret = ?, auto_reply = ?, reply_agent_id = ?, created_at = ?, last_message_at = ?, message_count = ?, config_json = ?, runtime_json = ?, updated_at = ? WHERE id = ?`).run(
      payload.channel.title,
      payload.channel.platform,
      payload.channel.enabled ? 1 : 0,
      payload.channel.status,
      payload.channel.connectionMode,
      payload.channel.webhookPath,
      payload.channel.webhookSecret,
      payload.channel.autoReply ? 1 : 0,
      payload.channel.replyAgentId,
      payload.channel.createdAt,
      payload.channel.lastMessageAt ?? null,
      payload.channel.messageCount,
      JSON.stringify({ ...payload.channel, updatedAt: now }),
      JSON.stringify(payload.runtime),
      now,
      payload.channel.id
    )
    return database.prepare(`SELECT id, title, platform, enabled, status, connection_mode as connectionMode, webhook_path as webhookPath, webhook_secret as webhookSecret, auto_reply as autoReply, reply_agent_id as replyAgentId, created_at as createdAt, last_message_at as lastMessageAt, message_count as messageCount, config_json as configJson, runtime_json as runtimeJson, updated_at as updatedAt FROM channels WHERE id = ?`).get(payload.channel.id)
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
    applySecurityPreferences()
    return value
  })
}
