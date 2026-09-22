// @vitest-environment node

import { describe, expect, it, vi } from "vitest"

vi.mock("electron", () => ({ app: { isPackaged: false } }))

import { createSqliteTestDatabase } from "@/../tests/helpers/sqlite-test-database"
import { agents } from "@/drizzle/schema"

describe("Drizzle transaction integration", () => {
  it("rolls back a failed transaction", async () => {
    const testDatabase = createSqliteTestDatabase()
    try {
      await expect(
        testDatabase.db.transaction(async (tx) => {
          await tx
            .insert(agents)
            .values({ id: "rollback-agent", title: "Rollback", kind: "custom", summary: "", updatedAt: 1 })
          throw new Error("rollback")
        }),
      ).rejects.toThrow("rollback")
      expect(await testDatabase.db.select().from(agents)).toHaveLength(0)
    } finally {
      testDatabase.close()
    }
  })
})
