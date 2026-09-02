import crypto from "node:crypto"

import { ipcMain } from "electron"

import { applyMigrations, openDatabase } from "@electron/database/db-core"
import { ensureWorkspace } from "@electron/others/workspace"

const defaultAgentConfigJson = JSON.stringify({
  instructions: "You are a helpful agent.",
  providerId: "provider-openai",
  modelId: "gpt-5",
  workflowIds: [],
  skillIds: [],
  toolsetIds: [],
  documentIds: [],
})

export function registerCatalogIpc() {
  ipcMain.handle("models:list", async () => {
    await ensureWorkspace()
    const database = openDatabase()
    applyMigrations(database)
    return database.prepare(`SELECT id, title, provider_type as providerType, base_url as baseUrl, api_key as apiKey, models_json as modelsJson, enabled, updated_at as updatedAt FROM providers ORDER BY updated_at DESC`).all()
  })

  ipcMain.handle("models:get", async (_event, providerId: string) => {
    await ensureWorkspace()
    const database = openDatabase()
    applyMigrations(database)
    return database.prepare(`SELECT id, title, provider_type as providerType, base_url as baseUrl, api_key as apiKey, models_json as modelsJson, enabled, updated_at as updatedAt FROM providers WHERE id = ?`).get(providerId) ?? null
  })

  ipcMain.handle("models:create", async (_event, payload?: Partial<{ title: string; providerType: string; baseUrl: string; apiKey: string; modelsJson: string; enabled: boolean }>) => {
    await ensureWorkspace()
    const database = openDatabase()
    applyMigrations(database)
    const now = Date.now()
    const providerId = crypto.randomUUID()
    const title = payload?.title?.trim() || "New provider"
    const providerType = payload?.providerType?.trim() || "openai-compatible"
    const baseUrl = payload?.baseUrl?.trim() || ""
    const apiKey = payload?.apiKey || ""
    const modelsJson = payload?.modelsJson || "[]"
    const enabled = payload?.enabled ?? true
    database.prepare(`INSERT INTO providers (id, title, provider_type, base_url, api_key, models_json, enabled, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`).run(providerId, title, providerType, baseUrl, apiKey, modelsJson, enabled ? 1 : 0, now)
    return database.prepare(`SELECT id, title, provider_type as providerType, base_url as baseUrl, api_key as apiKey, models_json as modelsJson, enabled, updated_at as updatedAt FROM providers WHERE id = ?`).get(providerId)
  })

  ipcMain.handle("models:save", async (_event, payload: { id: string; title: string; providerType: string; baseUrl: string; apiKey: string; modelsJson: string; enabled: boolean }) => {
    await ensureWorkspace()
    const database = openDatabase()
    applyMigrations(database)
    database.prepare(`UPDATE providers SET title = ?, provider_type = ?, base_url = ?, api_key = ?, models_json = ?, enabled = ?, updated_at = ? WHERE id = ?`).run(payload.title, payload.providerType, payload.baseUrl, payload.apiKey, payload.modelsJson, payload.enabled ? 1 : 0, Date.now(), payload.id)
    return database.prepare(`SELECT id, title, provider_type as providerType, base_url as baseUrl, api_key as apiKey, models_json as modelsJson, enabled, updated_at as updatedAt FROM providers WHERE id = ?`).get(payload.id)
  })

  ipcMain.handle("models:delete", async (_event, providerId: string) => {
    await ensureWorkspace()
    const database = openDatabase()
    applyMigrations(database)
    database.prepare(`DELETE FROM providers WHERE id = ?`).run(providerId)
    return { success: true }
  })

  ipcMain.handle("skills:list", async () => {
    await ensureWorkspace()
    const database = openDatabase()
    applyMigrations(database)
    return database.prepare(`SELECT id, title, source, summary, updated_at as updatedAt FROM skills ORDER BY updated_at DESC`).all()
  })

  ipcMain.handle("skills:get", async (_event, skillId: string) => {
    await ensureWorkspace()
    const database = openDatabase()
    applyMigrations(database)
    return {
      skill: database.prepare(`SELECT id, title, source, summary, updated_at as updatedAt FROM skills WHERE id = ?`).get(skillId) ?? null,
      versions: database.prepare(`SELECT id, major, minor, is_release as isRelease, created_at as createdAt, files_json as filesJson FROM skill_versions WHERE skill_id = ? ORDER BY major DESC, minor DESC, created_at DESC`).all(skillId),
    }
  })

  ipcMain.handle("skills:create", async () => {
    await ensureWorkspace()
    const database = openDatabase()
    applyMigrations(database)
    const now = Date.now()
    const skillId = crypto.randomUUID()
    const versionId = crypto.randomUUID()
    database.prepare(`INSERT INTO skills (id, title, source, summary, updated_at) VALUES (?, ?, ?, ?, ?)`).run(skillId, "New skill", "custom", "", now)
    database.prepare(`INSERT INTO skill_versions (id, skill_id, major, minor, is_release, files_json, created_at) VALUES (?, ?, 1, 0, 0, ?, ?)`).run(versionId, skillId, JSON.stringify([
      { path: "SKILL.md", content: "---\nname: \"New skill\"\ndescription: \"Describe what this skill does and when to use it.\"\n---\n\n## Purpose\n\nDescribe the skill intent, triggers, and limits here.\n", language: "md", kind: "file" },
      { path: "references", content: "", language: "txt", kind: "directory" },
      { path: "references/README.md", content: "# References\n\nCapture related docs, notes, or external links for this skill.", language: "md", kind: "file" },
      { path: "assets", content: "", language: "txt", kind: "directory" },
      { path: "assets/.gitkeep", content: "", language: "txt", kind: "file" },
      { path: "scripts", content: "", language: "txt", kind: "directory" },
      { path: "scripts/main.ts", content: "export async function main(input: unknown) {\n  return { ok: true, input }\n}\n", language: "ts", kind: "file", executable: true },
      { path: "other", content: "", language: "txt", kind: "directory" },
      { path: "other/notes.md", content: "# Notes\n\nAdd extra snippets or implementation notes here.\n", language: "md", kind: "file" },
    ]), now)
    return {
      skill: database.prepare(`SELECT id, title, source, summary, updated_at as updatedAt FROM skills WHERE id = ?`).get(skillId),
      versions: database.prepare(`SELECT id, major, minor, is_release as isRelease, created_at as createdAt, files_json as filesJson FROM skill_versions WHERE skill_id = ? ORDER BY major DESC, minor DESC, created_at DESC`).all(skillId),
    }
  })

  ipcMain.handle("skills:save", async (_event, payload: { id: string; title: string; source: string; summary: string; filesJson: string; selectedVersionId?: string; publish?: boolean }) => {
    await ensureWorkspace()
    const database = openDatabase()
    applyMigrations(database)
    const latest = database.prepare(`SELECT major, minor, is_release as isRelease FROM skill_versions WHERE skill_id = ? ORDER BY major DESC, minor DESC, created_at DESC LIMIT 1`).get(payload.id) as { major: number; minor: number; isRelease: number } | undefined
    const now = Date.now()
    database.prepare(`UPDATE skills SET title = ?, source = ?, summary = ?, updated_at = ? WHERE id = ?`).run(payload.title, payload.source, payload.summary, now, payload.id)

    const targetDraft = payload.selectedVersionId
      ? database.prepare(`SELECT id, is_release as isRelease FROM skill_versions WHERE skill_id = ? AND id = ? LIMIT 1`).get(payload.id, payload.selectedVersionId) as { id: string; isRelease: number } | undefined
      : undefined
    let selectedVersionId = targetDraft && !targetDraft.isRelease
      ? { id: targetDraft.id }
      : database.prepare(`SELECT id FROM skill_versions WHERE skill_id = ? AND is_release = 0 ORDER BY major DESC, minor DESC, created_at DESC LIMIT 1`).get(payload.id) as { id: string } | undefined

    if (!payload.publish && selectedVersionId) {
      database.prepare(`UPDATE skill_versions SET files_json = ?, created_at = ? WHERE id = ?`).run(payload.filesJson, now, selectedVersionId.id)
    } else {
      const nextMajor = !latest ? 1 : latest.isRelease ? latest.major + 1 : latest.major
      const nextMinor = !latest ? 0 : latest.isRelease ? 0 : latest.minor + 1
      const versionId = crypto.randomUUID()
      database.prepare(`INSERT INTO skill_versions (id, skill_id, major, minor, is_release, files_json, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)`).run(versionId, payload.id, nextMajor, nextMinor, payload.publish ? 1 : 0, payload.filesJson, now)
      selectedVersionId = { id: versionId }
    }

    return {
      skill: database.prepare(`SELECT id, title, source, summary, updated_at as updatedAt FROM skills WHERE id = ?`).get(payload.id),
      versions: database.prepare(`SELECT id, major, minor, is_release as isRelease, created_at as createdAt, files_json as filesJson FROM skill_versions WHERE skill_id = ? ORDER BY major DESC, minor DESC, created_at DESC`).all(payload.id),
      selectedVersionId: selectedVersionId?.id ?? null,
    }
  })

  ipcMain.handle("skills:delete", async (_event, skillId: string) => {
    await ensureWorkspace()
    const database = openDatabase()
    applyMigrations(database)
    database.prepare(`DELETE FROM skill_versions WHERE skill_id = ?`).run(skillId)
    database.prepare(`DELETE FROM skills WHERE id = ?`).run(skillId)
    return { success: true }
  })

  ipcMain.handle("agents:list", async () => {
    await ensureWorkspace()
    const database = openDatabase()
    applyMigrations(database)
    return database.prepare(`SELECT id, title, kind, summary, updated_at as updatedAt FROM agents ORDER BY updated_at DESC`).all()
  })

  ipcMain.handle("agents:get", async (_event, agentId: string) => {
    await ensureWorkspace()
    const database = openDatabase()
    applyMigrations(database)
    const agent = database.prepare(`SELECT id, title, kind, summary, updated_at as updatedAt FROM agents WHERE id = ?`).get(agentId) ?? null
    if (!agent) {
      return {
        agent: null,
        versions: [],
      }
    }

    const versionCount = database.prepare(`SELECT COUNT(*) as count FROM agent_versions WHERE agent_id = ?`).get(agentId) as { count: number }
    if (versionCount.count === 0) {
      database.prepare(`INSERT INTO agent_versions (id, agent_id, major, minor, is_release, config_json, created_at) VALUES (?, ?, 1, 0, 0, ?, ?)`).run(
        crypto.randomUUID(),
        agentId,
        defaultAgentConfigJson,
        Date.now()
      )
    }

    return {
      agent,
      versions: database.prepare(`SELECT id, major, minor, is_release as isRelease, created_at as createdAt, config_json as configJson FROM agent_versions WHERE agent_id = ? ORDER BY major DESC, minor DESC, created_at DESC`).all(agentId),
    }
  })

  ipcMain.handle("agents:create", async () => {
    await ensureWorkspace()
    const database = openDatabase()
    applyMigrations(database)
    const now = Date.now()
    const agentId = crypto.randomUUID()
    const versionId = crypto.randomUUID()
    const config = JSON.stringify({ instructions: "You are a helpful agent.", providerId: "provider-openai", modelId: "gpt-5", workflowIds: [], skillIds: ["skill-plan"], toolsetIds: ["integration-webhook"], documentIds: [] })
    database.prepare(`INSERT INTO agents (id, title, kind, summary, updated_at) VALUES (?, ?, ?, ?, ?)`).run(agentId, "New agent", "custom", "", now)
    database.prepare(`INSERT INTO agent_versions (id, agent_id, major, minor, is_release, config_json, created_at) VALUES (?, ?, 1, 0, 0, ?, ?)`).run(versionId, agentId, config, now)
    return {
      agent: database.prepare(`SELECT id, title, kind, summary, updated_at as updatedAt FROM agents WHERE id = ?`).get(agentId),
      versions: database.prepare(`SELECT id, major, minor, is_release as isRelease, created_at as createdAt, config_json as configJson FROM agent_versions WHERE agent_id = ? ORDER BY major DESC, minor DESC, created_at DESC`).all(agentId),
      selectedVersionId: versionId,
    }
  })

  ipcMain.handle("agents:save", async (_event, payload: { id: string; title: string; kind: string; summary: string; configJson: string; selectedVersionId?: string; publish?: boolean }) => {
    await ensureWorkspace()
    const database = openDatabase()
    applyMigrations(database)
    const exists = database.prepare(`SELECT id FROM agents WHERE id = ? LIMIT 1`).get(payload.id) as { id: string } | undefined
    const latest = database.prepare(`SELECT major, minor, is_release as isRelease FROM agent_versions WHERE agent_id = ? ORDER BY major DESC, minor DESC, created_at DESC LIMIT 1`).get(payload.id) as { major: number; minor: number; isRelease: number } | undefined
    const targetDraft = payload.selectedVersionId
      ? database.prepare(`SELECT id, major, minor, is_release as isRelease FROM agent_versions WHERE agent_id = ? AND id = ? LIMIT 1`).get(payload.id, payload.selectedVersionId) as { id: string; major: number; minor: number; isRelease: number } | undefined
      : undefined
    let selectedVersionId = targetDraft && !targetDraft.isRelease
      ? { id: targetDraft.id }
      : undefined
    const now = Date.now()
    if (exists) {
      database.prepare(`UPDATE agents SET title = ?, kind = ?, summary = ?, updated_at = ? WHERE id = ?`).run(payload.title, payload.kind, payload.summary, now, payload.id)
    } else {
      database.prepare(`INSERT INTO agents (id, title, kind, summary, updated_at) VALUES (?, ?, ?, ?, ?)`).run(payload.id, payload.title, payload.kind, payload.summary, now)
    }

    if (!payload.publish && selectedVersionId) {
      database.prepare(`UPDATE agent_versions SET config_json = ?, created_at = ? WHERE id = ?`).run(payload.configJson, now, selectedVersionId.id)
    } else {
      const nextMajor = !latest ? 1 : latest.isRelease ? latest.major + 1 : latest.major
      const nextMinor = !latest ? 0 : latest.isRelease ? 0 : latest.minor + 1
      const versionId = crypto.randomUUID()
      database.prepare(`INSERT INTO agent_versions (id, agent_id, major, minor, is_release, config_json, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)`).run(versionId, payload.id, nextMajor, nextMinor, payload.publish ? 1 : 0, payload.configJson, now)
      selectedVersionId = { id: versionId }
    }

    return {
      agent: database.prepare(`SELECT id, title, kind, summary, updated_at as updatedAt FROM agents WHERE id = ?`).get(payload.id),
      versions: database.prepare(`SELECT id, major, minor, is_release as isRelease, created_at as createdAt, config_json as configJson FROM agent_versions WHERE agent_id = ? ORDER BY major DESC, minor DESC, created_at DESC`).all(payload.id),
      selectedVersionId: selectedVersionId?.id ?? null,
    }
  })

  ipcMain.handle("agents:delete", async (_event, agentId: string) => {
    await ensureWorkspace()
    const database = openDatabase()
    applyMigrations(database)
    database.prepare(`DELETE FROM agent_versions WHERE agent_id = ?`).run(agentId)
    database.prepare(`DELETE FROM agents WHERE id = ?`).run(agentId)
    return { success: true }
  })
}
