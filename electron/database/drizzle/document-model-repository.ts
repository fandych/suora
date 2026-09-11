import crypto from "node:crypto"
import { and, desc, eq } from "drizzle-orm"
import { getDrizzleDatabase } from "@electron/database/drizzle/client"
import { documentVersions, documents, providers } from "@electron/database/drizzle/schema"
import { protectCredential, revealCredential } from "@electron/infrastructure/credential-vault"

export async function listDocumentsWithDrizzle() {
  return getDrizzleDatabase().select().from(documents).orderBy(desc(documents.updatedAt))
}

export async function getDocumentWithDrizzle(documentId: string, versionId?: string) {
  const database = getDrizzleDatabase()
  const [document] = await database.select().from(documents).where(eq(documents.id, documentId)).limit(1)
  const versions = await database.select().from(documentVersions).where(eq(documentVersions.documentId, documentId)).orderBy(desc(documentVersions.major), desc(documentVersions.minor), desc(documentVersions.createdAt))
  return { document: document ?? null, versions, selectedVersionId: versions.find((version) => version.id === versionId)?.id ?? versions[0]?.id ?? null }
}

export async function createDocumentWithDrizzle() {
  const database = getDrizzleDatabase()
  const id = crypto.randomUUID()
  const versionId = crypto.randomUUID()
  const folderId = crypto.randomUUID()
  const now = Date.now()
  const pages = [{ id: folderId, title: "guides", content: "", type: "folder", parentId: null }, { id: crypto.randomUUID(), title: "overview.md", content: "# New document\n\n## Overview\n\nStart writing here.\n", type: "document", parentId: folderId }]
  await database.insert(documents).values({ id, title: "New document", summary: "", enabled: true, updatedAt: now })
  await database.insert(documentVersions).values({ id: versionId, documentId: id, major: 1, minor: 0, isRelease: false, structureJson: JSON.stringify({ pages }), graphJson: JSON.stringify({ edges: [] }), settingsJson: JSON.stringify({ isPublic: false, includeInLlmsTxt: true }), createdAt: now })
  return getDocumentWithDrizzle(id, versionId)
}

export async function saveDocumentWithDrizzle(payload: { id: string; title: string; summary: string; enabled: boolean; structureJson: string; graphJson: string; settingsJson: string; selectedVersionId?: string; publish?: boolean }) {
  const database = getDrizzleDatabase()
  const now = Date.now()
  await database.update(documents).set({ title: payload.title, summary: payload.summary, enabled: payload.enabled, updatedAt: now }).where(eq(documents.id, payload.id))
  const [selected] = payload.selectedVersionId ? await database.select().from(documentVersions).where(and(eq(documentVersions.documentId, payload.id), eq(documentVersions.id, payload.selectedVersionId))).limit(1) : []
  const [draft] = await database.select().from(documentVersions).where(and(eq(documentVersions.documentId, payload.id), eq(documentVersions.isRelease, false))).orderBy(desc(documentVersions.major), desc(documentVersions.minor), desc(documentVersions.createdAt)).limit(1)
  const target = selected && !selected.isRelease ? selected : draft
  let selectedVersionId = target?.id
  if (!payload.publish && target) {
    await database.update(documentVersions).set({ structureJson: payload.structureJson, graphJson: payload.graphJson, settingsJson: payload.settingsJson, createdAt: now }).where(eq(documentVersions.id, target.id))
  } else {
    const [latest] = await database.select().from(documentVersions).where(eq(documentVersions.documentId, payload.id)).orderBy(desc(documentVersions.major), desc(documentVersions.minor), desc(documentVersions.createdAt)).limit(1)
    selectedVersionId = crypto.randomUUID()
    await database.insert(documentVersions).values({ id: selectedVersionId, documentId: payload.id, major: !latest ? 1 : latest.isRelease ? latest.major + 1 : latest.major, minor: !latest || latest.isRelease ? 0 : latest.minor + 1, isRelease: Boolean(payload.publish), structureJson: payload.structureJson, graphJson: payload.graphJson, settingsJson: payload.settingsJson, createdAt: now })
  }
  return { ...(await getDocumentWithDrizzle(payload.id, selectedVersionId)), selectedVersionId }
}

export async function deleteDocumentWithDrizzle(documentId: string) {
  const database = getDrizzleDatabase()
  await database.delete(documentVersions).where(eq(documentVersions.documentId, documentId))
  await database.delete(documents).where(eq(documents.id, documentId))
  return { success: true }
}

export async function listModelsWithDrizzle() {
  const database = getDrizzleDatabase()
  const rows = await database.select().from(providers).orderBy(desc(providers.updatedAt))
  return rows.map((row) => ({ ...row, apiKey: revealCredential(row.apiKey) }))
}

export async function getModelWithDrizzle(providerId: string) {
  const [row] = await getDrizzleDatabase().select().from(providers).where(eq(providers.id, providerId)).limit(1)
  return row ? { ...row, apiKey: revealCredential(row.apiKey) } : null
}

export async function createModelWithDrizzle(payload: { title?: string; providerType?: string; baseUrl?: string; apiKey?: string; modelsJson?: string; enabled?: boolean }) {
  const database = getDrizzleDatabase()
  const id = crypto.randomUUID()
  await database.insert(providers).values({ id, title: payload.title || "New provider", providerType: payload.providerType || "openai-compatible", baseUrl: payload.baseUrl || "", apiKey: protectCredential(payload.apiKey || ""), modelsJson: payload.modelsJson || "[]", enabled: payload.enabled !== false, updatedAt: Date.now() })
  return getModelWithDrizzle(id)
}

export async function saveModelWithDrizzle(payload: { id: string; title: string; providerType: string; baseUrl: string; apiKey: string; modelsJson: string; enabled: boolean }) {
  const database = getDrizzleDatabase()
  await database.update(providers).set({ title: payload.title, providerType: payload.providerType, baseUrl: payload.baseUrl, apiKey: protectCredential(payload.apiKey), modelsJson: payload.modelsJson, enabled: payload.enabled, updatedAt: Date.now() }).where(eq(providers.id, payload.id))
  return getModelWithDrizzle(payload.id)
}

export async function deleteModelWithDrizzle(providerId: string) {
  await getDrizzleDatabase().delete(providers).where(eq(providers.id, providerId))
  return { success: true }
}
