/**
 * Document Version History
 *
 * Simple snapshot-based version tracking for documents.
 * Stores content snapshots with timestamps and optional labels.
 * Inspired by llm_wiki's Git-native versioning approach but kept in-memory
 * for the Zustand-persisted architecture.
 */

export interface DocumentVersion {
  id: string
  documentId: string
  markdown: string
  title: string
  label?: string
  createdAt: number
  characterCount: number
  wordCount: number
}

export interface DocumentVersionDiff {
  added: number
  removed: number
  unchanged: number
  addedLines: string[]
  removedLines: string[]
}

const MAX_VERSIONS_PER_DOCUMENT = 50

/**
 * Create a new version snapshot for a document.
 */
export function createDocumentVersion(
  documentId: string,
  title: string,
  markdown: string,
  label?: string,
): DocumentVersion {
  const wordCount = (markdown.match(/[\p{L}\p{N}]+/gu) ?? []).length
  return {
    id: `doc-version-${Date.now().toString(36)}-${crypto.randomUUID().slice(0, 8)}`,
    documentId,
    markdown,
    title,
    label,
    createdAt: Date.now(),
    characterCount: markdown.length,
    wordCount,
  }
}

/**
 * Add a version to the history, maintaining the per-document limit.
 * Returns the updated versions array.
 */
export function addDocumentVersion(
  versions: DocumentVersion[],
  newVersion: DocumentVersion,
): DocumentVersion[] {
  const documentVersions = versions.filter((v) => v.documentId === newVersion.documentId)
  const otherVersions = versions.filter((v) => v.documentId !== newVersion.documentId)

  // Keep only the most recent versions up to the limit
  const trimmed = documentVersions.length >= MAX_VERSIONS_PER_DOCUMENT
    ? documentVersions.slice(-(MAX_VERSIONS_PER_DOCUMENT - 1))
    : documentVersions

  return [...otherVersions, ...trimmed, newVersion]
}

/**
 * Get all versions for a specific document, sorted newest first.
 */
export function getDocumentVersions(versions: DocumentVersion[], documentId: string): DocumentVersion[] {
  return versions
    .filter((v) => v.documentId === documentId)
    .sort((a, b) => b.createdAt - a.createdAt)
}

/**
 * Compute a simple line-based diff between two versions.
 */
export function diffDocumentVersions(
  olderMarkdown: string,
  newerMarkdown: string,
): DocumentVersionDiff {
  const oldLines = olderMarkdown.split('\n')
  const newLines = newerMarkdown.split('\n')
  const oldSet = new Set(oldLines)
  const newSet = new Set(newLines)

  const addedLines = newLines.filter((line) => !oldSet.has(line) && line.trim() !== '')
  const removedLines = oldLines.filter((line) => !newSet.has(line) && line.trim() !== '')
  const unchanged = oldLines.filter((line) => newSet.has(line)).length

  return {
    added: addedLines.length,
    removed: removedLines.length,
    unchanged,
    addedLines: addedLines.slice(0, 20),
    removedLines: removedLines.slice(0, 20),
  }
}

/**
 * Determine whether content has changed enough to warrant a new version.
 * Avoids creating versions for trivial edits (e.g. single character changes).
 */
export function shouldCreateVersion(
  previousMarkdown: string | undefined,
  currentMarkdown: string,
  minCharDelta = 50,
): boolean {
  if (!previousMarkdown) return true
  if (previousMarkdown === currentMarkdown) return false

  const charDiff = Math.abs(currentMarkdown.length - previousMarkdown.length)
  if (charDiff >= minCharDelta) return true

  // Check line-level changes
  const oldLines = previousMarkdown.split('\n')
  const newLines = currentMarkdown.split('\n')
  const lineCountDiff = Math.abs(newLines.length - oldLines.length)
  if (lineCountDiff >= 3) return true

  // Check for structural changes (headings, frontmatter)
  const oldHeadings = oldLines.filter((l) => /^#{1,6}\s/.test(l)).length
  const newHeadings = newLines.filter((l) => /^#{1,6}\s/.test(l)).length
  if (oldHeadings !== newHeadings) return true

  return false
}
