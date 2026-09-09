import type { DocumentDetail, DocumentGraphEdge, DocumentPageRecord, DocumentSummary, VersionOption } from "@/data/domain/models"
import { getVersionLabel } from "@/data/domain/versioning"
import { buildDefaultDocumentNodes, normalizeDocumentNodes } from "@/data/domain/document-tree"
import { getProjectBridge } from "@/lib/ipc/bridge"
import { parseObjectJson } from "@/lib/serialization/json"

type DocumentVersionRow = { id: string; major: number; minor: number; isRelease: boolean; createdAt: number; structureJson: string; graphJson: string; settingsJson: string }
type DocumentPayload = { document: DocumentSummary | null; versions: DocumentVersionRow[]; selectedVersionId: string | null }
const parsePages = (value: string | undefined, title: string) => { const parsed = parseObjectJson<{ pages?: DocumentPageRecord[] }>(value, {}); return value ? normalizeDocumentNodes(parsed.pages ?? [], title) : buildDefaultDocumentNodes(title) }
const parseEdges = (value: string | undefined) => parseObjectJson<{ edges?: DocumentGraphEdge[] }>(value, {}).edges ?? []
const parseSettings = (value: string | undefined) => parseObjectJson<{ isPublic: boolean; includeInLlmsTxt: boolean }>(value, { isPublic: false, includeInLlmsTxt: true })
function mapDetail(payload: DocumentPayload): DocumentDetail | null { if (!payload.document) return null; const versions = payload.versions.map((version) => ({ ...version, label: getVersionLabel(version) })) as VersionOption[]; const selected = payload.versions.find((version) => version.id === payload.selectedVersionId) ?? payload.versions[0]; return { document: payload.document, versions, latestVersion: versions[0], selectedVersion: versions.find((version) => version.id === payload.selectedVersionId) ?? versions[0], pages: selected ? parsePages(selected.structureJson, payload.document.title) : buildDefaultDocumentNodes(payload.document.title), graphEdges: selected ? parseEdges(selected.graphJson) : [], settings: selected ? parseSettings(selected.settingsJson) : { isPublic: false, includeInLlmsTxt: true } } }
export const documentIpc = {
  list: async () => getProjectBridge().documents.list() as Promise<DocumentSummary[]>,
  get: async (id: string, versionId?: string) => mapDetail(await getProjectBridge().documents.get(id, versionId) as DocumentPayload),
  create: async () => mapDetail(await getProjectBridge().documents.create() as DocumentPayload) as DocumentDetail,
  save: async (payload: { id: string; title: string; summary: string; enabled: boolean; pages: DocumentPageRecord[]; graphEdges: DocumentGraphEdge[]; settings: { isPublic: boolean; includeInLlmsTxt: boolean }; selectedVersionId?: string; publish?: boolean }) => mapDetail(await getProjectBridge().documents.save({ ...payload, structureJson: JSON.stringify({ pages: payload.pages }), graphJson: JSON.stringify({ edges: payload.graphEdges }), settingsJson: JSON.stringify(payload.settings) }) as DocumentPayload) as DocumentDetail,
  delete: async (id: string) => getProjectBridge().documents.delete(id),
}
