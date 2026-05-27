import fs from 'fs/promises'
import os from 'os'
import path from 'path'
import { afterEach, describe, expect, it } from 'vitest'
import { acquireWorkspaceLock, releaseWorkspaceLock, WorkspaceLockError } from './workspaceLock'

const tempRoots: string[] = []

async function makeTempWorkspace(): Promise<string> {
  const workspace = await fs.mkdtemp(path.join(os.tmpdir(), 'suora-workspace-lock-'))
  tempRoots.push(workspace)
  return workspace
}

afterEach(async () => {
  await Promise.all(tempRoots.splice(0).map((root) => fs.rm(root, { recursive: true, force: true })))
})

describe('workspaceLock', () => {
  it('blocks a second process when the workspace lock owner is still alive', async () => {
    const workspace = await makeTempWorkspace()
    await acquireWorkspaceLock(workspace, {
      pid: 1001,
      token: 'active-owner',
      isProcessAlive: () => false,
    })

    await expect(acquireWorkspaceLock(workspace, {
      pid: 1002,
      isProcessAlive: (pid) => pid === 1001,
    })).rejects.toBeInstanceOf(WorkspaceLockError)
  })

  it('replaces a stale workspace lock', async () => {
    const workspace = await makeTempWorkspace()
    const stale = await acquireWorkspaceLock(workspace, {
      pid: 2001,
      token: 'stale-owner',
      isProcessAlive: () => false,
    })

    const next = await acquireWorkspaceLock(workspace, {
      pid: 2002,
      token: 'new-owner',
      isProcessAlive: () => false,
    })

    expect(next.lockPath).toBe(stale.lockPath)
    expect(next.info.pid).toBe(2002)
    await releaseWorkspaceLock(next)
  })

  it('does not remove a lock owned by another token', async () => {
    const workspace = await makeTempWorkspace()
    const owner = await acquireWorkspaceLock(workspace, {
      pid: 3001,
      token: 'owner-token',
      isProcessAlive: () => false,
    })

    await releaseWorkspaceLock({
      ...owner,
      info: { ...owner.info, token: 'other-token' },
    })

    await expect(fs.readFile(owner.lockPath, 'utf-8')).resolves.toContain('owner-token')
    await releaseWorkspaceLock(owner)
    await expect(fs.stat(owner.lockPath)).rejects.toMatchObject({ code: 'ENOENT' })
  })
})