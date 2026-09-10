import { describe, expect, it, vi } from "vitest"

import { assertIntegrationEnabled } from "@electron/ipc/domain/integration-ipc-policy"

describe("integration IPC policy", () => {
  const database = {
    prepare: vi.fn(() => ({
      get: vi.fn((id: string) => id === "enabled" ? { enabled: 1 } : id === "disabled" ? { enabled: 0 } : undefined),
    })),
  } as never

  it("requires an existing enabled integration", () => {
    expect(() => assertIntegrationEnabled(database, "missing")).toThrow("Integration not found")
    expect(() => assertIntegrationEnabled(database, "disabled")).toThrow("Integration is disabled")
    expect(assertIntegrationEnabled(database, "enabled")).toBeUndefined()
  })
  
    it("keeps the policy scoped to persisted integration IDs", () => {
      expect(() => assertIntegrationEnabled(database, "enabled")).not.toThrow()
    })
})
