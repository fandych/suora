import { describe, expect, it, vi } from "vitest"

vi.mock("electron", () => ({ app: { isPackaged: false } }))

import { createSqliteTestDatabase } from "@/../tests/helpers/sqlite-test-database"
import { agents } from "@electron/database/drizzle/schema"

describe("Drizzle SQLite integration", () => {
  it("creates a real in-memory schema and persists rows", async () => {
    const testDatabase = createSqliteTestDatabase()
    try {
      await testDatabase.db.insert(agents).values({ id: "agent-test", title: "Test", kind: "custom", summary: "", updatedAt: 1 })
      const rows = await testDatabase.db.select().from(agents)
      expect(rows).toHaveLength(1)
      expect(rows[0]?.id).toBe("agent-test")
    } finally {
      testDatabase.close()
    }
  })
})
