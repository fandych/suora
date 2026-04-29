import type { Skill } from '@/types'
import { serializeSkillToMarkdown } from '@/services/skillRegistry'
import { safePathSegment } from '@/utils/pathSegments'

type ElectronBridge = { invoke: (ch: string, ...args: unknown[]) => Promise<unknown> }

const encoder = new TextEncoder()

function getElectron(): ElectronBridge | undefined {
  return (window as unknown as { electron?: ElectronBridge }).electron
}

function normalizePath(pathValue: string): string {
  return pathValue.replace(/\\/g, '/').replace(/^\/+/, '').split('/').filter(Boolean).join('/')
}

function joinPath(root: string, relativePath: string): string {
  return `${root.replace(/[\\/]+$/, '')}/${normalizePath(relativePath)}`
}

function crc32(bytes: Uint8Array): number {
  let crc = 0xffffffff
  for (const byte of bytes) {
    crc ^= byte
    for (let i = 0; i < 8; i++) {
      // Reversed CRC-32 polynomial used by the ZIP file format.
      crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0)
    }
  }
  return (crc ^ 0xffffffff) >>> 0
}

function writeUint16(target: number[], value: number): void {
  target.push(value & 0xff, (value >>> 8) & 0xff)
}

function writeUint32(target: number[], value: number): void {
  target.push(value & 0xff, (value >>> 8) & 0xff, (value >>> 16) & 0xff, (value >>> 24) & 0xff)
}

function concatBytes(chunks: Uint8Array[]): Uint8Array {
  const length = chunks.reduce((sum, chunk) => sum + chunk.length, 0)
  const output = new Uint8Array(length)
  let offset = 0
  for (const chunk of chunks) {
    output.set(chunk, offset)
    offset += chunk.length
  }
  return output
}

export async function exportSkillToZipBlob(skill: Skill): Promise<Blob> {
  const files = await collectSkillArchiveFiles(skill)
  const localParts: Uint8Array[] = []
  const centralParts: Uint8Array[] = []
  let offset = 0

  for (const file of files) {
    const nameBytes = encoder.encode(file.path)
    const data = encoder.encode(file.content)
    const checksum = crc32(data)

    const localHeader: number[] = []
    writeUint32(localHeader, 0x04034b50)
    writeUint16(localHeader, 20)
    writeUint16(localHeader, 0)
    writeUint16(localHeader, 0)
    writeUint16(localHeader, 0)
    writeUint16(localHeader, 0)
    writeUint32(localHeader, checksum)
    writeUint32(localHeader, data.length)
    writeUint32(localHeader, data.length)
    writeUint16(localHeader, nameBytes.length)
    writeUint16(localHeader, 0)

    const localRecord = concatBytes([new Uint8Array(localHeader), nameBytes, data])
    localParts.push(localRecord)

    const centralHeader: number[] = []
    writeUint32(centralHeader, 0x02014b50)
    writeUint16(centralHeader, 20)
    writeUint16(centralHeader, 20)
    writeUint16(centralHeader, 0)
    writeUint16(centralHeader, 0)
    writeUint16(centralHeader, 0)
    writeUint16(centralHeader, 0)
    writeUint32(centralHeader, checksum)
    writeUint32(centralHeader, data.length)
    writeUint32(centralHeader, data.length)
    writeUint16(centralHeader, nameBytes.length)
    writeUint16(centralHeader, 0)
    writeUint16(centralHeader, 0)
    writeUint16(centralHeader, 0)
    writeUint16(centralHeader, 0)
    writeUint32(centralHeader, 0)
    writeUint32(centralHeader, offset)
    centralParts.push(concatBytes([new Uint8Array(centralHeader), nameBytes]))

    offset += localRecord.length
  }

  const centralDirectory = concatBytes(centralParts)
  const end: number[] = []
  writeUint32(end, 0x06054b50)
  writeUint16(end, 0)
  writeUint16(end, 0)
  writeUint16(end, files.length)
  writeUint16(end, files.length)
  writeUint32(end, centralDirectory.length)
  writeUint32(end, offset)
  writeUint16(end, 0)

  const zipBytes = concatBytes([...localParts, centralDirectory, new Uint8Array(end)])
  const zipBuffer = zipBytes.buffer.slice(zipBytes.byteOffset, zipBytes.byteOffset + zipBytes.byteLength) as ArrayBuffer
  return new Blob([zipBuffer], { type: 'application/zip' })
}

export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

async function collectSkillArchiveFiles(skill: Skill): Promise<Array<{ path: string; content: string }>> {
  const files = new Map<string, string>()
  files.set('SKILL.md', serializeSkillToMarkdown(skill))

  const electron = getElectron()
  if (electron && skill.skillRoot) {
    for (const resource of skill.bundledResources ?? []) {
      if (resource.type !== 'file') continue
      const relativePath = normalizePath(resource.path)
      if (!relativePath || relativePath.toLowerCase() === 'skill.md') continue
      const content = await electron.invoke('fs:readFile', joinPath(skill.skillRoot, relativePath)) as string | { error?: string }
      if (typeof content === 'string') {
        files.set(relativePath, content)
      }
    }
  }

  return Array.from(files.entries()).map(([path, content]) => ({ path, content }))
}

export async function buildSkillFromFolderFiles(files: FileList): Promise<{
  skillMarkdown: string
  resources: Array<{ path: string; content: string; size: number }>
} | null> {
  const entries = Array.from(files)
    .map((file) => ({
      file,
      path: normalizePath((file as File & { webkitRelativePath?: string }).webkitRelativePath || file.name),
    }))
    .filter((entry) => entry.path)

  const rootPrefix = findCommonSkillPrefix(entries.map((entry) => entry.path))
  const normalized = entries.map((entry) => ({
    file: entry.file,
    path: normalizePath(entry.path.slice(rootPrefix.length)),
  }))

  const skillFile = normalized.find((entry) => entry.path.toLowerCase() === 'skill.md')
  if (!skillFile) return null

  const resources = await Promise.all(normalized.map(async (entry) => ({
    path: entry.path,
    content: await entry.file.text(),
    size: entry.file.size,
  })))

  return {
    skillMarkdown: resources.find((resource) => resource.path.toLowerCase() === 'skill.md')?.content ?? '',
    resources: resources.filter((resource) => resource.path.toLowerCase() !== 'skill.md' && resource.path),
  }
}

export function skillArchiveName(skill: Skill): string {
  return `${safePathSegment(skill.name.toLowerCase().replace(/[^a-z0-9._-]+/g, '-'), 'skill')}.zip`
}

function findCommonSkillPrefix(paths: string[]): string {
  const skillPath = paths.find((path) => path.toLowerCase().endsWith('/skill.md'))
  if (!skillPath) return ''
  const index = skillPath.toLowerCase().lastIndexOf('skill.md')
  return skillPath.slice(0, index)
}
