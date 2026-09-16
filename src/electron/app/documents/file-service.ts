import type { DocumentFileContent, DocumentFileTree, DocumentFileTreeNode, DocumentPageRecord } from "@/types/document"

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
        fileName: page.title,
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
    fileName: page.title,
    fileContent: page.content,
    fileType: (page.type ?? "document") === "folder" ? "directory" : "document",
    lastModifyDate: updatedAt,
  }
}
