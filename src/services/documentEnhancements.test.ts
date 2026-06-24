import { describe, expect, it, vi } from 'vitest'
import type { DocumentNode } from '@/types'
import { generateDocumentFromTemplate, getDocumentTemplate, getDocumentTemplates } from './documentTemplates'
import { getDocumentBody, parseDocumentFrontmatter, serializeDocumentFrontmatter, updateDocumentFrontmatter } from './documentFrontmatter'
import { computeDocumentGroupStatistics, computeDocumentStatistics } from './documentStatistics'
import { addDocumentVersion, createDocumentVersion, diffDocumentVersions, getDocumentVersions, shouldCreateVersion } from './documentVersions'
import { exportDocumentGroup, serializeExportToString } from './documentExport'

describe('document templates', () => {
  it('provides all template types with labels and descriptions', () => {
    const templates = getDocumentTemplates()
    expect(templates.length).toBeGreaterThanOrEqual(7)
    expect(templates.map((t) => t.type)).toEqual(['blank', 'entity', 'concept', 'source', 'research', 'comparison', 'synthesis'])
    templates.forEach((t) => {
      expect(t.label).toBeTruthy()
      expect(t.description).toBeTruthy()
      expect(t.icon).toBeTruthy()
    })
  })

  it('generates blank template with just a heading', () => {
    const content = generateDocumentFromTemplate('blank', 'My Note')
    expect(content).toBe('# My Note\n\n')
  })

  it('generates entity template with frontmatter and structured sections', () => {
    const content = generateDocumentFromTemplate('entity', 'OpenAI')
    expect(content).toContain('type: entity')
    expect(content).toContain('title: "OpenAI"')
    expect(content).toContain('tags: []')
    expect(content).toContain('# OpenAI')
    expect(content).toContain('## Overview')
    expect(content).toContain('## Key Facts')
  })

  it('generates concept template with definition and principles', () => {
    const content = generateDocumentFromTemplate('concept', 'Transformer')
    expect(content).toContain('type: concept')
    expect(content).toContain('## Definition')
    expect(content).toContain('## Key Principles')
    expect(content).toContain('## Applications')
  })

  it('generates source template with summary and evidence', () => {
    const content = generateDocumentFromTemplate('source', 'Paper Review')
    expect(content).toContain('type: source')
    expect(content).toContain('## Summary')
    expect(content).toContain('## Main Points')
    expect(content).toContain('## Quotes & Evidence')
  })

  it('generates research template with questions and findings', () => {
    const content = generateDocumentFromTemplate('research', 'LLM Scaling')
    expect(content).toContain('type: research')
    expect(content).toContain('## Research Question')
    expect(content).toContain('## Findings')
    expect(content).toContain('## Open Questions')
  })

  it('generates comparison template with table structure', () => {
    const content = generateDocumentFromTemplate('comparison', 'GPT vs Claude')
    expect(content).toContain('type: comparison')
    expect(content).toContain('| Dimension | A | B |')
    expect(content).toContain('## Analysis')
    expect(content).toContain('### Strengths')
  })

  it('generates synthesis template with cross-source analysis', () => {
    const content = generateDocumentFromTemplate('synthesis', 'AI Safety Overview')
    expect(content).toContain('type: synthesis')
    expect(content).toContain('## Thesis')
    expect(content).toContain('## Connections')
    expect(content).toContain('### Common Themes')
    expect(content).toContain('### Contradictions')
  })

  it('falls back to a heading for unknown template types', () => {
    const content = generateDocumentFromTemplate('unknown' as 'blank', 'Fallback')
    expect(content).toBe('# Fallback\n\n')
  })

  it('returns undefined for unknown template type lookup', () => {
    expect(getDocumentTemplate('unknown' as 'blank')).toBeUndefined()
  })
})

