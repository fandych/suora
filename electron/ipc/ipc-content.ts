import crypto from "node:crypto"

import { ipcMain } from "electron"

import { applyMigrations, openDatabase } from "@electron/database/db-core"
import type { ChatRuntimeSettingsPayload } from "@electron/types"
import { setProxySettings } from "@electron/others/proxy"
import { ensureWorkspace } from "@electron/others/workspace"

export function registerContentIpc() {
  ipcMain.handle("chats:list", async () => {
    await ensureWorkspace()
    const database = openDatabase()
    applyMigrations(database)
    return database.prepare(`SELECT id, title, chatbot_id as chatbotId, summary, updated_at as updatedAt FROM chats ORDER BY updated_at DESC`).all()
  })

  ipcMain.handle("chats:get", async (_event, chatId: string) => {
    await ensureWorkspace()
    const database = openDatabase()
    applyMigrations(database)
    return {
      chat: database.prepare(`SELECT id, title, chatbot_id as chatbotId, summary, updated_at as updatedAt FROM chats WHERE id = ?`).get(chatId) ?? null,
      messages: database.prepare(`SELECT id, role, content, created_at as createdAt FROM chat_messages WHERE chat_id = ? ORDER BY created_at ASC`).all(chatId),
    }
  })

  ipcMain.handle("chats:create", async () => {
    await ensureWorkspace()
    const database = openDatabase()
    applyMigrations(database)
    const chatId = crypto.randomUUID()
    const now = Date.now()
    database.prepare(`INSERT INTO chats (id, title, chatbot_id, summary, updated_at) VALUES (?, ?, ?, ?, ?)`).run(chatId, "New chat", "assistant-main", "", now)
    return {
      chat: database.prepare(`SELECT id, title, chatbot_id as chatbotId, summary, updated_at as updatedAt FROM chats WHERE id = ?`).get(chatId),
      messages: [],
    }
  })

  ipcMain.handle("chats:appendUser", async (_event, payload: { chatId: string; content: string }) => {
    await ensureWorkspace()
    const database = openDatabase()
    applyMigrations(database)
    const now = Date.now()
    const chat = database.prepare(`SELECT id, title FROM chats WHERE id = ?`).get(payload.chatId) as { id: string; title: string } | undefined
    if (!chat) {
      return null
    }
    const trimmed = payload.content.trim()
    database.prepare(`INSERT INTO chat_messages (id, chat_id, role, content, created_at) VALUES (?, ?, ?, ?, ?)`).run(crypto.randomUUID(), payload.chatId, "user", trimmed, now)
    const nextTitle = chat.title === "New chat" ? (trimmed.slice(0, 18) || "Untitled chat") : chat.title
    database.prepare(`UPDATE chats SET title = ?, summary = ?, updated_at = ? WHERE id = ?`).run(nextTitle, trimmed, now, payload.chatId)
    return {
      chat: database.prepare(`SELECT id, title, chatbot_id as chatbotId, summary, updated_at as updatedAt FROM chats WHERE id = ?`).get(payload.chatId),
      messages: database.prepare(`SELECT id, role, content, created_at as createdAt FROM chat_messages WHERE chat_id = ? ORDER BY created_at ASC`).all(payload.chatId),
    }
  })

  ipcMain.handle("chats:appendAssistant", async (_event, payload: { chatId: string; content: string }) => {
    await ensureWorkspace()
    const database = openDatabase()
    applyMigrations(database)
    const now = Date.now()
    const chat = database.prepare(`SELECT id FROM chats WHERE id = ?`).get(payload.chatId)
    if (!chat) {
      return null
    }
    database.prepare(`INSERT INTO chat_messages (id, chat_id, role, content, created_at) VALUES (?, ?, ?, ?, ?)`).run(crypto.randomUUID(), payload.chatId, "assistant", payload.content, now)
    database.prepare(`UPDATE chats SET updated_at = ? WHERE id = ?`).run(now, payload.chatId)
    return {
      chat: database.prepare(`SELECT id, title, chatbot_id as chatbotId, summary, updated_at as updatedAt FROM chats WHERE id = ?`).get(payload.chatId),
      messages: database.prepare(`SELECT id, role, content, created_at as createdAt FROM chat_messages WHERE chat_id = ? ORDER BY created_at ASC`).all(payload.chatId),
    }
  })

  ipcMain.handle("chats:getSettings", async () => {
    await ensureWorkspace()
    const database = openDatabase()
    applyMigrations(database)
    const row = database.prepare(`SELECT value FROM app_meta WHERE key = 'chat_runtime_settings'`).get() as { value?: string } | undefined
    return row?.value ?? null
  })

  ipcMain.handle("chats:saveSettings", async (_event, payload: ChatRuntimeSettingsPayload) => {
    await ensureWorkspace()
    const database = openDatabase()
    applyMigrations(database)
    database.prepare(`INSERT INTO app_meta (key, value) VALUES ('chat_runtime_settings', ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value`).run(JSON.stringify(payload))
    setProxySettings(payload.proxy)
    return payload
  })

  ipcMain.handle("documents:list", async () => {
    await ensureWorkspace()
    const database = openDatabase()
    applyMigrations(database)
    return database.prepare(`SELECT id, title, summary, updated_at as updatedAt FROM documents ORDER BY updated_at DESC`).all()
  })

  ipcMain.handle("documents:get", async (_event, documentId: string, versionId?: string) => {
    await ensureWorkspace()
    const database = openDatabase()
    applyMigrations(database)
    const versions = database.prepare(`SELECT id, major, minor, is_release as isRelease, created_at as createdAt, structure_json as structureJson, graph_json as graphJson, settings_json as settingsJson FROM document_versions WHERE document_id = ? ORDER BY major DESC, minor DESC, created_at DESC`).all(documentId) as Array<{ id: string; major: number; minor: number; isRelease: number; createdAt: number; structureJson: string; graphJson: string; settingsJson: string }>
    const selected = versions.find((item) => item.id === versionId) ?? versions[0] ?? null
    return {
      document: database.prepare(`SELECT id, title, summary, updated_at as updatedAt FROM documents WHERE id = ?`).get(documentId) ?? null,
      versions,
      selectedVersionId: selected?.id ?? null,
    }
  })

  ipcMain.handle("documents:create", async () => {
    await ensureWorkspace()
    const database = openDatabase()
    applyMigrations(database)
    const documentId = crypto.randomUUID()
    const versionId = crypto.randomUUID()
    const now = Date.now()
    const folderId = crypto.randomUUID()
    const pages = [
      { id: folderId, title: "guides", content: "", type: "folder", parentId: null },
      { id: crypto.randomUUID(), title: "overview.md", content: "# New document\n\n## Overview\n\nStart writing here.\n", type: "document", parentId: folderId },
    ]
    database.prepare(`INSERT INTO documents (id, title, summary, updated_at) VALUES (?, ?, ?, ?)`).run(documentId, "New document", "", now)
    database.prepare(`INSERT INTO document_versions (id, document_id, major, minor, is_release, structure_json, graph_json, settings_json, created_at) VALUES (?, ?, 1, 0, 0, ?, ?, ?, ?)`).run(versionId, documentId, JSON.stringify({ pages }), JSON.stringify({ edges: [] }), JSON.stringify({ isPublic: false, includeInLlmsTxt: true }), now)
    return {
      document: database.prepare(`SELECT id, title, summary, updated_at as updatedAt FROM documents WHERE id = ?`).get(documentId),
      versions: database.prepare(`SELECT id, major, minor, is_release as isRelease, created_at as createdAt, structure_json as structureJson, graph_json as graphJson, settings_json as settingsJson FROM document_versions WHERE document_id = ? ORDER BY major DESC, minor DESC, created_at DESC`).all(documentId),
      selectedVersionId: versionId,
    }
  })

  ipcMain.handle("documents:save", async (_event, payload: { id: string; title: string; summary: string; structureJson: string; graphJson: string; settingsJson: string; selectedVersionId?: string; publish?: boolean }) => {
    await ensureWorkspace()
    const database = openDatabase()
    applyMigrations(database)
    const latest = database.prepare(`SELECT major, minor, is_release as isRelease FROM document_versions WHERE document_id = ? ORDER BY major DESC, minor DESC, created_at DESC LIMIT 1`).get(payload.id) as { major: number; minor: number; isRelease: number } | undefined
    const now = Date.now()
    database.prepare(`UPDATE documents SET title = ?, summary = ?, updated_at = ? WHERE id = ?`).run(payload.title, payload.summary, now, payload.id)

    const targetDraft = payload.selectedVersionId
      ? database.prepare(`SELECT id, is_release as isRelease FROM document_versions WHERE document_id = ? AND id = ? LIMIT 1`).get(payload.id, payload.selectedVersionId) as { id: string; isRelease: number } | undefined
      : undefined
    let selectedVersionId = targetDraft && !targetDraft.isRelease
      ? { id: targetDraft.id }
      : database.prepare(`SELECT id FROM document_versions WHERE document_id = ? AND is_release = 0 ORDER BY major DESC, minor DESC, created_at DESC LIMIT 1`).get(payload.id) as { id: string } | undefined

    if (!payload.publish && selectedVersionId) {
      database.prepare(`UPDATE document_versions SET structure_json = ?, graph_json = ?, settings_json = ?, created_at = ? WHERE id = ?`).run(payload.structureJson, payload.graphJson, payload.settingsJson, now, selectedVersionId.id)
    } else {
      const nextMajor = !latest ? 1 : latest.isRelease ? latest.major + 1 : latest.major
      const nextMinor = !latest ? 0 : latest.isRelease ? 0 : latest.minor + 1
      const versionId = crypto.randomUUID()
      database.prepare(`INSERT INTO document_versions (id, document_id, major, minor, is_release, structure_json, graph_json, settings_json, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(versionId, payload.id, nextMajor, nextMinor, payload.publish ? 1 : 0, payload.structureJson, payload.graphJson, payload.settingsJson, now)
      selectedVersionId = { id: versionId }
    }

    return {
      document: database.prepare(`SELECT id, title, summary, updated_at as updatedAt FROM documents WHERE id = ?`).get(payload.id),
      versions: database.prepare(`SELECT id, major, minor, is_release as isRelease, created_at as createdAt, structure_json as structureJson, graph_json as graphJson, settings_json as settingsJson FROM document_versions WHERE document_id = ? ORDER BY major DESC, minor DESC, created_at DESC`).all(payload.id),
      selectedVersionId: selectedVersionId?.id ?? null,
    }
  })

  ipcMain.handle("documents:delete", async (_event, documentId: string) => {
    await ensureWorkspace()
    const database = openDatabase()
    applyMigrations(database)
    database.prepare(`DELETE FROM document_versions WHERE document_id = ?`).run(documentId)
    database.prepare(`DELETE FROM documents WHERE id = ?`).run(documentId)
    return { success: true }
  })
}
