import type { DocumentPageRecord } from "@/data/domain/models"

export type DocumentTreeEntry = {
  node: DocumentPageRecord
  depth: number
}

function slugifyTitle(value: string) {
  const slug = value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9\u4e00-\u9fa5]+/g, "-")
    .replace(/^-+|-+$/g, "")

  return slug || "untitled"
}

export function normalizeDocumentArchivePath(path: string) {
  return path.replace(/\\/g, "/").replace(/^\/+/, "").replace(/\/+$/g, "").replace(/\/+/g, "/")
}

export function getDocumentArchivePathError(path: string) {
  const normalized = normalizeDocumentArchivePath(path)

  if (!normalized) {
    return "Archive entries must include a non-empty relative path."
  }

  if (normalized.startsWith("/") || /^[a-zA-Z]:[\\/]/.test(normalized)) {
    return "Archive entries must stay inside the document workspace."
  }

  const segments = normalized.split("/").filter(Boolean)
  if (segments.length === 0 || segments.includes(".") || segments.includes("..")) {
    return "Archive entries cannot contain empty, '.' , or '..' path segments."
  }

  return null
}

export function getDocumentExtension(title: string) {
  const basename = title.trim().split(/[\\/]/).pop() ?? ""
  const dotIndex = basename.lastIndexOf(".")
  return dotIndex > 0 ? basename.slice(dotIndex).toLowerCase() : ""
}

export function isMarkdownDocumentTitle(title: string) {
  const extension = getDocumentExtension(title)
  return !extension || [".md", ".markdown", ".mdx", ".txt"].includes(extension)
}

export function getDocumentDisplayName(title: string) {
  return getDocumentExtension(title) ? title : `${title}.md`
}

export function getDocumentKindLabel(title: string) {
  const extension = getDocumentExtension(title)
  if (!extension || [".md", ".markdown", ".mdx", ".txt"].includes(extension)) {
    return "Markdown"
  }
  return extension.slice(1).toUpperCase()
}

export function getDocumentSourceLanguage(title: string) {
  const extension = getDocumentExtension(title)
  switch (extension) {
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

export function buildDefaultDocumentNodes(title: string): DocumentPageRecord[] {
  const folderId = crypto.randomUUID()
  const overviewTitle = `${slugifyTitle(title)}-overview.md`
  const referenceTitle = `${slugifyTitle(title)}-reference.md`

  return [
    { id: folderId, title, content: "", type: "folder", parentId: null },
    { id: crypto.randomUUID(), title: overviewTitle, content: `# ${title}\n\n## Overview\n\nDocument purpose and scope.\n`, type: "document", parentId: folderId },
    { id: crypto.randomUUID(), title: referenceTitle, content: `# ${title} Reference\n\n## Notes\n\n- Add structured notes here.\n`, type: "document", parentId: folderId },
  ]
}

export function normalizeDocumentNodes(pages: DocumentPageRecord[], documentTitle: string) {
  if (pages.length === 0) {
    return buildDefaultDocumentNodes(documentTitle)
  }

  return pages.map((page) => {
    const type = page.type ?? "document"
    return {
      ...page,
      title: type === "document" ? getDocumentDisplayName(page.title) : page.parentId === null ? documentTitle : page.title,
      content: page.content ?? "",
      type,
      parentId: page.parentId ?? null,
    }
  })
}

export function buildDocumentTree(pages: DocumentPageRecord[]) {
  const byParent = new Map<string | null, DocumentPageRecord[]>()
  for (const page of pages) {
    const parentId = page.parentId ?? null
    const group = byParent.get(parentId) ?? []
    group.push(page)
    byParent.set(parentId, group)
  }

  for (const group of byParent.values()) {
    group.sort((left, right) => {
      const leftType = left.type ?? "document"
      const rightType = right.type ?? "document"
      if (leftType !== rightType) {
        return leftType === "folder" ? -1 : 1
      }
      return left.title.localeCompare(right.title)
    })
  }

  const entries: DocumentTreeEntry[] = []
  const visit = (parentId: string | null, depth: number) => {
    for (const node of byParent.get(parentId) ?? []) {
      entries.push({ node, depth })
      if ((node.type ?? "document") === "folder") {
        visit(node.id, depth + 1)
      }
    }
  }

  visit(null, 0)
  return entries
}