describe('document frontmatter', () => {
  it('parses frontmatter with inline arrays and quoted strings', () => {
    const markdown = `---
type: entity
title: "OpenAI"
tags: [ai, research, "deep learning"]
created: "2024-01-15"
sources: []
related: ["GPT-4", "Anthropic"]
---

# OpenAI`

    const fm = parseDocumentFrontmatter(markdown)
    expect(fm).not.toBeNull()
    if (!fm) throw new Error('Expected frontmatter to be parsed')
    expect(fm.type).toBe('entity')
    expect(fm.title).toBe('OpenAI')
    expect(fm.tags).toEqual(['ai', 'research', 'deep learning'])
    expect(fm.created).toBe('2024-01-15')
    expect(fm.sources).toEqual([])
    expect(fm.related).toEqual(['GPT-4', 'Anthropic'])
  })

  it('returns null when no frontmatter is present', () => {
    expect(parseDocumentFrontmatter('# Just a heading\n\nSome text')).toBeNull()
  })

  it('extracts body content after frontmatter', () => {
    const markdown = `---
title: "Test"
---

# Test

Body content here.`

    expect(getDocumentBody(markdown)).toBe('# Test\n\nBody content here.')
  })

  it('returns full content as body when no frontmatter exists', () => {
    const markdown = '# No frontmatter\n\nJust content.'
    expect(getDocumentBody(markdown)).toBe(markdown)
  })

  it('serializes frontmatter fields in canonical order', () => {
    const result = serializeDocumentFrontmatter({
      title: 'Test',
      type: 'concept',
      tags: ['ai', 'ml'],
      created: '2024-01-15',
      sources: [],
      custom: 'value',
    })

    expect(result).toContain('type: "concept"')
    expect(result).toContain('title: "Test"')
    expect(result).toContain('tags: ["ai", "ml"]')
    expect(result).toContain('created: "2024-01-15"')
    expect(result).toContain('sources: []')
    expect(result).toContain('custom: "value"')
    expect(result.startsWith('---')).toBe(true)
    expect(result.endsWith('---')).toBe(true)

    // type should come before title in canonical order
    const typeIndex = result.indexOf('type:')
    const titleIndex = result.indexOf('title:')
    expect(typeIndex).toBeLessThan(titleIndex)
  })

  it('updates existing frontmatter while preserving body', () => {
    const markdown = `---
type: entity
title: "Original"
tags: [old]
---

# Original

Some body.`

    const updated = updateDocumentFrontmatter(markdown, { title: 'Updated', tags: ['new', 'tags'] })

    expect(updated).toContain('title: "Updated"')
    expect(updated).toContain('tags: ["new", "tags"]')
    expect(updated).toContain('type: "entity"')
    expect(updated).toContain('# Original')
    expect(updated).toContain('Some body.')
  })

  it('inserts frontmatter in a document that has none', () => {
    const markdown = '# My Document\n\nContent here.'
    const updated = updateDocumentFrontmatter(markdown, { type: 'research', tags: ['new'] })

    expect(updated).toContain('---')
    expect(updated).toContain('type: "research"')
    expect(updated).toContain('tags: ["new"]')
    expect(updated).toContain('# My Document')
  })
})

