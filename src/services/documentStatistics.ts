/**
 * Document Statistics
 *
 * Utility functions for computing document metrics: word count,
 * character count, reading time, link counts, and structural stats.
 */

import type { DocumentItem, DocumentNode } from '@/types'
import { extractMarkdownReferences } from './documents'
import { extractDocumentTags, extractExternalLinks } from './documentGraph'

export interface DocumentStatistics {
  characterCount: number
  wordCount: number
  lineCount: number
  readingTimeMinutes: number
  headingCount: number
  paragraphCount: number
  referenceCount: number
  externalLinkCount: number
  tagCount: number
  imageCount: number
  codeBlockCount: number
  hasFrontmatter: boolean
}

export interface DocumentGroupStatistics {
  documentCount: number
  folderCount: number
  totalWordCount: number
  totalCharacterCount: number
  averageWordCount: number
  averageReadingTimeMinutes: number
  tagDistribution: Record<string, number>
  typeDistribution: Record<string, number>
  recentlyUpdated: DocumentItem[]
}

const WORDS_PER_MINUTE = 200
const CJK_CHARS_PER_MINUTE = 400
const CJK_PATTERN = /[\u3400-\u4dbf\u4e00-\u9fff\u{20000}-\u{2a6df}\u{2a700}-\u{2b73f}]/gu
const WORD_PATTERN = /[\p{L}\p{N}]+/gu
const HEADING_PATTERN = /^#{1,6}\s+.+$/gm
const CODE_BLOCK_PATTERN = /^```[\s\S]*?^```/gm
const IMAGE_PATTERN = /!\[[^\]]*\]\([^)]+\)/g
const FRONTMATTER_PATTERN = /^---\n[\s\S]*?\n---/

/**
 * Compute statistics for a single document.
 */
export function computeDocumentStatistics(markdown: string): DocumentStatistics {
  const hasFrontmatter = FRONTMATTER_PATTERN.test(markdown)
  const body = hasFrontmatter ? markdown.replace(FRONTMATTER_PATTERN, '').trim() : markdown

  const cjkChars = body.match(CJK_PATTERN) ?? []
  const words = body.match(WORD_PATTERN) ?? []
  // CJK characters count as roughly 1.5 "words" for reading time
  const effectiveWordCount = words.length - cjkChars.length + cjkChars.length
  const cjkReadingTime = cjkChars.length / CJK_CHARS_PER_MINUTE
  const nonCjkWordCount = words.length - cjkChars.length
  const nonCjkReadingTime = nonCjkWordCount / WORDS_PER_MINUTE
  const readingTimeMinutes = Math.max(1, Math.ceil(cjkReadingTime + nonCjkReadingTime))

  const lines = markdown.split('\n')
  const paragraphs = body.split(/\n\s*\n/).filter((p) => p.trim().length > 0)
  const headings = body.match(HEADING_PATTERN) ?? []
  const codeBlocks = body.match(CODE_BLOCK_PATTERN) ?? []
  const images = body.match(IMAGE_PATTERN) ?? []

  const references = extractMarkdownReferences(body)
  const externalLinks = extractExternalLinks(body)
  const tags = extractDocumentTags(markdown)

  return {
    characterCount: markdown.length,
    wordCount: effectiveWordCount,
    lineCount: lines.length,
    readingTimeMinutes,
    headingCount: headings.length,
    paragraphCount: paragraphs.length,
    referenceCount: references.length,
    externalLinkCount: externalLinks.length,
    tagCount: tags.length,
    imageCount: images.length,
    codeBlockCount: codeBlocks.length,
    hasFrontmatter,
  }
}

/**
 * Compute aggregate statistics for a document group.
 */
export function computeDocumentGroupStatistics(
  nodes: DocumentNode[],
  groupId: string,
): DocumentGroupStatistics {
  const groupNodes = nodes.filter((node) => node.groupId === groupId)
  const documents = groupNodes.filter((node): node is DocumentItem => node.type === 'document')
  const folders = groupNodes.filter((node) => node.type === 'folder')

  const tagDistribution: Record<string, number> = {}
  const typeDistribution: Record<string, number> = {}
  let totalWordCount = 0
  let totalCharacterCount = 0

  for (const doc of documents) {
    const stats = computeDocumentStatistics(doc.markdown)
    totalWordCount += stats.wordCount
    totalCharacterCount += stats.characterCount

    const tags = extractDocumentTags(doc.markdown)
    for (const tag of tags) {
      tagDistribution[tag] = (tagDistribution[tag] ?? 0) + 1
    }

    // Extract type from frontmatter if present
    const typeMatch = /^type:\s*["']?(\w+)["']?/m.exec(doc.markdown)
    const docType = typeMatch?.[1] ?? 'untyped'
    typeDistribution[docType] = (typeDistribution[docType] ?? 0) + 1
  }

  const averageWordCount = documents.length > 0 ? Math.round(totalWordCount / documents.length) : 0
  const averageReadingTime = documents.length > 0 ? Math.ceil(totalWordCount / WORDS_PER_MINUTE / documents.length) : 0

  const recentlyUpdated = [...documents]
    .sort((a, b) => b.updatedAt - a.updatedAt)
    .slice(0, 5)

  return {
    documentCount: documents.length,
    folderCount: folders.length,
    totalWordCount,
    totalCharacterCount,
    averageWordCount,
    averageReadingTimeMinutes: averageReadingTime,
    tagDistribution,
    typeDistribution,
    recentlyUpdated,
  }
}
