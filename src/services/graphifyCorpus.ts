import type { DocumentGroup, DocumentItem, DocumentNode } from '@/types'
import { getDocumentDisplayName } from '@/services/documents'
import { buildDocumentGraph, buildDocumentPath, extractDocumentTags } from '@/services/documentGraph'
import { toGraphifyExport } from '@/services/graphifyAdapter'

export interface GraphifyCorpusFile {
  path: string
  content: string
}

export interface GraphifyCorpusBundle {
  rootDir: string
  generatedAt: string
  documentCount: number
  files: GraphifyCorpusFile[]
}

export interface GraphifyCorpusExportSuccess {
  success: true
  rootDir: string
  documentCount: number
  fileCount: number
}

export interface GraphifyCorpusExportFailure {
  success: false
  error: string
}

function getElectronBridge() {
  return (window as unknown as { electron?: { invoke: (channel: string, ...args: unknown[]) => Promise<unknown> } }).electron
}

function safeCorpusSegment(value: string, fallback: string): string {
  const sanitized = value
    .trim()
    .normalize('NFKC')
    .replace(/[/\\]+/g, '-')
    .replace(/\.{2,}/g, '-')
    .replace(/[<>:"|?*\u0000-\u001F]+/g, '-')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-+|-+$/g, '')

  if (!sanitized || sanitized === '.' || sanitized === '..') return fallback
  return sanitized.slice(0, 120)
}

function getParentDirectory(filePath: string): string {
  const normalized = filePath.replace(/\\/g, '/')
  const idx = normalized.lastIndexOf('/')
  return idx <= 0 ? normalized : normalized.slice(0, idx)
}

function collectAncestorFolders(doc: DocumentItem, nodeById: Map<string, DocumentNode>): DocumentNode[] {
  const ancestors: DocumentNode[] = []
  let currentParentId = doc.parentId

  while (currentParentId) {
    const parent = nodeById.get(currentParentId)
    if (!parent || parent.type !== 'folder') break
    ancestors.unshift(parent)
    currentParentId = parent.parentId
  }

  return ancestors
}

function getDocumentFileName(doc: DocumentItem): string {
  const displayName = getDocumentDisplayName(doc.title)
  const dotIndex = displayName.lastIndexOf('.')
  if (dotIndex <= 0) {
    return `${safeCorpusSegment(displayName, `doc-${doc.id}`)}.md`
  }

  const basename = displayName.slice(0, dotIndex)
  const extension = displayName.slice(dotIndex)
  return `${safeCorpusSegment(basename, `doc-${doc.id}`)}${extension}`
}

function ensureUniqueRelativePath(relativePath: string, docId: string, usedPaths: Set<string>): string {
  const normalized = relativePath.replace(/\\/g, '/')
  if (!usedPaths.has(normalized)) {
    usedPaths.add(normalized)
    return normalized
  }

  const slashIndex = normalized.lastIndexOf('/')
  const directory = slashIndex >= 0 ? normalized.slice(0, slashIndex) : ''
  const fileName = slashIndex >= 0 ? normalized.slice(slashIndex + 1) : normalized
  const dotIndex = fileName.lastIndexOf('.')
  const basename = dotIndex > 0 ? fileName.slice(0, dotIndex) : fileName
  const extension = dotIndex > 0 ? fileName.slice(dotIndex) : ''
  const deduped = `${directory ? `${directory}/` : ''}${basename}-${docId}${extension}`
  usedPaths.add(deduped)
  return deduped
}

function buildDocumentRelativePath(doc: DocumentItem, nodeById: Map<string, DocumentNode>, usedPaths: Set<string>): string {
  const folders = collectAncestorFolders(doc, nodeById).map((folder) => safeCorpusSegment(folder.title, `folder-${folder.id}`))
  const fileName = getDocumentFileName(doc)
  return ensureUniqueRelativePath(['docs', ...folders, fileName].join('/'), doc.id, usedPaths)
}

function buildExportReadme(group: DocumentGroup, rootDir: string, documentCount: number): string {
  return [
    '# Suora Graphify Corpus Export',
    '',
    `This folder is a lightweight export of the Suora document group "${group.name}".`,
    '',
    `- Export root: ${rootDir}`,
    `- Documents exported: ${documentCount}`,
    '- docs/ contains the source notes and text files',
    '- manifest.json maps Suora document metadata, paths, and graph relationships',
    '- suora-graph-preview.json contains Suora\'s built-in document graph snapshot',
    '',
    'To use the full Graphify workflow later:',
    '1. Install the external Python package graphifyy on your own machine.',
    '2. Run the Graphify CLI against this export folder as the corpus root.',
    '3. If Graphify generates graphify-out/graph.json, you can expose it through Graphify\'s MCP server and connect it to Suora manually.',
  ].join('\n')
}

export function buildGraphifyCorpusBundle(
  workspacePath: string,
  group: DocumentGroup,
  nodes: DocumentNode[],
  generatedAt = new Date().toISOString(),
): GraphifyCorpusBundle {
  const scopedNodes = nodes.filter((node) => node.groupId === group.id)
  const documents = scopedNodes.filter((node): node is DocumentItem => node.type === 'document')
  const graph = buildDocumentGraph([group], scopedNodes, { groupId: group.id })
  const nodeById = new Map(scopedNodes.map((node) => [node.id, node]))
  const usedRelativePaths = new Set<string>()
  const rootDir = `${workspacePath.replace(/\\/g, '/')}/.suora/exports/graphify/${safeCorpusSegment(group.name, 'group')}-${safeCorpusSegment(group.id, 'group')}`

  const manifestDocuments = documents
    .map((doc) => {
      const relativePath = buildDocumentRelativePath(doc, nodeById, usedRelativePaths)
      return {
        id: doc.id,
        title: doc.title,
        relativePath,
        path: buildDocumentPath(doc, scopedNodes, nodeById),
        updatedAt: doc.updatedAt,
        tags: extractDocumentTags(doc.markdown),
        references: graph.referencesByDocumentId[doc.id] ?? [],
        backlinks: graph.backlinksByDocumentId[doc.id] ?? [],
        markdown: doc.markdown,
      }
    })
    .sort((a, b) => a.relativePath.localeCompare(b.relativePath))

  const manifest = {
    schema: 'suora-graphify-corpus',
    generatedAt,
    group: {
      id: group.id,
      name: group.name,
      color: group.color,
    },
    stats: {
      documentCount: manifestDocuments.length,
      graphNodeCount: graph.nodes.length,
      graphEdgeCount: graph.edges.length,
      orphanCount: graph.orphanDocumentIds.length,
      tagCount: graph.tags.length,
    },
    documents: manifestDocuments.map(({ markdown: _markdown, ...doc }) => doc),
  }

  const files: GraphifyCorpusFile[] = [
    {
      path: `${rootDir}/README.md`,
      content: buildExportReadme(group, rootDir, manifestDocuments.length),
    },
    {
      path: `${rootDir}/manifest.json`,
      content: JSON.stringify(manifest, null, 2),
    },
    {
      path: `${rootDir}/suora-graph-preview.json`,
      content: JSON.stringify(toGraphifyExport(graph, generatedAt), null, 2),
    },
    ...manifestDocuments.map((doc) => ({
      path: `${rootDir}/${doc.relativePath}`,
      content: doc.markdown,
    })),
  ]

  return {
    rootDir,
    generatedAt,
    documentCount: manifestDocuments.length,
    files,
  }
}

export async function exportDocumentGroupToGraphifyCorpus(
  workspacePath: string,
  group: DocumentGroup,
  nodes: DocumentNode[],
): Promise<GraphifyCorpusExportSuccess | GraphifyCorpusExportFailure> {
  const electron = getElectronBridge()
  if (!electron?.invoke) return { success: false, error: 'Electron file export is only available in the desktop app.' }
  if (!workspacePath.trim()) return { success: false, error: 'Set a workspace path before exporting a corpus.' }

  try {
    const bundle = buildGraphifyCorpusBundle(workspacePath, group, nodes)
    const directories = Array.from(new Set(bundle.files.map((file) => getParentDirectory(file.path)).concat(bundle.rootDir)))
      .sort((a, b) => a.length - b.length)

    for (const directory of directories) {
      const ensureResult = await electron.invoke('system:ensureDirectory', directory) as { success?: boolean; error?: string }
      if (!ensureResult?.success) {
        return { success: false, error: ensureResult?.error || `Failed to create export directory: ${directory}` }
      }
    }

    for (const file of bundle.files) {
      const writeResult = await electron.invoke('fs:writeFile', file.path, file.content) as { success?: boolean; error?: string }
      if (!writeResult?.success) {
        return { success: false, error: writeResult?.error || `Failed to write export file: ${file.path}` }
      }
    }

    return {
      success: true,
      rootDir: bundle.rootDir,
      documentCount: bundle.documentCount,
      fileCount: bundle.files.length,
    }
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : String(error) }
  }
}