describe('document statistics', () => {
  it('computes basic statistics for a markdown document', () => {
    const markdown = `---
type: concept
tags: [ai, ml]
---

# Machine Learning

## Overview

Machine learning is a subset of AI that focuses on building systems
that learn from data. It includes supervised, unsupervised, and
reinforcement learning approaches.

## Key Methods

- Neural Networks
- Decision Trees
- Support Vector Machines

![diagram](./ml-diagram.png)

\`\`\`python
model.fit(X_train, y_train)
\`\`\`

See [[Deep Learning]] and https://example.com/ml.`

    const stats = computeDocumentStatistics(markdown)

    expect(stats.hasFrontmatter).toBe(true)
    expect(stats.characterCount).toBe(markdown.length)
    expect(stats.wordCount).toBeGreaterThan(20)
    expect(stats.lineCount).toBeGreaterThan(10)
    expect(stats.readingTimeMinutes).toBeGreaterThanOrEqual(1)
    expect(stats.headingCount).toBeGreaterThanOrEqual(2)
    expect(stats.paragraphCount).toBeGreaterThanOrEqual(2)
    expect(stats.referenceCount).toBe(1) // [[Deep Learning]]
    expect(stats.externalLinkCount).toBe(1) // https://example.com/ml
    expect(stats.tagCount).toBe(2) // ai, ml
    expect(stats.imageCount).toBe(1)
    expect(stats.codeBlockCount).toBe(1)
  })

  it('handles documents without frontmatter', () => {
    const stats = computeDocumentStatistics('# Simple\n\nJust text.')
    expect(stats.hasFrontmatter).toBe(false)
    expect(stats.wordCount).toBeGreaterThan(0)
  })

  it('handles empty documents', () => {
    const stats = computeDocumentStatistics('')
    expect(stats.wordCount).toBe(0)
    expect(stats.characterCount).toBe(0)
    expect(stats.readingTimeMinutes).toBe(1) // minimum
  })

  it('computes group statistics with tag and type distributions', () => {
    const nodes: DocumentNode[] = [
      { id: 'folder', type: 'folder', title: 'Research', groupId: 'g', parentId: null, createdAt: 1, updatedAt: 1 },
      {
        id: 'a',
        type: 'document',
        title: 'Concepts',
        markdown: '---\ntype: concept\ntags: [ai, ml]\n---\n\n# Concepts\n\nContent about AI and machine learning concepts.',
        groupId: 'g',
        parentId: 'folder',
        createdAt: 1,
        updatedAt: 100,
      },
      {
        id: 'b',
        type: 'document',
        title: 'Entities',
        markdown: '---\ntype: entity\ntags: [ai, companies]\n---\n\n# Entities\n\nAbout companies in AI.',
        groupId: 'g',
        parentId: 'folder',
        createdAt: 1,
        updatedAt: 200,
      },
      {
        id: 'c',
        type: 'document',
        title: 'Notes',
        markdown: '# Quick notes\n\nNo frontmatter here.',
        groupId: 'g',
        parentId: null,
        createdAt: 1,
        updatedAt: 50,
      },
    ]

    const stats = computeDocumentGroupStatistics(nodes, 'g')

    expect(stats.documentCount).toBe(3)
    expect(stats.folderCount).toBe(1)
    expect(stats.totalWordCount).toBeGreaterThan(0)
    expect(stats.averageWordCount).toBeGreaterThan(0)
    expect(stats.tagDistribution['ai']).toBe(2)
    expect(stats.tagDistribution['ml']).toBe(1)
    expect(stats.tagDistribution['companies']).toBe(1)
    expect(stats.typeDistribution['concept']).toBe(1)
    expect(stats.typeDistribution['entity']).toBe(1)
    expect(stats.typeDistribution['untyped']).toBe(1)
    expect(stats.recentlyUpdated[0].id).toBe('b') // most recent
  })
})

