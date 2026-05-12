import { createDocumentId, isSupportedTextDocumentTitle } from '@/services/documents'
import type { DocumentFolder, DocumentItem, DocumentNode } from '@/types'

export interface ImportedDocumentFile {
  path: string
  content: string
  size: number
}

export interface DocumentImportBundle {
  files: ImportedDocumentFile[]
  skippedPaths: string[]
}

type ImportedDocumentCandidate =
  | ImportedDocumentFile
  | {
      path: string
      skipped: true
    }

export interface DocumentImportNodesResult {
  nodes: DocumentNode[]
  documentCount: number
  folderCount: number
  createdFolderIds: string[]
  firstDocument: DocumentItem | null
}

function normalizePath(pathValue: string): string {
  return pathValue.replace(/\\/g, '/').replace(/^\/+/, '').split('/').filter(Boolean).join('/')
}

function isKnownTextMimeType(type: string): boolean {
  const normalized = type.trim().toLowerCase()
  return normalized.startsWith('text/')
    || normalized === 'application/json'
    || normalized.endsWith('+json')
    || normalized === 'application/xml'
    || normalized.endsWith('+xml')
}

async function readImportedFile(file: File, rawPath: string): Promise<ImportedDocumentCandidate | null> {
  const path = normalizePath(rawPath)
  if (!path) return null
  if (!isSupportedTextDocumentTitle(path) && !isKnownTextMimeType(file.type)) {
    return { path, skipped: true }
  }

  return {
    path,
    content: await file.text(),
    size: file.size,
  }
}

function splitImportedCandidates(candidates: ImportedDocumentCandidate[]): DocumentImportBundle | null {
  const files = candidates.filter((candidate): candidate is ImportedDocumentFile => 'content' in candidate)
  const skippedPaths = candidates
    .filter((candidate): candidate is Extract<ImportedDocumentCandidate, { skipped: true }> => 'skipped' in candidate)
    .map((candidate) => candidate.path)

  if (!files.length && !skippedPaths.length) return null
  return { files, skippedPaths }
}

export async function buildDocumentImportFromFolderFiles(files: FileList): Promise<DocumentImportBundle | null> {
  const candidates = (await Promise.all(Array.from(files).map((file) => readImportedFile(
    file,
    (file as File & { webkitRelativePath?: string }).webkitRelativePath || file.name,
  )))).filter((candidate): candidate is ImportedDocumentCandidate => Boolean(candidate))

  return splitImportedCandidates(candidates)
}

export async function buildDocumentImportFromDataTransferItems(items: DataTransferItemList): Promise<DocumentImportBundle | null> {
  const entries = Array.from(items)
    .map((item) => item.webkitGetAsEntry?.())
    .filter((entry): entry is FileSystemEntry => Boolean(entry))
  if (!entries.length) return null

  const candidates = (await Promise.all(entries.map((entry) => readDroppedEntry(entry, '')))).flat()
  return splitImportedCandidates(candidates)
}

async function readDroppedEntry(entry: FileSystemEntry, basePath: string): Promise<ImportedDocumentCandidate[]> {
  if (entry.isFile) {
    const file = await readDroppedFile(entry as FileSystemFileEntry)
    const candidate = await readImportedFile(file, `${basePath}/${file.name}`)
    return candidate ? [candidate] : []
  }

  if (!entry.isDirectory) return []
  const directory = entry as FileSystemDirectoryEntry
  const children = await readAllDirectoryEntries(directory.createReader())
  const nextBase = normalizePath(`${basePath}/${entry.name}`)
  return (await Promise.all(children.map((child) => readDroppedEntry(child, nextBase)))).flat()
}

function readDroppedFile(entry: FileSystemFileEntry): Promise<File> {
  return new Promise((resolve, reject) => {
    entry.file(resolve, reject)
  })
}

function readAllDirectoryEntries(reader: FileSystemDirectoryReader): Promise<FileSystemEntry[]> {
  const allEntries: FileSystemEntry[] = []
  return new Promise((resolve, reject) => {
    const readBatch = () => {
      reader.readEntries((entries) => {
        if (entries.length === 0) {
          resolve(allEntries)
          return
        }
        allEntries.push(...entries)
        readBatch()
      }, reject)
    }
    readBatch()
  })
}

export function createDocumentNodesFromImport(
  files: ImportedDocumentFile[],
  options: { groupId: string; parentId: string | null; createdAt?: number },
): DocumentImportNodesResult {
  const createdAt = options.createdAt ?? Date.now()
  const nodes: DocumentNode[] = []
  const folderIdByPath = new Map<string, string>()
  const createdFolderIds: string[] = []
  let firstDocument: DocumentItem | null = null

  const normalizedFiles = files
    .map((file) => ({ ...file, path: normalizePath(file.path) }))
    .filter((file) => file.path)
    .sort((a, b) => a.path.localeCompare(b.path))

  for (const file of normalizedFiles) {
    const segments = file.path.split('/').filter(Boolean)
    const title = segments.at(-1)
    if (!title) continue

    let parentId = options.parentId
    let folderPath = ''

    for (const folderName of segments.slice(0, -1)) {
      folderPath = folderPath ? `${folderPath}/${folderName}` : folderName
      let folderId = folderIdByPath.get(folderPath)
      if (!folderId) {
        folderId = createDocumentId('doc-folder')
        folderIdByPath.set(folderPath, folderId)
        const folder: DocumentFolder = {
          id: folderId,
          groupId: options.groupId,
          parentId,
          type: 'folder',
          title: folderName,
          createdAt,
          updatedAt: createdAt,
        }
        createdFolderIds.push(folderId)
        nodes.push(folder)
      }
      parentId = folderId
    }

    const document: DocumentItem = {
      id: createDocumentId('doc'),
      groupId: options.groupId,
      parentId,
      type: 'document',
      title,
      markdown: file.content,
      createdAt,
      updatedAt: createdAt,
    }

    if (!firstDocument) firstDocument = document
    nodes.push(document)
  }

  return {
    nodes,
    documentCount: nodes.filter((node) => node.type === 'document').length,
    folderCount: createdFolderIds.length,
    createdFolderIds,
    firstDocument,
  }
}
