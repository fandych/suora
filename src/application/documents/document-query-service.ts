import { createDocumentWithMetadata, listDocuments } from "@/data/repositories/document-repository"

export const documentQueryService = {
  create: createDocumentWithMetadata,
  list: listDocuments,
}