describe('document versions', () => {
  it('creates a version snapshot with metadata', () => {
    vi.spyOn(Date, 'now').mockReturnValue(5000)
    const version = createDocumentVersion('doc-1', 'My Doc', '# Hello\n\nWorld content here.')

    expect(version.documentId).toBe('doc-1')
    expect(version.title).toBe('My Doc')
    expect(version.markdown).toContain('# Hello')
    expect(version.createdAt).toBe(5000)
    expect(version.characterCount).toBe('# Hello\n\nWorld content here.'.length)
    expect(version.wordCount).toBe(4) // Hello, World, content, here
    vi.restoreAllMocks()
  })

  it('creates labeled versions', () => {
    const version = createDocumentVersion('doc-1', 'Test', '# Content', 'Before major rewrite')
    expect(version.label).toBe('Before major rewrite')
  })

  it('adds versions and maintains max limit', () => {
    const versions = Array.from({ length: 50 }, (_, i) =>
      createDocumentVersion('doc-1', 'Test', `Version ${i}`),
    )

    const newVersion = createDocumentVersion('doc-1', 'Test', 'Version 50')
    const updated = addDocumentVersion(versions, newVersion)

    const docVersions = updated.filter((v) => v.documentId === 'doc-1')
    expect(docVersions.length).toBe(50) // Should not exceed MAX_VERSIONS_PER_DOCUMENT
    expect(docVersions[docVersions.length - 1]).toBe(newVersion)
  })

  it('does not affect versions from other documents', () => {
    const versions = [
      createDocumentVersion('doc-1', 'Doc 1', 'Content 1'),
      createDocumentVersion('doc-2', 'Doc 2', 'Content 2'),
    ]

    const newVersion = createDocumentVersion('doc-1', 'Doc 1', 'Updated Content 1')
    const updated = addDocumentVersion(versions, newVersion)

    expect(updated.filter((v) => v.documentId === 'doc-1').length).toBe(2)
    expect(updated.filter((v) => v.documentId === 'doc-2').length).toBe(1)
  })

  it('retrieves versions for a specific document sorted newest first', () => {
    vi.useFakeTimers()
    vi.setSystemTime(1000)
    const v1 = createDocumentVersion('doc-1', 'Test', 'V1')
    vi.setSystemTime(2000)
    const v2 = createDocumentVersion('doc-1', 'Test', 'V2')
    vi.setSystemTime(3000)
    const v3 = createDocumentVersion('doc-1', 'Test', 'V3')
    vi.useRealTimers()

    const all = [v1, v2, v3]
    const retrieved = getDocumentVersions(all, 'doc-1')

    expect(retrieved.length).toBe(3)
    expect(retrieved[0].createdAt).toBeGreaterThan(retrieved[1].createdAt)
    expect(retrieved[1].createdAt).toBeGreaterThan(retrieved[2].createdAt)
  })

  it('computes line-based diffs between versions', () => {
    const older = '# Title\n\nParagraph one.\n\nParagraph two.'
    const newer = '# Title\n\nParagraph one updated.\n\nParagraph two.\n\nParagraph three.'

    const diff = diffDocumentVersions(older, newer)

    expect(diff.added).toBeGreaterThan(0)
    expect(diff.removed).toBeGreaterThan(0)
    expect(diff.unchanged).toBeGreaterThan(0)
    expect(diff.addedLines).toContain('Paragraph one updated.')
    expect(diff.addedLines).toContain('Paragraph three.')
    expect(diff.removedLines).toContain('Paragraph one.')
  })

  it('detects when a version should be created', () => {
    const base = '# Hello\n\nSome content here.'

    // No previous version - always create
    expect(shouldCreateVersion(undefined, base)).toBe(true)

    // Same content - no version needed
    expect(shouldCreateVersion(base, base)).toBe(false)

    // Small change - not enough
    expect(shouldCreateVersion(base, base + '!')).toBe(false)

    // Large character change - create version
    const bigAddition = base + '\n\n' + 'x'.repeat(60)
    expect(shouldCreateVersion(base, bigAddition)).toBe(true)

    // Structural change (new heading) - create version
    const withHeading = base + '\n\n## New Section\n\nMore content\n\nEven more'
    expect(shouldCreateVersion(base, withHeading)).toBe(true)
  })
})

