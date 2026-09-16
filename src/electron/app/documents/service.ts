import type {
  DocumentDetail,
  DocumentGraphEdge,
  DocumentPageRecord,
  DocumentSettings,
  DocumentSummary,
} from "@/types/document"
import type { VersionOption } from "@/types/version"
import {
  createDocument,
  deleteDocument,
  getDocument,
  listDocuments,
  saveDocument,
} from "@/electron/app/documents/repository"
import { buildDocumentFileTree, getDocumentFileContent } from "@/electron/app/documents/file-service"

type DocumentVersionRow = {
  id: string
  major: number
  minor: number
  isRelease: boolean
  createdAt: number
  structureJson: string
  graphJson: string
  settingsJson: string
}
type DocumentPayload = {
  document: DocumentSummary | null
  versions: DocumentVersionRow[]
  selectedVersionId: string | null
}

function parseObject<T>(value: string | undefined, fallback: T) {
  if (!value) return fallback
  try {
    return JSON.parse(value) as T
  } catch {
    return fallback
  }
}

function toDetail(payload: DocumentPayload): DocumentDetail | null {
  if (!payload.document) return null
  const versions = payload.versions.map((version) => ({
    ...version,
    label: `${version.major}.${version.minor}${version.isRelease ? " (Release)" : ""}`,
  })) as VersionOption[]
  const selectedRow =
    payload.versions.find((version) => version.id === payload.selectedVersionId) ?? payload.versions[0]
  const structure = parseObject<{ pages?: DocumentPageRecord[] }>(selectedRow?.structureJson, {})
  const graph = parseObject<{ edges?: DocumentGraphEdge[] }>(selectedRow?.graphJson, {})
  const settings = parseObject<DocumentSettings>(selectedRow?.settingsJson, { isPublic: false, includeInLlmsTxt: true })
  return {
    document: payload.document,
    versions,
    latestVersion: versions[0],
    selectedVersion: versions.find((version) => version.id === payload.selectedVersionId) ?? versions[0],
    pages: structure.pages ?? [],
    graphEdges: graph.edges ?? [],
    settings,
  }
}

export const documentService = {
  list: () => listDocuments(),
  get: async (documentId: string, versionId?: string) => toDetail(await getDocument(documentId, versionId)),
  create: async () => toDetail(await createDocument()),
  createWithMetadata: async (payload: { title: string; summary: string }) => {
    const created = await createDocument()
    return toDetail(
      await saveDocument({
        id: created.document?.id ?? "",
        title: payload.title,
        summary: payload.summary,
        enabled: created.document?.enabled ?? true,
        structureJson: JSON.stringify({
          pages: created.versions[0]
            ? (parseObject<{ pages?: DocumentPageRecord[] }>(created.versions[0].structureJson, {}).pages ?? [])
            : [],
        }),
        graphJson: JSON.stringify({ edges: [] }),
        settingsJson: JSON.stringify({ isPublic: false, includeInLlmsTxt: true }),
        selectedVersionId: created.selectedVersionId ?? undefined,
      }),
    )
  },
  save: async (payload: Parameters<typeof saveDocument>[0]) => toDetail(await saveDocument(payload)),
  remove: (documentId: string) => deleteDocument(documentId),
  async getFileTree(documentId: string, versionId?: string) {
    const detail = await this.get(documentId, versionId)
    if (!detail) throw new Error("Document was not found.")
    return buildDocumentFileTree(detail.document.id, detail.document.title, detail.document.summary, detail.pages)
  },
  async getFile(documentId: string, fileId: string, versionId?: string) {
    const detail = await this.get(documentId, versionId)
    if (!detail) throw new Error("Document was not found.")
    return getDocumentFileContent(
      detail.document.id,
      detail.document.title,
      detail.document.summary,
      detail.document.updatedAt,
      detail.pages,
      fileId,
    )
  },
}
