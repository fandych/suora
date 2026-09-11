import { describe, expect, it, vi } from "vitest"

vi.mock("@electron/database/drizzle/integration-repository", () => ({
  assertIntegrationEnabledWithDrizzle: vi.fn(async (id: string) => {
    if (id === "missing") throw new Error("Integration not found")
    if (id === "disabled") throw new Error("Integration is disabled")
  }),
}))

import { assertIntegrationEnabled } from "@electron/ipc/domain/integration-ipc-policy"

describe("integration IPC policy", () => {
  it("requires an existing enabled integration", async () => {
    await expect(assertIntegrationEnabled("missing")).rejects.toThrow("Integration not found")
    await expect(assertIntegrationEnabled("disabled")).rejects.toThrow("Integration is disabled")
    await expect(assertIntegrationEnabled("enabled")).resolves.toBeUndefined()
  })
})
