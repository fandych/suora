import crypto from "node:crypto"
import { and, desc, eq } from "drizzle-orm"
import { getDrizzleDatabase } from "@/drizzle/db"
import { documentVersions, documents } from "@/drizzle/schema"
import { recordRecentlyDeletedResource } from "@/electron/app/system/system-repository"
import { openDatabase } from "@/electron/infrastructure/db-core"

type DocumentVersionSnapshot = {
  id: string
  major: number
  minor: number
  isRelease: boolean
  createdAt: number
  structureJson: string
  graphJson: string
  settingsJson: string
}

type DocumentSnapshot = {
  document: typeof documents.$inferSelect | null
  versions: DocumentVersionSnapshot[]
  selectedVersionId: string | null
}

async function withDocumentTransaction<T>(operation: () => Promise<T>) {
  const sqlite = openDatabase()
  sqlite.exec("BEGIN IMMEDIATE")
  try {
    const result = await operation()
    sqlite.exec("COMMIT")
    return result
  } catch (error) {
    sqlite.exec("ROLLBACK")
    throw error
  }
}

export async function listDocuments() {
  return getDrizzleDatabase().select().from(documents).orderBy(desc(documents.updatedAt))
}

export async function getDocument(documentId: string, versionId?: string) {
  const database = getDrizzleDatabase()
  const [document] = await database.select().from(documents).where(eq(documents.id, documentId)).limit(1)
  const versions = await database
    .select()
    .from(documentVersions)
    .where(eq(documentVersions.documentId, documentId))
    .orderBy(desc(documentVersions.major), desc(documentVersions.minor), desc(documentVersions.createdAt))
  return {
    document: document ?? null,
    versions,
    selectedVersionId: versions.find((version) => version.id === versionId)?.id ?? versions[0]?.id ?? null,
  }
}

export async function createDocument() {
  return withDocumentTransaction(async () => {
    const database = getDrizzleDatabase()
    const id = crypto.randomUUID()
    const versionId = crypto.randomUUID()
    const folderId = crypto.randomUUID()
    const now = Date.now()
    const pages = [
      { id: folderId, title: "guides", content: "", type: "folder", parentId: null },
      {
        id: crypto.randomUUID(),
        title: "overview.md",
        content: "# New document\n\n## Overview\n\nStart writing here.\n",
        type: "document",
        parentId: folderId,
      },
    ]
    await database.insert(documents).values({ id, title: "New document", summary: "", enabled: true, updatedAt: now })
    await database.insert(documentVersions).values({
      id: versionId,
      documentId: id,
      major: 1,
      minor: 0,
      isRelease: false,
      structureJson: JSON.stringify({ pages }),
      graphJson: JSON.stringify({ edges: [] }),
      settingsJson: JSON.stringify({ isPublic: false, includeInLlmsTxt: true }),
      createdAt: now,
    })
    return getDocument(id, versionId)
  })
}

export async function saveDocument(payload: {
  id: string
  title: string
  summary: string
  enabled: boolean
  structureJson: string
  graphJson: string
  settingsJson: string
  selectedVersionId?: string
  publish?: boolean
}) {
  return withDocumentTransaction(async () => {
    const database = getDrizzleDatabase()
    const now = Date.now()
    await database
      .update(documents)
      .set({ title: payload.title, summary: payload.summary, enabled: payload.enabled, updatedAt: now })
      .where(eq(documents.id, payload.id))
    const [selected] = payload.selectedVersionId
      ? await database
          .select()
          .from(documentVersions)
          .where(and(eq(documentVersions.documentId, payload.id), eq(documentVersions.id, payload.selectedVersionId)))
          .limit(1)
      : []
    const [draft] = await database
      .select()
      .from(documentVersions)
      .where(and(eq(documentVersions.documentId, payload.id), eq(documentVersions.isRelease, false)))
      .orderBy(desc(documentVersions.major), desc(documentVersions.minor), desc(documentVersions.createdAt))
      .limit(1)
    const target = selected && !selected.isRelease ? selected : draft
    let selectedVersionId = target?.id
    if (!payload.publish && target) {
      await database
        .update(documentVersions)
        .set({
          structureJson: payload.structureJson,
          graphJson: payload.graphJson,
          settingsJson: payload.settingsJson,
          createdAt: now,
        })
        .where(eq(documentVersions.id, target.id))
    } else {
      const [latest] = await database
        .select()
        .from(documentVersions)
        .where(eq(documentVersions.documentId, payload.id))
        .orderBy(desc(documentVersions.major), desc(documentVersions.minor), desc(documentVersions.createdAt))
        .limit(1)
      selectedVersionId = crypto.randomUUID()
      await database.insert(documentVersions).values({
        id: selectedVersionId,
        documentId: payload.id,
        major: !latest ? 1 : latest.isRelease ? latest.major + 1 : latest.major,
        minor: !latest || latest.isRelease ? 0 : latest.minor + 1,
        isRelease: Boolean(payload.publish),
        structureJson: payload.structureJson,
        graphJson: payload.graphJson,
        settingsJson: payload.settingsJson,
        createdAt: now,
      })
    }
    return { ...(await getDocument(payload.id, selectedVersionId)), selectedVersionId }
  })
}

export async function deleteDocument(documentId: string) {
  const database = getDrizzleDatabase()
  const snapshot = await getDocument(documentId)
  if (snapshot.document) {
    await recordRecentlyDeletedResource({
      resourceId: snapshot.document.id,
      kind: "document",
      title: snapshot.document.title,
      deletedAt: Date.now(),
      snapshot,
    })
  }
  await database.delete(documentVersions).where(eq(documentVersions.documentId, documentId))
  await database.delete(documents).where(eq(documents.id, documentId))
  return { success: true }
}

export async function restoreDocumentSnapshot(snapshot: DocumentSnapshot) {
  const database = getDrizzleDatabase()
  const document = snapshot.document
  if (!document) throw new Error("Document snapshot is missing the document record.")
  const [existing] = await database.select({ id: documents.id }).from(documents).where(eq(documents.id, document.id)).limit(1)
  if (existing) throw new Error(`Document '${document.title}' already exists.`)
  await database.insert(documents).values({
    id: document.id,
    title: document.title,
    summary: document.summary,
    enabled: document.enabled,
    updatedAt: document.updatedAt,
  })
  await database.insert(documentVersions).values(
    snapshot.versions.map((version) => ({
      id: version.id,
      documentId: document.id,
      major: version.major,
      minor: version.minor,
      isRelease: version.isRelease,
      structureJson: version.structureJson,
      graphJson: version.graphJson,
      settingsJson: version.settingsJson,
      createdAt: version.createdAt,
    })),
  )
  return getDocument(document.id, snapshot.selectedVersionId ?? undefined)
}
