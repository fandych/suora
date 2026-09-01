import type {
  DocumentDetail,
  DocumentGraphEdge,
  DocumentPageRecord,
  DocumentSummary,
} from "@/data/domain/models"

import { ensureSeeded } from "@/data/repositories/seed-repository"
import { normalizeDocumentNodes } from "@/lib/document-tree"
import { suoraIpc } from "@/lib/ipc"

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