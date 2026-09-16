import type { DocumentPageRecord } from "@/types/document"

export type DocumentTreeEntry = { node: DocumentPageRecord; depth: number }

function getDocumentExtension(title: string) {
  const basename = title.trim().split(/[\\/]/).pop() ?? ""
  const dotIndex = basename.lastIndexOf(".")
  return dotIndex > 0 ? basename.slice(dotIndex).toLowerCase() : ""
}

export function isMarkdownDocumentTitle(title: string) {
  const extension = getDocumentExtension(title)
  return !extension || [".md", ".markdown", ".mdx", ".txt"].includes(extension)
}

export const getDocumentDisplayName = (title: string) => (getDocumentExtension(title) ? title : `${title}.md`)

export function getDocumentSourceLanguage(title: string) {
  switch (getDocumentExtension(title)) {
    case ".json":
      return "json"
    case ".yaml":
    case ".yml":
      return "yaml"
    case ".ts":
    case ".tsx":
      return "typescript"
    case ".js":
    case ".mjs":
    case ".cjs":
      return "javascript"
    case ".html":
      return "html"
    default:
      return "markdown"
  }
}

export function buildDocumentTree(pages: DocumentPageRecord[]) {
  const byParent = new Map<string | null, DocumentPageRecord[]>()
  for (const page of pages) byParent.set(page.parentId ?? null, [...(byParent.get(page.parentId ?? null) ?? []), page])
  for (const group of byParent.values())
    group.sort((left, right) =>
      (left.type ?? "document") !== (right.type ?? "document")
        ? (left.type ?? "document") === "document"
          ? -1
          : 1
        : left.title.localeCompare(right.title),
    )
  const entries: DocumentTreeEntry[] = []
  const visit = (parentId: string | null, depth: number) => {
    for (const node of byParent.get(parentId) ?? []) {
      entries.push({ node, depth })
      if ((node.type ?? "document") === "folder") visit(node.id, depth + 1)
    }
  }
  visit(null, 0)
  return entries
}