describe('document export', () => {
  const nodes: DocumentNode[] = [
    { id: 'folder', type: 'folder', title: 'Research', groupId: 'g', parentId: null, createdAt: 1, updatedAt: 1 },
    { id: 'subfolder', type: 'folder', title: 'AI', groupId: 'g', parentId: 'folder', createdAt: 1, updatedAt: 1 },
    {
      id: 'doc-a',
      type: 'document',
      title: 'Architecture',
      markdown: '---\ntitle: "Architecture"\n---\n\n# Architecture\n\nSystem design.',
      groupId: 'g',
      parentId: 'folder',
      createdAt: 1000,
      updatedAt: 2000,
    },
    {
      id: 'doc-b',
      type: 'document',
      title: 'LLM Notes',
      markdown: '# LLM Notes\n\nLarge language models.',
      groupId: 'g',
      parentId: 'subfolder',
      createdAt: 1500,
      updatedAt: 3000,
    },
    {
      id: 'doc-other',
      type: 'document',
      title: 'Other Group',
      markdown: '# Other\n\nNot in this group.',
      groupId: 'other',
      parentId: null,
      createdAt: 1,
      updatedAt: 1,
    },
  ]

  it('exports a document group as markdown files with structure', () => {
    const result = exportDocumentGroup(nodes, 'g', 'Research Wiki')

    expect(result.totalDocuments).toBe(2)
    expect(result.totalFolders).toBe(2)
    expect(result.totalCharacters).toBeGreaterThan(0)

    const paths = result.files.map((f) => f.path)
    expect(paths).toContain('Research/Architecture.md')
    expect(paths).toContain('Research/AI/LLM Notes.md')
    expect(paths).toContain('README.md')

    // Should NOT include documents from other groups
    expect(paths.every((p) => !p.includes('Other'))).toBe(true)
  })

  it('includes index README with links to all documents', () => {
    const result = exportDocumentGroup(nodes, 'g', 'My Wiki')
    const readme = result.files.find((f) => f.path === 'README.md')

    expect(readme).toBeDefined()
    if (!readme) throw new Error('Expected README export file to exist')
    expect(readme.content).toContain('# My Wiki')
    expect(readme.content).toContain('Architecture')
    expect(readme.content).toContain('LLM Notes')
  })

  it('preserves existing frontmatter without duplicating', () => {
    const result = exportDocumentGroup(nodes, 'g', 'Test')
    const archFile = result.files.find((f) => f.path.includes('Architecture'))

    expect(archFile).toBeDefined()
    if (!archFile) throw new Error('Expected Architecture export file to exist')
    // Should not have double frontmatter
    const frontmatterCount = (archFile.content.match(/^---$/gm) ?? []).length
    expect(frontmatterCount).toBe(2) // opening and closing
  })

  it('adds frontmatter to documents without it', () => {
    const result = exportDocumentGroup(nodes, 'g', 'Test', { includeFrontmatter: true })
    const llmFile = result.files.find((f) => f.path.includes('LLM Notes'))

    expect(llmFile).toBeDefined()
    if (!llmFile) throw new Error('Expected LLM Notes export file to exist')
    expect(llmFile.content).toContain('---')
    expect(llmFile.content).toContain('title: "LLM Notes"')
  })

  it('skips frontmatter when disabled', () => {
    const result = exportDocumentGroup(nodes, 'g', 'Test', { includeFrontmatter: false })
    const llmFile = result.files.find((f) => f.path.includes('LLM Notes'))

    expect(llmFile).toBeDefined()
    if (!llmFile) throw new Error('Expected LLM Notes export file to exist')
    expect(llmFile.content).not.toContain('---')
    expect(llmFile.content.startsWith('# LLM Notes')).toBe(true)
  })

  it('skips index when disabled', () => {
    const result = exportDocumentGroup(nodes, 'g', 'Test', { includeIndex: false })
    expect(result.files.find((f) => f.path === 'README.md')).toBeUndefined()
  })

  it('includes empty folders as .gitkeep when enabled', () => {
    exportDocumentGroup(nodes, 'g', 'Test', { includeEmptyFolders: true })
    // subfolder has doc-b, but let's add an actually empty folder
    const nodesWithEmpty: DocumentNode[] = [
      ...nodes,
      { id: 'empty-folder', type: 'folder', title: 'Empty', groupId: 'g', parentId: null, createdAt: 1, updatedAt: 1 },
    ]
    const resultWithEmpty = exportDocumentGroup(nodesWithEmpty, 'g', 'Test', { includeEmptyFolders: true })
    expect(resultWithEmpty.files.some((f) => f.path.includes('.gitkeep'))).toBe(true)
  })

  it('serializes export to a single string', () => {
    const result = exportDocumentGroup(nodes, 'g', 'Test')
    const serialized = serializeExportToString(result)

    expect(serialized).toContain('=== FILE:')
    expect(serialized).toContain('Architecture')
    expect(serialized).toContain('LLM Notes')
  })
})
