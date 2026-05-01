// @vitest-environment node

import { beforeEach, describe, expect, it, vi } from 'vitest'

const exposeInMainWorld = vi.fn()
const ipcInvoke = vi.fn()

vi.mock('electron', () => ({
  contextBridge: { exposeInMainWorld },
  ipcRenderer: {
    invoke: ipcInvoke,
    on: vi.fn(),
    off: vi.fn(),
    send: vi.fn(),
  },
}))

describe('preload IPC allowlist', () => {
  beforeEach(() => {
    exposeInMainWorld.mockClear()
    ipcInvoke.mockClear()
  })

  it('allows the JSON fetch channel used by skill marketplace registry requests', async () => {
    const { allowedInvokeChannels } = await import('./preload')

    expect(allowedInvokeChannels).toContain('web:fetchJson')
    expect(allowedInvokeChannels).toContain('ai:fetch:start')
    expect(allowedInvokeChannels).toContain('ai:fetch:abort')
  })
})
