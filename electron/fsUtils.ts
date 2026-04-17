import crypto from 'crypto'
import path from 'path'
import fs from 'fs/promises'
import { createReadStream, existsSync, realpathSync } from 'fs'
import readline from 'readline'

export const MAX_IPC_TEXT_FILE_BYTES = 1024 * 1024 * 2

function isErrnoException(error: unknown): error is NodeJS.ErrnoException {
  return error instanceof Error && 'code' in error
}

export function resolveUserPath(targetPath: string, homePath: string): string {
  const trimmed = targetPath.trim()
  if (trimmed === '~') return homePath
  if (trimmed.startsWith('~/') || trimmed.startsWith('~\\')) {
    return path.resolve(path.join(homePath, trimmed.slice(2)))
  }
  return path.resolve(trimmed)
}

function findExistingParentSync(resolvedPath: string): { existingPath: string; missingSegments: string[] } | null {
  const missingSegments: string[] = []
  let currentPath = resolvedPath

  while (!existsSync(currentPath)) {
    const parentPath = path.dirname(currentPath)
    if (parentPath === currentPath) {
      return null
    }

    missingSegments.unshift(path.basename(currentPath))
    currentPath = parentPath
  }

  return { existingPath: currentPath, missingSegments }
}

export function canonicalizePathSync(targetPath: string): string {
  const resolvedPath = path.resolve(targetPath)

  try {
    return realpathSync(resolvedPath)
  } catch (error) {
    if (!isErrnoException(error) || error.code !== 'ENOENT') {
      return resolvedPath
    }

    const parentMatch = findExistingParentSync(resolvedPath)
    if (!parentMatch) {
      return resolvedPath
    }

    const canonicalParent = canonicalizePathSync(parentMatch.existingPath)
    return parentMatch.missingSegments.reduce((currentPath, segment) => path.resolve(currentPath, segment), canonicalParent)
  }
}

export function isWithinRoot(candidatePath: string, rootPath: string): boolean {
  const normalizedCandidate = path.resolve(candidatePath)
  const normalizedRoot = path.resolve(rootPath)
  const relativePath = path.relative(normalizedRoot, normalizedCandidate)

  return relativePath === '' || (!relativePath.startsWith('..') && !path.isAbsolute(relativePath))
}

export async function atomicWriteFile(filePath: string, content: string): Promise<void> {
  await fs.mkdir(path.dirname(filePath), { recursive: true })

  const tempPath = `${filePath}.${crypto.randomUUID()}.tmp`
  await fs.writeFile(tempPath, content, 'utf-8')

  try {
    await fs.rename(tempPath, filePath)
  } catch (error) {
    if (!isErrnoException(error) || !['EBUSY', 'EPERM', 'EEXIST'].includes(error.code ?? '')) {
      await fs.unlink(tempPath).catch(() => {})
      throw error
    }

    await fs.writeFile(filePath, content, 'utf-8')
    await fs.unlink(tempPath).catch(() => {})
  }
}

export async function readTextFileWithLimit(filePath: string, maxBytes = MAX_IPC_TEXT_FILE_BYTES): Promise<string> {
  const fileStat = await fs.stat(filePath)
  if (fileStat.size > maxBytes) {
    throw new Error(`File is too large to read at once (${fileStat.size} bytes). Use readFileRange instead.`)
  }

  return fs.readFile(filePath, 'utf-8')
}

export async function readTextFileRange(
  filePath: string,
  startLine = 1,
  endLine = Number.POSITIVE_INFINITY,
): Promise<string> {
  const safeStartLine = Math.max(1, startLine)
  const safeEndLine = Number.isFinite(endLine) ? Math.max(safeStartLine, endLine) : Number.POSITIVE_INFINITY
  const stream = createReadStream(filePath, { encoding: 'utf-8' })
  const lineReader = readline.createInterface({
    input: stream,
    crlfDelay: Infinity,
  })

  const selectedLines: string[] = []
  let lineNumber = 0

  try {
    for await (const line of lineReader) {
      lineNumber++

      if (lineNumber < safeStartLine) {
        continue
      }

      if (lineNumber > safeEndLine) {
        break
      }

      selectedLines.push(`${lineNumber}. ${line}`)
    }
  } finally {
    lineReader.close()
    stream.destroy()
  }

  return selectedLines.join('\n')
}