import type { DocumentFileContent, DocumentFileTree, DocumentFileTreeNode, DocumentPageRecord } from "@/types/document"

const WINDOWS_RESERVED_FILE_NAMES = new Set([
  "aux",
  "com1",
  "com2",
  "com3",
  "com4",
  "com5",
  "com6",
  "com7",
  "com8",
  "com9",
  "con",
  "lpt1",
  "lpt2",
  "lpt3",
  "lpt4",
  "lpt5",
  "lpt6",
  "lpt7",
  "lpt8",
  "lpt9",
  "nul",
  "prn",
])

export function assertSafeDocumentFileName(value: string) {
  const normalized = value.trim()
  if (!normalized) throw new Error("Document file name is required.")
  const stem = normalized.split(/[\\/]/).pop()?.split(".")[0]?.trim().toLowerCase()
  if (stem && WINDOWS_RESERVED_FILE_NAMES.has(stem)) {
    throw new Error(`Document file name uses a reserved Windows name: ${value}`)
  }
  return normalized
}

export function buildDocumentFileTree(
  documentId: string,
  documentName: string,
  description: string,
  pages: DocumentPageRecord[],
): DocumentFileTree {
  const byParent = new Map<string | null, DocumentPageRecord[]>()
  for (const page of pages) byParent.set(page.parentId ?? null, [...(byParent.get(page.parentId ?? null) ?? []), page])
  const build = (parentId: string | null): DocumentFileTreeNode[] =>
    (byParent.get(parentId) ?? [])
      .sort((left, right) =>
        (left.type ?? "document") === (right.type ?? "document")
          ? left.title.localeCompare(right.title)
          : (left.type ?? "document") === "folder"
            ? -1
            : 1,
      )
      .map((page) => ({
        fileName: assertSafeDocumentFileName(page.title),
        fileId: page.id,
        fileType: (page.type ?? "document") === "folder" ? "directory" : "document",
        ...((page.type ?? "document") === "folder" ? { children: build(page.id) } : {}),
      }))
  return { documentId, documentName, description, children: build(null) }
}

export function getDocumentFileContent(
  documentId: string,
  documentName: string,
  description: string,
  updatedAt: number,
  pages: DocumentPageRecord[],
  fileId: string,
): DocumentFileContent {
  const page = pages.find((item) => item.id === fileId)
  if (!page) throw new Error("Document file was not found.")
  return {
    documentId,
    documentName,
    description,
    fileId: page.id,
    fileName: assertSafeDocumentFileName(page.title),
    fileContent: page.content,
    fileType: (page.type ?? "document") === "folder" ? "directory" : "document",
    lastModifyDate: updatedAt,
  }
}
