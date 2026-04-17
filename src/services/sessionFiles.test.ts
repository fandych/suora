import { beforeEach, describe, expect, it, vi } from 'vitest'
import { deleteSessionFromDisk } from './sessionFiles'

describe('sessionFiles', () => {
  beforeEach(() => {
    vi.mocked(window.electron.invoke).mockReset()
  })

  it('deletes session directories via fs:deleteDir', async () => {
    vi.mocked(window.electron.invoke).mockResolvedValue({ success: true })

    const result = await deleteSessionFromDisk('/workspace', 'session-1')

    expect(result).toBe(true)
    expect(window.electron.invoke).toHaveBeenCalledTimes(1)
    expect(window.electron.invoke).toHaveBeenCalledWith('fs:deleteDir', '/workspace/sessions/session-1')
  })
})