// @vitest-environment node

import os from 'os'
import path from 'path'
import fs from 'fs/promises'
import { afterEach, describe, expect, it } from 'vitest'
import {
  atomicWriteFile,
  canonicalizePathSync,
  isWithinRoot,
  readTextFileRange,
  readTextFileWithLimit,
  resolveUserPath,
} from './fsUtils'

const tempDirectories: string[] = []

async function createTempDirectory(): Promise<string> {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'suora-fs-'))
  tempDirectories.push(directory)
  return directory
}

afterEach(async () => {
  await Promise.all(tempDirectories.splice(0).map((directory) => fs.rm(directory, { recursive: true, force: true })))
})

describe('fsUtils', () => {
  it('expands tilde-prefixed user paths', () => {
    expect(resolveUserPath('~/workspace', '/home/tester')).toBe(path.resolve('/home/tester/workspace'))
    expect(resolveUserPath('~', '/home/tester')).toBe('/home/tester')
  })

  it('rejects sibling paths that merely share a prefix', async () => {
    const tempDirectory = await createTempDirectory()
    const workspaceRoot = path.join(tempDirectory, 'workspace')
    const siblingRoot = path.join(tempDirectory, 'workspace-copy')
    await fs.mkdir(workspaceRoot, { recursive: true })
    await fs.mkdir(siblingRoot, { recursive: true })

    expect(isWithinRoot(siblingRoot, workspaceRoot)).toBe(false)
  })

  it('canonicalizes symlinked paths before root checks', async () => {
    const tempDirectory = await createTempDirectory()
    const workspaceRoot = path.join(tempDirectory, 'workspace')
    const externalRoot = path.join(tempDirectory, 'external')
    const linkedRoot = path.join(workspaceRoot, 'linked-external')

    await fs.mkdir(path.join(externalRoot, 'nested'), { recursive: true })
    await fs.mkdir(workspaceRoot, { recursive: true })

    try {
      await fs.symlink(externalRoot, linkedRoot, process.platform === 'win32' ? 'junction' : 'dir')
    } catch {
      return
    }

    const candidatePath = canonicalizePathSync(path.join(linkedRoot, 'nested', 'note.txt'))
    const canonicalWorkspaceRoot = canonicalizePathSync(workspaceRoot)

    expect(candidatePath.startsWith(canonicalizePathSync(externalRoot))).toBe(true)
    expect(isWithinRoot(candidatePath, canonicalWorkspaceRoot)).toBe(false)
  })

  it('writes files atomically without leaving temp files behind', async () => {
    const tempDirectory = await createTempDirectory()
    const filePath = path.join(tempDirectory, 'config.json')

    await atomicWriteFile(filePath, '{"ok":true}')
    await atomicWriteFile(filePath, '{"ok":false}')

    expect(await fs.readFile(filePath, 'utf-8')).toBe('{"ok":false}')

    const entries = await fs.readdir(tempDirectory)
    expect(entries.filter((entry) => entry.endsWith('.tmp'))).toHaveLength(0)
  })

  it('guards large text reads with a byte limit', async () => {
    const tempDirectory = await createTempDirectory()
    const filePath = path.join(tempDirectory, 'large.txt')
    await fs.writeFile(filePath, 'x'.repeat(32), 'utf-8')

    await expect(readTextFileWithLimit(filePath, 16)).rejects.toThrow(/too large/i)
  })

  it('reads only the requested line range with line numbers', async () => {
    const tempDirectory = await createTempDirectory()
    const filePath = path.join(tempDirectory, 'notes.txt')
    await fs.writeFile(filePath, ['one', 'two', 'three', 'four'].join('\n'), 'utf-8')

    await expect(readTextFileRange(filePath, 2, 3)).resolves.toBe('2. two\n3. three')
  })
})