import type {
  DocumentDetail,
  DocumentGraphEdge,
  DocumentPageRecord,
  DocumentSummary,
} from "@/data/domain/models"

import { ensureSeeded } from "@/data/repositories/seed-repository"
import { buildDefaultDocumentNodes, getDocumentDisplayName, normalizeDocumentNodes } from "@/lib/document-tree"
import { suoraIpc } from "@/lib/ipc"
import { readArchiveEntries } from "@/lib/resource-files"

function normalizeDocument(detail: DocumentDetail) {
  return {
    ...detail,
    pages: normalizeDocumentNodes(detail.pages, detail.document.title),
  }
}

export async function listDocuments() {
  await ensureSeeded()
  return suoraIpc.documents.list() as Promise<DocumentSummary[]>
}

export async function createDocument() {
  await ensureSeeded()
  return suoraIpc.documents.create() as Promise<DocumentDetail>
}

export async function createDocumentWithMetadata(payload: { title: string; summary: string }) {
  await ensureSeeded()
  const created = await createDocument()
  return saveDocumentDraft(created.document.id, {
    title: payload.title,
    summary: payload.summary,
    pages: normalizeDocumentNodes(created.pages, payload.title),
    graphEdges: created.graphEdges,
    settings: created.settings,
  })
}

export async function getDocumentDetail(documentId: string, selectedVersionId?: string) {
  await ensureSeeded()
  const detail = await suoraIpc.documents.get(documentId, selectedVersionId) as DocumentDetail | null
  if (!detail) {
    throw new Error(`Document ${documentId} was not found.`)
  }
  return normalizeDocument(detail)
}

export async function saveDocumentDraft(documentId: string, payload: { title: string; summary: string; pages: DocumentPageRecord[]; graphEdges: DocumentGraphEdge[]; settings: { isPublic: boolean; includeInLlmsTxt: boolean } }) {
  await ensureSeeded()
  return suoraIpc.documents.save({
    id: documentId,
    ...payload,
    pages: normalizeDocumentNodes(payload.pages, payload.title),
  }) as Promise<DocumentDetail>
}

export async function publishDocumentVersion(documentId: string, versionId: string) {
  await ensureSeeded()
  const detail = await getDocumentDetail(documentId, versionId)
  return suoraIpc.documents.save({ id: documentId, title: detail.document.title, summary: detail.document.summary, pages: detail.pages, graphEdges: detail.graphEdges, settings: detail.settings, publish: true }) as Promise<DocumentDetail>
}

export async function deleteDocument(documentId: string) {
  await ensureSeeded()
  return suoraIpc.documents.delete(documentId)
}

export async function importDocumentArchive(file: File) {
  await ensureSeeded()
  const name = file.name.replace(/\.zip$/i, "") || "Imported document"
  const created = await createDocumentWithMetadata({ title: name, summary: `Imported from ${file.name}` })
  const rootFolderId = created.pages.find((page) => (page.type ?? "document") === "folder" && page.parentId === null)?.id ?? created.pages[0]?.id ?? crypto.randomUUID()
  const entries = await readArchiveEntries(file)

  const pathToId = new Map<string, string>()
  const nextPages: DocumentPageRecord[] = []

  for (const entry of entries) {
    const parts = entry.path.split("/").filter(Boolean)
    if (parts.length === 0) {
      continue
    }

    let parentId: string | null = rootFolderId
    for (let index = 0; index < parts.length; index += 1) {
      const currentPath = parts.slice(0, index + 1).join("/")
      const isLeaf = index === parts.length - 1
      const isDirectory = !isLeaf || entry.kind === "directory"

      if (pathToId.has(currentPath)) {
        parentId = pathToId.get(currentPath) ?? parentId
        continue
      }

      const id = crypto.randomUUID()
      pathToId.set(currentPath, id)
      nextPages.push({
        id,
        title: isDirectory ? parts[index] : getDocumentDisplayName(parts[index]),
        content: isDirectory ? "" : entry.content,
        type: isDirectory ? "folder" : "document",
        parentId,
      })
      parentId = id
    }
  }

  return saveDocumentDraft(created.document.id, {
    title: created.document.title,
    summary: created.document.summary,
    pages: [
      ...buildDefaultDocumentNodes(created.document.title).filter(() => false),
      ...created.pages.filter((page) => page.id === rootFolderId),
      ...nextPages,
    ],
    graphEdges: [],
    settings: created.settings,
  })
}