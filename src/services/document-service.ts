import type {
  DocumentDetail,
  DocumentFileContent,
  DocumentFileTree,
  DocumentGraphEdge,
  DocumentPageRecord,
  DocumentSummary,
} from "@/types/document"
import { requireAppBridge } from "@/services/bridge"

export type DocumentSavePayload = {
  id: string
  title: string
  summary: string
  enabled: boolean
  pages: DocumentPageRecord[]
  graphEdges: DocumentGraphEdge[]
  settings: { isPublic: boolean; includeInLlmsTxt: boolean }
  selectedVersionId?: string
  publish?: boolean
}

export const DocumentApi = {
  listAll: () => requireAppBridge().documents.list() as Promise<DocumentSummary[]>,
  get: (documentId: string, versionId?: string) =>
    requireAppBridge().documents.get(documentId, versionId) as Promise<DocumentDetail | null>,
  getFileTree: (documentId: string, versionId?: string) =>
    requireAppBridge().documents.getFileTree(documentId, versionId) as Promise<DocumentFileTree>,
  getFile: (documentId: string, fileId: string, versionId?: string) =>
    requireAppBridge().documents.getFile(documentId, fileId, versionId) as Promise<DocumentFileContent>,
  create: () => requireAppBridge().documents.create() as Promise<DocumentDetail>,
  createWithMetadata: (payload: { title: string; summary: string }) =>
    requireAppBridge().documents.createWithMetadata(payload) as Promise<DocumentDetail>,
  save: (payload: DocumentSavePayload) =>
    requireAppBridge().documents.save({
      id: payload.id,
      title: payload.title,
      summary: payload.summary,
      enabled: payload.enabled,
      structureJson: JSON.stringify({ pages: payload.pages }),
      graphJson: JSON.stringify({ edges: payload.graphEdges }),
      settingsJson: JSON.stringify(payload.settings),
      selectedVersionId: payload.selectedVersionId,
      publish: payload.publish,
    }) as Promise<DocumentDetail>,
  remove: (documentId: string) => requireAppBridge().documents.delete(documentId),
}

export const listDocuments = DocumentApi.listAll
export const createDocumentWithMetadata = DocumentApi.createWithMetadata
export const getDocumentDetail = async (documentId: string, versionId?: string) => {
  const detail = await DocumentApi.get(documentId, versionId)
  if (!detail) throw new Error(`Document ${documentId} was not found.`)
  return detail
}
export const saveDocumentDraft = (documentId: string, payload: Omit<DocumentSavePayload, "id">) =>
  DocumentApi.save({ ...payload, id: documentId })
export const deleteDocument = DocumentApi.remove

export type { DocumentDetail, DocumentGraphEdge, DocumentPageRecord, DocumentSummary }
