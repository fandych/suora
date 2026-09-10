import { describe, expect, it, vi } from "vitest"

import { createAiProxyFetch } from "@/services/ai/network-client"

describe("AI network client", () => {
  it("returns no proxy fetch without an Electron bridge", () => {
    delete window.electron
    expect(createAiProxyFetch({ requestTimeoutMs: 1000 })).toBeUndefined()
  })

  it("creates a proxy fetch with a complete bridge", () => {
    window.electron = {
      invoke: vi.fn(),
      on: vi.fn(),
      off: vi.fn(),
    }
    expect(createAiProxyFetch({ requestTimeoutMs: 1000 })).toEqual(expect.any(Function))
    delete window.electron
  })
})
