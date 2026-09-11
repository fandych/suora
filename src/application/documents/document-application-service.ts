import { deleteDocument, getDocumentDetail, listDocuments, saveDocumentDraft } from "@/data/repositories/document-repository"

export const documentApplicationService = {
  list: () => listDocuments(),
  getDetail: (documentId: string, versionId?: string) => getDocumentDetail(documentId, versionId),
  saveDraft: (documentId: string, payload: Parameters<typeof saveDocumentDraft>[1]) => saveDocumentDraft(documentId, payload),
  remove: (documentId: string) => deleteDocument(documentId),
}
