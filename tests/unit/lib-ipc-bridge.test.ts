import { afterEach, describe, expect, it } from "vitest"

import { getProjectBridge, hasProjectBridge } from "@/lib/ipc/bridge"

describe("project IPC bridge", () => {
  afterEach(() => {
    delete window.project
  })

  it("detects and returns the project bridge", () => {
    expect(hasProjectBridge()).toBe(false)
    const bridge = { catalog: { list: async () => [] } } as never
    window.project = bridge
    expect(hasProjectBridge()).toBe(true)
    expect(getProjectBridge()).toBe(bridge)
  })

  it("throws when the bridge is unavailable", () => {
    expect(() => getProjectBridge()).toThrow(/not available/)
  })
})
