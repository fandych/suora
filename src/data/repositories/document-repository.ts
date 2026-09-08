import type {
  DocumentDetail,
  DocumentGraphEdge,
  DocumentPageRecord,
  DocumentSummary,
} from "@/data/domain/models"

import { ensureSeeded } from "@/data/repositories/seed-repository"
import { buildDefaultDocumentNodes, getDocumentDisplayName, normalizeDocumentNodes } from "@/lib/document-tree"
import { suoraIpc } from "@/lib/ipc"
import { getDocumentArchivePathError, normalizeDocumentArchivePath } from "@/lib/document-tree"
import { createArchiveImportPlan, getImportableArchiveEntries, readArchiveEntries, type ArchiveImportPlan, type ArchiveImportStrategy } from "@/lib/resource-files"

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
    selectedVersionId: created.selectedVersion.id,
    title: payload.title,
    summary: payload.summary,
    enabled: created.document.enabled,
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

export async function saveDocumentDraft(documentId: string, payload: { title: string; summary: string; enabled: boolean; pages: DocumentPageRecord[]; graphEdges: DocumentGraphEdge[]; settings: { isPublic: boolean; includeInLlmsTxt: boolean }; selectedVersionId?: string }) {
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
  return suoraIpc.documents.save({ id: documentId, title: detail.document.title, summary: detail.document.summary, enabled: detail.document.enabled, pages: detail.pages, graphEdges: detail.graphEdges, settings: detail.settings, selectedVersionId: detail.selectedVersion.id, publish: true }) as Promise<DocumentDetail>
}

export async function deleteDocument(documentId: string) {
  await ensureSeeded()
  return suoraIpc.documents.delete(documentId)
}

export async function previewDocumentArchiveImport(file: File, strategy: ArchiveImportStrategy): Promise<ArchiveImportPlan> {
  await ensureSeeded()
  const title = file.name.replace(/\.zip$/i, "") || "Imported document"
  const scaffoldPages = buildDefaultDocumentNodes(title)
  const rootFolderId = scaffoldPages.find((page) => (page.type ?? "document") === "folder" && page.parentId === null)?.id ?? scaffoldPages[0]?.id ?? ""
  const existingPaths = scaffoldPages
    .filter((page) => page.id !== rootFolderId)
    .map((page) => {
      const segments: string[] = []
      let current: DocumentPageRecord | undefined = page
      while (current && current.parentId) {
        segments.unshift((current.type ?? "document") === "document" ? getDocumentDisplayName(current.title) : current.title)
        current = scaffoldPages.find((candidate) => candidate.id === current?.parentId)
      }
      return segments.join("/")
    })
  const entries = await readArchiveEntries(file)
  return createArchiveImportPlan(entries, {
    existingPaths,
    strategy,
    validatePath: (path) => getDocumentArchivePathError(path),
  })
}

export async function importDocumentArchive(file: File, strategy: ArchiveImportStrategy = "overwrite") {
  await ensureSeeded()
  const name = file.name.replace(/\.zip$/i, "") || "Imported document"
  const created = await createDocumentWithMetadata({ title: name, summary: `Imported from ${file.name}` })
  const rootFolderId = created.pages.find((page) => (page.type ?? "document") === "folder" && page.parentId === null)?.id ?? created.pages[0]?.id ?? globalThis.crypto.randomUUID()
  const existingPaths = created.pages
    .filter((page) => page.id !== rootFolderId)
    .map((page) => {
      const segments: string[] = []
      let current: DocumentPageRecord | undefined = page
      while (current && current.parentId) {
        segments.unshift((current.type ?? "document") === "document" ? getDocumentDisplayName(current.title) : current.title)
        current = created.pages.find((candidate) => candidate.id === current?.parentId)
      }
      return segments.join("/")
    })
  const plan = createArchiveImportPlan(await readArchiveEntries(file), {
    existingPaths,
    strategy,
    validatePath: (path) => getDocumentArchivePathError(path),
  })
  if (plan.hasBlockingIssues) {
    throw new Error(plan.issues.find((issue) => issue.severity === "error")?.message ?? "Document archive validation failed.")
  }
  const entries = getImportableArchiveEntries(plan)

  const pathToId = new Map<string, string>()
  const nextPages: DocumentPageRecord[] = []

  for (const entry of entries) {
    const parts = normalizeDocumentArchivePath(entry.path).split("/").filter(Boolean)
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

      const id = globalThis.crypto.randomUUID()
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
    enabled: created.document.enabled,
    pages: [
      ...buildDefaultDocumentNodes(created.document.title).filter(() => false),
      ...created.pages.filter((page) => page.id === rootFolderId),
      ...nextPages,
    ],
    graphEdges: [],
    settings: created.settings,
    selectedVersionId: created.selectedVersion.id,
  })
}