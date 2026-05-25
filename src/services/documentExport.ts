/**
 * Document Export
 *
 * Bulk export of document groups as structured Markdown files.
 * Inspired by llm_wiki's filesystem-first approach where every wiki page
 * is a plain .md file organized in directories.
 */

import type { DocumentItem, DocumentNode } from '@/types'
import { getDocumentDisplayName } from './documents'
import { buildDocumentPath } from './documentGraph'

export interface DocumentExportFile {
  /** Relative path within the export (e.g. "Research/Architecture.md") */
  path: string
  /** File content (markdown) */
  content: string
}

export interface DocumentExportResult {
  files: DocumentExportFile[]
  totalDocuments: number
  totalFolders: number
  totalCharacters: number
}

export interface DocumentExportOptions {
  /** Include frontmatter in exported files. Default: true */
  includeFrontmatter?: boolean
  /** Include empty folders as .gitkeep files. Default: false */
  includeEmptyFolders?: boolean
  /** Add a README.md index file at root. Default: true */
  includeIndex?: boolean
}

function sanitizePathSegment(segment: string): string {
  return segment
    .replace(/[<>:"|?*\\/]/g, '_')
    .replace(/\s+/g, ' ')
    .trim()
}

function buildExportPath(node: DocumentNode, nodeById: Map<string, DocumentNode>): string {
  const parts: string[] = []
  const visited = new Set<string>()

  let current: DocumentNode | undefined = node
  while (current) {
    if (visited.has(current.id)) break
    visited.add(current.id)

    if (current.type === 'document') {
      parts.unshift(getDocumentDisplayName(current.title))
    } else {
      parts.unshift(sanitizePathSegment(current.title))
    }

    current = current.parentId ? nodeById.get(current.parentId) : undefined
  }

  return parts.join('/')
}

/**
 * Export a document group as a collection of markdown files.
 * Returns an array of file objects with paths and content.
 */
export function exportDocumentGroup(
  nodes: DocumentNode[],
  groupId: string,
  groupName: string,
  options: DocumentExportOptions = {},
): DocumentExportResult {
  const {
    includeFrontmatter = true,
    includeEmptyFolders = false,
    includeIndex = true,
  } = options

  const groupNodes = nodes.filter((node) => node.groupId === groupId)
  const nodeById = new Map(groupNodes.map((node) => [node.id, node]))
  const documents = groupNodes.filter((node): node is DocumentItem => node.type === 'document')
  const folders = groupNodes.filter((node) => node.type === 'folder')

  const files: DocumentExportFile[] = []
  let totalCharacters = 0

  // Export each document
  for (const doc of documents) {
    const relativePath = buildExportPath(doc, nodeById)
    let content = doc.markdown

    if (includeFrontmatter && !content.startsWith('---\n')) {
      // Add basic frontmatter if none exists
      const frontmatter = [
        '---',
        `title: "${doc.title}"`,
        `created: "${new Date(doc.createdAt).toISOString().slice(0, 10)}"`,
        `updated: "${new Date(doc.updatedAt).toISOString().slice(0, 10)}"`,
        '---',
        '',
      ].join('\n')
      content = frontmatter + content
    }

    files.push({ path: relativePath, content })
    totalCharacters += content.length
  }

  // Include empty folders as .gitkeep
  if (includeEmptyFolders) {
    for (const folder of folders) {
      const hasChildren = groupNodes.some((node) => node.parentId === folder.id)
      if (!hasChildren) {
        const folderPath = buildExportPath(folder, nodeById)
        files.push({ path: `${folderPath}/.gitkeep`, content: '' })
      }
    }
  }

  // Generate index file
  if (includeIndex && documents.length > 0) {
    const indexLines = [
      `# ${groupName}`,
      '',
      `> Exported ${documents.length} documents on ${new Date().toISOString().slice(0, 10)}`,
      '',
      '## Contents',
      '',
    ]

    const sortedDocs = [...documents].sort((a, b) => {
      const pathA = buildDocumentPath(a, groupNodes, nodeById)
      const pathB = buildDocumentPath(b, groupNodes, nodeById)
      return pathA.localeCompare(pathB)
    })

    for (const doc of sortedDocs) {
      const path = buildExportPath(doc, nodeById)
      const displayPath = buildDocumentPath(doc, groupNodes, nodeById)
      indexLines.push(`- [${displayPath}](./${path})`)
    }

    indexLines.push('')
    files.push({ path: 'README.md', content: indexLines.join('\n') })
  }

  return {
    files,
    totalDocuments: documents.length,
    totalFolders: folders.length,
    totalCharacters,
  }
}

/**
 * Serialize an export result to a single concatenated string for download.
 * Uses a separator format that can be split later if needed.
 */
export function serializeExportToString(result: DocumentExportResult): string {
  const sections = result.files.map((file) =>
    `=== FILE: ${file.path} ===\n${file.content}`,
  )
  return sections.join('\n\n')
}
